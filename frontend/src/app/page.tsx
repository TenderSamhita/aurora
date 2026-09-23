/**
 * aurora/frontend/src/app/page.tsx
 *
 * Station Selector — application entry point.
 *
 * Fetches live station list from the backend REST API.
 * Renders both Maitri and Bharati with their current operational state.
 * Routes to /station/[id] on selection.
 *
 * Design: functional selector, not a landing page. No hero. No marketing copy.
 * The operator sees station status immediately.
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StationListItem, ComponentStatus } from '@/lib/types';
import { API_BASE_URL, STATIONS } from '@/lib/constants';
import StatusBadge from '@/components/ui/StatusBadge';

function fetchStations(): Promise<StationListItem[]> {
  return fetch(`${API_BASE_URL}/stations`, { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<StationListItem[]>;
    });
}

function StationCard({ item }: { item: StationListItem }) {
  const meta = STATIONS[item.id];

  const modeColors: Record<string, string> = {
    normal:     'var(--text-muted)',
    emergency:  'var(--status-critical)',
    reduced:    'var(--status-warning)',
    evacuation: 'var(--status-critical)',
    standby:    'var(--status-offline)',
  };

  return (
    <Link
      href={`/station/${item.id}`}
      aria-label={`Open dashboard for ${item.name} station`}
      style={{
        display: 'block',
        backgroundColor: 'var(--surface-panel)',
        border: '1px solid var(--surface-border)',
        borderTop: `2px solid var(--status-${item.risk_overall})`,
        padding: '16px 20px',
        textDecoration: 'none',
        cursor: 'pointer',
        maxWidth: '400px',
        width: '100%',
      }}
    >
      {/* Station header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h2
              className="section-heading"
              style={{
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {item.name.toUpperCase()}
            </h2>
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
              }}
            >
              {item.id}
            </span>
          </div>
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-secondary)',
              marginTop: '2px',
            }}
          >
            {item.location}
          </div>
        </div>
        <StatusBadge status={item.risk_overall} size="sm" />
      </div>

      {/* Metrics grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px 24px',
          borderTop: '1px solid var(--surface-border)',
          paddingTop: '14px',
        }}
      >
        <Metric label="Personnel" value={`${item.personnel_count}`} unit="PAX" />
        <Metric label="Mode" value={item.operational_mode.toUpperCase()} color={modeColors[item.operational_mode]} />
        <Metric label="Comms" value={item.comms_status.toUpperCase()} statusColor={item.comms_status} />
        <Metric label="Est." value={`${meta.yearEstablished}`} />
        <Metric
          label="Coordinates"
          value={`${Math.abs(meta.coordinates.lat).toFixed(2)}°${meta.coordinates.lat < 0 ? 'S' : 'N'} ${Math.abs(meta.coordinates.lon).toFixed(2)}°${meta.coordinates.lon < 0 ? 'W' : 'E'}`}
        />
        <Metric
          label="Capacity"
          value={meta.isWinterized ? `${meta.personnelSummer}S / ${meta.personnelWinter}W` : `${meta.personnelSummer}S only`}
        />
      </div>

      {/* Drill-in prompt */}
      <div
        style={{
          marginTop: '16px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent)',
          letterSpacing: '0.06em',
        }}
      >
        OPEN DASHBOARD →
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  unit,
  color,
  statusColor,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  statusColor?: ComponentStatus;
}) {
  const statusColors: Record<string, string> = {
    normal: 'var(--status-normal)',
    warning: 'var(--status-warning)',
    critical: 'var(--status-critical)',
    offline: 'var(--status-offline)',
    degraded: 'var(--status-degraded)',
    recovering: 'var(--status-recovering)',
  };

  return (
    <div>
      <div
        style={{
          fontSize: '9px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
          marginBottom: '2px',
        }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: '12px',
          fontFamily: 'var(--font-mono)',
          fontWeight: 500,
          color: statusColor ? statusColors[statusColor] : color ?? 'var(--text-primary)',
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginLeft: '3px',
              fontWeight: 400,
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; stations: StationListItem[] };

export default function StationSelectorPage() {
  const [state, setState] = useState<PageState>({ phase: 'loading' });

  useEffect(() => {
    fetchStations()
      .then((stations) => setState({ phase: 'ready', stations }))
      .catch((err: unknown) =>
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      );
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--surface-base)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Minimal header */}
      <header
        style={{
          height: 'var(--topbar-height)',
          backgroundColor: 'var(--surface-elevated)',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: '12px',
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
          Antarctic Digital Twin Platform · NCPOR / MoES
        </span>
      </header>

      {/* Content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '32px 24px',
          maxWidth: '960px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Page heading */}
        <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--surface-border)', paddingBottom: '12px' }}>
          <h1
            className="section-heading"
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            Station Selection
          </h1>
          <p
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              color: 'var(--text-muted)',
              marginTop: '4px',
            }}
          >
            Select an Indian Antarctic Research Station to open its operational dashboard. <span className="provenance provenance-live" style={{ marginLeft: '6px', verticalAlign: 'middle' }}>live</span>
          </p>
        </div>

        {/* States – operational, not developer errors */}
        {state.phase === 'loading' && (
          <div className="state-loading" role="status" aria-live="polite">
            <span className="state-label blink">Establishing link to AURORA backend</span>
            <span className="state-message">Fetching station status via REST · {API_BASE_URL}/stations · simulated telemetry</span>
            <div style={{ marginTop: '8px', width: '120px', height: '2px', backgroundColor: 'var(--surface-border)', overflow: 'hidden' }}>
              <div style={{ width: '60%', height: '100%', backgroundColor: 'var(--accent)', animation: 'sync-fill 1.2s ease-in-out infinite' }} />
            </div>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="state-error" role="alert">
            <span className="state-label">Backend Unavailable</span>
            <span className="state-message">
              Cannot reach AURORA API at <code style={{ backgroundColor: 'var(--surface-raised)', padding: '1px 4px', border: '1px solid var(--surface-border)', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{API_BASE_URL}</code>.
              <br />
              Check that <code style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>uvicorn app.main:app --port 8000</code> is running and network is reachable.
            </span>
            <div className="state-code">ERR_API_UNREACHABLE · {state.message}</div>
            <button className="state-action" onClick={() => window.location.reload()}>Retry connection</button>
          </div>
        )}

        {state.phase === 'ready' && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            {state.stations.map((s) => (
              <StationCard key={s.id} item={s} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
        >
          National Centre for Polar and Ocean Research · Ministry of Earth Sciences
        </span>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
          }}
        >
          SIH26060
        </span>
      </footer>
    </div>
  );
}
