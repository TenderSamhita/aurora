'use client';

/**
 * aurora/frontend/src/components/layout/TopBar.tsx
 *
 * Primary application header.
 *
 * Displays:
 * - AURORA wordmark + system designation
 * - Active station name + operational mode
 * - WebSocket connection status (live indicator, not decorative)
 * - UTC timestamp (updated every second)
 * - Comms status indicator
 *
 * Design: horizontal strip, high information density, no hero treatment.
 */

import React, { useEffect, useState } from 'react';
import type { WSConnectionStatus, CommsStatus, ComponentStatus, LinkStatus, SyncStatus } from '@/lib/types';

interface TopBarProps {
  stationName?: string;
  stationId?: string;
  operationalMode?: string;
  connectionStatus: WSConnectionStatus;
  linkStatus?: LinkStatus;
  comms?: CommsStatus;
  syncStatus?: SyncStatus | null;
  isStale?: boolean;
  personnelCount?: number;
}

function formatUTC(date: Date): string {
  return date.toUTCString().replace(' GMT', ' UTC').slice(0, -4) + 'UTC';
}

function ConnectionIndicator({ status }: { status: WSConnectionStatus }) {
  const config: Record<WSConnectionStatus, { color: string; label: string }> = {
    connected:    { color: 'var(--status-normal)',   label: 'LIVE' },
    connecting:   { color: 'var(--status-warning)',  label: 'CONNECTING' },
    disconnected: { color: 'var(--status-offline)',  label: 'OFFLINE' },
    error:        { color: 'var(--status-critical)', label: 'ERROR' },
  };
  const { color, label } = config[status];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          color,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function LinkIndicator({ linkStatus, isStale, syncStatus }: { linkStatus: LinkStatus, isStale?: boolean, syncStatus?: SyncStatus | null }) {
  const config: Record<LinkStatus, { color: string; label: string }> = {
    ONLINE:   { color: 'var(--status-normal)', label: 'ONLINE' },
    DEGRADED: { color: 'var(--status-warning)', label: 'DEGRADED' },
    OFFLINE:  { color: 'var(--status-critical)', label: 'OFFLINE' },
    SYNCING:  { color: 'var(--status-recovering)', label: 'SYNCING' },
  };
  const { color, label } = config[linkStatus] || config.ONLINE;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid var(--surface-border)', paddingLeft: '12px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} className={linkStatus === 'SYNCING' ? 'pulse-critical' : ''} />
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em', color }}>{label}</span>
      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>LINK</span>
      {isStale && linkStatus === 'OFFLINE' && <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', backgroundColor: 'var(--status-warning-bg)', padding: '1px 4px', border: '1px solid var(--status-warning)' }}>STALE</span>}
      {syncStatus && syncStatus.db_buffered > 0 && linkStatus === 'OFFLINE' && <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{syncStatus.db_buffered} PKT QUEUED</span>}
      {linkStatus === 'SYNCING' && syncStatus && <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--status-recovering)' }}>{syncStatus.db_buffered} PKT SYNC</span>}
    </div>
  );
}

function CommsIndicator({ comms, linkStatus }: { comms: CommsStatus, linkStatus?: LinkStatus }) {
  const status = comms.is_blackout ? 'offline' : comms.satellite_link;
  const statusColors: Record<string, string> = {
    normal: 'var(--status-normal)',
    warning: 'var(--status-warning)',
    critical: 'var(--status-critical)',
    offline: 'var(--status-offline)',
    degraded: 'var(--status-degraded)',
    recovering: 'var(--status-recovering)',
  };
  const color = statusColors[status] ?? 'var(--text-muted)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        borderLeft: '1px solid var(--surface-border)',
        paddingLeft: '12px',
      }}
    >
      {/* VSAT icon (simple SVG) */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke={color} strokeWidth="1.2" />
        <path d="M1 6h10M6 1v10" stroke={color} strokeWidth="1.2" />
        <path d="M2.5 3.5Q6 2 9.5 3.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
        <path d="M2.5 8.5Q6 10 9.5 8.5" stroke={color} strokeWidth="1" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontSize: '10px',
          fontFamily: 'var(--font-mono)',
          color,
          letterSpacing: '0.06em',
        }}
      >
        VSAT
      </span>
      {comms.is_blackout && comms.buffered_packets > 0 && (
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--status-warning)',
          }}
        >
          {comms.buffered_packets} PKT
        </span>
      )}
      {linkStatus === 'OFFLINE' && <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--status-critical)' }}>HQ STALE</span>}
    </div>
  );
}

export default function TopBar({
  stationName,
  stationId,
  operationalMode = 'normal',
  connectionStatus,
  linkStatus,
  comms,
  syncStatus,
  isStale,
  personnelCount,
}: TopBarProps) {
  const [utcTime, setUtcTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setUtcTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const modeColors: Record<string, string> = {
    normal:     'var(--text-muted)',
    emergency:  'var(--status-critical)',
    reduced:    'var(--status-warning)',
    evacuation: 'var(--status-critical)',
    standby:    'var(--status-offline)',
  };

  return (
    <header
      style={{
        height: '44px',
        backgroundColor: 'var(--surface-elevated)',
        borderBottom: '1px solid var(--surface-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '0',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
          borderRight: '1px solid var(--surface-border)',
          paddingRight: '16px',
          marginRight: '16px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'var(--text-primary)',
          }}
        >
          AURORA
        </span>
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
          }}
        >
          NCPOR / MoES
        </span>
      </div>

      {/* Station identity */}
      {stationName ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderRight: '1px solid var(--surface-border)',
            paddingRight: '16px',
            marginRight: '16px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '0.05em',
            }}
          >
            {stationName.toUpperCase()}
          </span>
          {stationId && (
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
              }}
            >
              {stationId}
            </span>
          )}
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: modeColors[operationalMode] ?? 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            {operationalMode}
          </span>
          {personnelCount !== undefined && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              {personnelCount} PAX
            </span>
          )}
        </div>
      ) : (
        <div
          style={{
            borderRight: '1px solid var(--surface-border)',
            paddingRight: '16px',
            marginRight: '16px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}
          >
            NO STATION SELECTED
          </span>
        </div>
      )}

      {/* Right side */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        {/* Link status – Phase 6 meaningful states */}
        {linkStatus && <LinkIndicator linkStatus={linkStatus} isStale={isStale} syncStatus={syncStatus} />}
        {/* Comms */}
        {comms && <CommsIndicator comms={comms} linkStatus={linkStatus} />}

        {/* WS connection */}
        <ConnectionIndicator status={connectionStatus} />

        {/* UTC clock */}
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            letterSpacing: '0.04em',
            borderLeft: '1px solid var(--surface-border)',
            paddingLeft: '12px',
            tabularNums: true,
          } as React.CSSProperties}
        >
          {utcTime.toISOString().slice(0, 19).replace('T', ' ')} UTC
        </span>
      </div>
    </header>
  );
}
