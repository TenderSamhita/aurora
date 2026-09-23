'use client';

/**
 * aurora/frontend/src/lib/websocket.ts
 *
 * useStationSocket — React hook for the AURORA telemetry WebSocket.
 *
 * Features:
 * - Automatic connection on mount
 * - Exponential backoff reconnect (max 30 s)
 * - Connection status tracking
 * - Buffered replay detection
 * - Clean teardown on unmount / station change
 *
 * Usage:
 *   const { connectionStatus, stationState, lastPacket, error } =
 *     useStationSocket('MAITRI');
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type {
  TelemetryPacket,
  StationState,
  WSConnectionStatus,
  StationSocketState,
  StationID,
  LinkStatus,
  SyncStatus,
} from './types';
import { WS_BASE_URL, API_BASE_URL } from './constants';

const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const RECONNECT_MULTIPLIER = 1.5;

export function useStationSocket(stationId: StationID | null): StationSocketState {
  const [connectionStatus, setConnectionStatus] = useState<WSConnectionStatus>('disconnected');
  const [stationState, setStationState] = useState<StationState | null>(null);
  const [edgeState, setEdgeState] = useState<StationState | null>(null);
  const [lastPacket, setLastPacket] = useState<TelemetryPacket | null>(null);
  const [lastSequence, setLastSequence] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isBufferedReplay, setIsBufferedReplay] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>('ONLINE');
  const [isStale, setIsStale] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(INITIAL_RECONNECT_MS);
  const shouldReconnectRef = useRef<boolean>(true);
  const currentStationRef = useRef<StationID | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback((id: StationID) => {
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect trigger
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');
    setError(null);

    const url = `${WS_BASE_URL}/${id}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setConnectionStatus('error');
      setError(`Failed to create WebSocket: ${String(err)}`);
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      setError(null);
      reconnectDelayRef.current = INITIAL_RECONNECT_MS; // reset backoff on success
    };

    ws.onmessage = (event) => {
      try {
        const packet: TelemetryPacket = JSON.parse(event.data as string);

        setStationState(packet.state);
        setLastPacket(packet);
        setLastSequence(packet.sequence);
        setIsBufferedReplay(packet.is_buffered);
      } catch (err) {
        console.error('[AURORA WS] Failed to parse packet:', err);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      wsRef.current = null;

      if (!shouldReconnectRef.current) {
        setConnectionStatus('disconnected');
        return;
      }

      setConnectionStatus('disconnected');

      // Exponential backoff reconnect
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(
        delay * RECONNECT_MULTIPLIER,
        MAX_RECONNECT_MS
      );

      reconnectTimerRef.current = setTimeout(() => {
        const current = currentStationRef.current;
        if (shouldReconnectRef.current && current) {
          connect(current);
        }
      }, delay);
    };
  }, []);

  useEffect(() => {
    if (!stationId) {
      setConnectionStatus('disconnected');
      setStationState(null);
      return;
    }

    shouldReconnectRef.current = true;
    currentStationRef.current = stationId;
    clearReconnectTimer();
    reconnectDelayRef.current = INITIAL_RECONNECT_MS;

    connect(stationId);

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnectionStatus('disconnected');
    };
  }, [stationId, connect, clearReconnectTimer]);

  // Phase 6: poll sync status and EDGE state for HQ vs EDGE distinction
  useEffect(() => {
    if (!stationId) {
      setSyncStatus(null);
      setEdgeState(null);
      return;
    }
    let cancelled = false;
    const fetchSync = async () => {
      try {
        // Sync status (includes link_status, buffered, staleness)
        const syncRes = await fetch(`${API_BASE_URL}/station/${stationId}/sync/status`, { cache: 'no-store' });
        if (syncRes.ok && !cancelled) {
          const data = (await syncRes.json()) as SyncStatus;
          setSyncStatus(data);
          // Derive linkStatus: prioritize is_syncing from syncStatus or isBufferedReplay from WS
          let derived: LinkStatus = (data.link_status as LinkStatus) || 'ONLINE';
          // If WebSocket is replaying buffered, force SYNCING
          if (isBufferedReplay) derived = 'SYNCING';
          else if (data.is_syncing) derived = 'SYNCING';
          else if (data.is_blackout) derived = 'OFFLINE';
          setLinkStatus(derived);
          // Stale when HQ older than EDGE by >5s and in blackout
          const staleness = (data as any).staleness_s ?? 0;
          setIsStale(data.is_blackout && staleness > 3);
        }
        // EDGE state for comparison (only poll when needed or always)
        // Poll edge every 3s; keep payload compact
        const edgeRes = await fetch(`${API_BASE_URL}/station/${stationId}/edge/state`, { cache: 'no-store' });
        if (edgeRes.ok && !cancelled) {
          const edgeData = (await edgeRes.json()) as StationState;
          setEdgeState(edgeData);
        }
      } catch {
        // ignore polling errors
      }
    };
    fetchSync();
    const id = setInterval(fetchSync, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [stationId, isBufferedReplay]);

  // Also derive staleness from HQ timestamp age when not in sync polling
  useEffect(() => {
    if (!stationState) {
      setIsStale(false);
      return;
    }
    // If link is OFFLINE, mark stale after 5s
    if (linkStatus === 'OFFLINE') {
      const hqTime = new Date(stationState.timestamp).getTime();
      const age = Date.now() - hqTime;
      setIsStale(age > 5000);
    } else if (linkStatus === 'SYNCING') {
      setIsStale(false);
    } else {
      setIsStale(false);
    }
  }, [stationState, linkStatus]);

  const syncProgress = syncStatus
    ? {
        isSyncing: syncStatus.is_syncing || isBufferedReplay,
        buffered: syncStatus.db_buffered ?? syncStatus.buffered_packets,
        lastSyncBuffered: syncStatus.last_sync_buffered,
        lastSyncDuration: syncStatus.last_sync_duration_s,
        lastSyncTimestamp: syncStatus.last_sync_timestamp,
      }
    : null;

  return {
    connectionStatus,
    stationState,
    edgeState,
    lastPacket,
    lastSequence,
    error,
    isBufferedReplay,
    linkStatus,
    isStale,
    syncStatus,
    syncProgress,
  };
}
