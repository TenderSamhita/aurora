'use client';

import React from 'react';
import type { StationState, LinkStatus, SyncStatus } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';
import MetricRow from '../ui/MetricRow';

interface CommsPanelProps {
  hqState: StationState | null;
  edgeState: StationState | null;
  syncStatus: SyncStatus | null;
  linkStatus: LinkStatus;
  isStale: boolean;
  isBufferedReplay: boolean;
}

export default function CommsPanel({ hqState, edgeState, syncStatus, linkStatus, isStale, isBufferedReplay }: CommsPanelProps) {
  if (!hqState) {
    return (
      <SectionPanel title="Comms / Sync" status="offline">
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>NO TELEMETRY</div>
      </SectionPanel>
    );
  }

  const hqTime = hqState.timestamp ? new Date(hqState.timestamp) : null;
  const edgeTime = edgeState?.timestamp ? new Date(edgeState.timestamp) : null;
  const staleness = syncStatus?.staleness_s ?? 0;
  const buffered = syncStatus?.db_buffered ?? syncStatus?.buffered_packets ?? 0;
  const lastSync = syncStatus?.last_sync_timestamp ? new Date(syncStatus.last_sync_timestamp) : null;

  const linkColor: Record<LinkStatus, string> = {
    ONLINE: 'var(--status-normal)',
    DEGRADED: 'var(--status-warning)',
    OFFLINE: 'var(--status-critical)',
    SYNCING: 'var(--status-recovering)',
  };

  const isSyncing = linkStatus === 'SYNCING' || syncStatus?.is_syncing || isBufferedReplay;
  const justCompleted = syncStatus && !isSyncing && syncStatus.last_sync_buffered > 0 && syncStatus.last_sync_duration_s > 0;

  return (
    <SectionPanel title="Communications / Store-and-Forward" status={linkStatus === 'OFFLINE' ? 'critical' : linkStatus === 'SYNCING' ? 'recovering' : linkStatus === 'DEGRADED' ? 'warning' : 'normal'}>
      {/* LINK status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '6px 8px', backgroundColor: 'var(--surface-raised)', border: `1px solid ${linkColor[linkStatus]}` }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: linkColor[linkStatus], display: 'inline-block' }} className={isSyncing ? 'pulse-critical' : ''} />
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: linkColor[linkStatus], letterSpacing: '0.08em' }}>LINK: {linkStatus}</span>
        {isStale && <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning)', border: '1px solid var(--status-warning)', padding: '1px 4px' }}>STALE DATA</span>}
        {isSyncing && <span className="blink" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--status-recovering)' }}>SYNCING...</span>}
      </div>

      {isSyncing ? (
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '8px', backgroundColor: 'var(--status-recovering-bg)', border: '1px solid var(--status-recovering)' }}>
          <div style={{ fontWeight: 700, color: 'var(--status-recovering)' }}>REPLAYING BUFFERED TELEMETRY</div>
          <div>Queued packets: {buffered} (replaying...)</div>
          <div>EDGE is live, HQ is catching up</div>
          <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>Do not use fake animations – real packets are being replayed from SQLite.</div>
        </div>
      ) : justCompleted && syncStatus ? (
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--status-normal)', lineHeight: 1.6, padding: '8px', backgroundColor: 'var(--status-normal-bg)', border: '1px solid var(--status-normal)' }}>
          <div style={{ fontWeight: 700 }}>SYNC COMPLETE</div>
          <div>Buffered updates: {syncStatus.last_sync_buffered}</div>
          <div>Sync duration: {syncStatus.last_sync_duration_s.toFixed(2)}s</div>
          <div>Latest timestamp: {lastSync ? lastSync.toISOString().slice(11, 19) + ' UTC' : syncStatus.hq_timestamp?.slice(11, 19)}</div>
          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>HQ now synchronized to EDGE</div>
        </div>
      ) : linkStatus === 'OFFLINE' ? (
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--status-critical)', lineHeight: 1.6, padding: '8px', backgroundColor: 'var(--status-critical-bg)', border: '1px solid var(--status-critical)' }}>
          <div style={{ fontWeight: 700 }}>BLACKOUT – HQ STALE, EDGE LIVE</div>
          <div>Edge continues, HQ frozen at last sync</div>
          {staleness > 0 && <div>Staleness: {staleness.toFixed(1)}s</div>}
          <div>Queued locally: {buffered} packets (SQLite)</div>
          {edgeState && <div>EDGE temp {edgeState.environment.temperature_c.toFixed(1)}°C vs HQ {hqState.environment.temperature_c.toFixed(1)}°C</div>}
        </div>
      ) : null}

      {/* HQ vs EDGE comparison */}
      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
        <div style={{ backgroundColor: 'var(--surface-raised)', padding: '8px', border: '1px solid var(--surface-border)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.08em', marginBottom: '4px' }}>HQ CLOUD STATE</div>
          <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
            Seq: {syncStatus?.hq_sequence ?? '-'}<br/>
            Time: {hqTime ? hqTime.toISOString().slice(11, 19) + ' UTC' : '-'}<br/>
            Temp: {hqState.environment.temperature_c.toFixed(1)}°C<br/>
            Fuel: {hqState.logistics.fuel.autonomy_days.toFixed(1)}d<br/>
            {isStale && <span style={{ color: 'var(--status-warning)' }}>STALE – not live</span>}
            {!isStale && <span style={{ color: 'var(--status-normal)' }}>LIVE SYNCED</span>}
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--surface-panel)', padding: '8px', border: `1px solid ${linkStatus === 'OFFLINE' ? 'var(--status-warning)' : 'var(--surface-border)'}` }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.08em', marginBottom: '4px' }}>EDGE STATE</div>
          <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {edgeState ? (
              <>
                Seq: {syncStatus?.edge_sequence ?? '-'}<br/>
                Time: {edgeTime ? edgeTime.toISOString().slice(11, 19) + ' UTC' : '-'}<br/>
                Temp: {edgeState.environment.temperature_c.toFixed(1)}°C<br/>
                Fuel: {edgeState.logistics.fuel.autonomy_days.toFixed(1)}d<br/>
                <span style={{ color: linkStatus === 'OFFLINE' ? 'var(--status-normal)' : 'var(--text-muted)' }}>{linkStatus === 'OFFLINE' ? 'LIVE (buffering)' : 'IN SYNC'}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>POLLING EDGE...</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        <MetricRow label="Blackout Duration" value={syncStatus ? `${syncStatus.blackout_duration_s.toFixed(1)}` : '0.0'} unit="s" />
        <MetricRow label="Queued (DB)" value={buffered.toString()} unit="pkts" status={buffered > 0 ? 'warning' : 'normal'} />
        <MetricRow label="HQ Last Contact" value={hqState.comms.last_contact ? new Date(hqState.comms.last_contact).toISOString().slice(11, 19) : '-'} unit="UTC" />
        <MetricRow label="VSAT Uplink" value={hqState.comms.vsat_uplink_mbps.toFixed(1)} unit="Mbps" status={hqState.comms.is_blackout ? 'critical' : 'normal'} />
      </div>

      <div style={{ marginTop: '8px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
        SQLite buffer: timestamp, station_id, sequence, state delta (compact JSON). No freeze – edge ticks every 5s even when HQ stale.
      </div>
    </SectionPanel>
  );
}
