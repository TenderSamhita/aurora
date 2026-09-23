'use client';

/**
 * aurora/frontend/src/app/station/[id]/page.tsx
 *
 * Station Dashboard Shell.
 *
 * Sets up the TopBar, Sidebar, and primary layout.
 * Connects the WebSocket for live telemetry.
 *
 * Phase 1: Only displays the raw connection state and telemetry payload.
 * Phase 2-4: Will mount the full visual dashboard components.
 */

import React, { use } from 'react';
import { notFound } from 'next/navigation';
import type { StationID } from '@/lib/types';
import { STATIONS } from '@/lib/constants';
import { useStationSocket } from '@/lib/websocket';
import TopBar from '@/components/layout/TopBar';
import Sidebar from '@/components/layout/Sidebar';
import SectionPanel from '@/components/ui/SectionPanel';
import EnvironmentCard from '@/components/dashboard/EnvironmentCard';
import PowerCard from '@/components/dashboard/PowerCard';
import LogisticsCard from '@/components/dashboard/LogisticsCard';
import RiskCard from '@/components/dashboard/RiskCard';
import AlertsPanel from '@/components/dashboard/AlertsPanel';
import ControlsPanel from '@/components/dashboard/ControlsPanel';
import DigitalTwinView from '@/components/dashboard/DigitalTwinView';
import ParameterGraph from '@/components/dashboard/ParameterGraph';
import ScenarioEngine from '@/components/dashboard/ScenarioEngine';
import CommsPanel from '@/components/dashboard/CommsPanel';

export default function StationDashboard({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 14 app router async params
  const { id } = use(params);
  const normalizedId = id.toUpperCase();
  
  if (!(normalizedId in STATIONS)) {
    notFound();
  }
  
  const stationId = normalizedId as StationID;
  const meta = STATIONS[stationId];
  
  // Connect WebSocket – Phase 6 HQ vs EDGE
  const { connectionStatus, stationState, edgeState, lastSequence, error, isBufferedReplay, linkStatus, isStale, syncStatus } = 
    useStationSocket(stationId);

  return (
    <div className="app-shell">
      <TopBar 
        stationId={meta.id}
        stationName={meta.name}
        operationalMode={stationState?.operational_mode ?? 'standby'}
        personnelCount={stationState?.personnel_count}
        connectionStatus={connectionStatus}
        linkStatus={linkStatus}
        comms={stationState?.comms}
        syncStatus={syncStatus}
        isStale={isStale}
      />
      
      <div className="app-body">
        <Sidebar activeStation={stationId} activeSection="overview" />
        
        <main className="app-content dashboard-grid">
          {connectionStatus === 'connecting' && (
            <div className="state-loading" style={{ gridColumn: '1 / -1' }} role="status" aria-live="polite">
              <span className="state-label blink">Establishing telemetry link</span>
              <span className="state-message">Negotiating WebSocket wss://aurora/ws/{stationId} · HQ sync · simulated stream</span>
              <div style={{ marginTop: '8px', width: '160px', height: '2px', backgroundColor: 'var(--surface-border)', overflow: 'hidden' }}>
                <div style={{ width: '50%', height: '100%', backgroundColor: 'var(--accent)', animation: 'sync-fill 1s ease-in-out infinite' }} />
              </div>
              <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '8px' }}>EDGE: {edgeState ? 'live' : 'pending'} · HQ: {stationState ? 'syncing' : 'pending'}</div>
            </div>
          )}
          
          {connectionStatus === 'error' && (
            <div className="state-error" style={{ gridColumn: '1 / -1' }} role="alert">
              <span className="state-label">WebSocket failure</span>
              <span className="state-message">Cannot establish telemetry link to {stationId}. Backend or network may be unavailable. Check WebSocket at ws://localhost:8000/api/ws/{stationId}.</span>
              <div className="state-code">ERR_WS_FAILURE · {error}</div>
              <button className="state-action" onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}
          
          {connectionStatus === 'disconnected' && !error && (
            <div className="state-offline" style={{ gridColumn: '1 / -1' }} role="status">
              <span className="state-label">Link offline</span>
              <span className="state-message">WebSocket disconnected. Dashboard shows last HQ state (cached). EDGE continues buffering to SQLite. Reconnecting automatically.</span>
              <div className="state-code">LINK: OFFLINE · HQ cached · EDGE live</div>
            </div>
          )}
          {stationState && syncStatus?.is_blackout && (
            <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--status-critical-bg)', border: '1px solid var(--status-critical)', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--status-critical)', fontWeight: 600 }}>BLACKOUT — HQ STALE · EDGE BUFFERING TO SQLITE</span>
              <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{syncStatus.db_buffered} pkts queued · staleness {syncStatus.staleness_s.toFixed(1)}s</span>
            </div>
          )}
          {syncStatus?.is_syncing && (
            <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--status-recovering-bg)', border: '1px solid var(--status-recovering)', padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--status-recovering)', fontWeight: 600 }} className="blink">SYNCING — REPLAYING BUFFERED TELEMETRY</span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{syncStatus.db_buffered} pkts · {syncStatus.edge_sequence - syncStatus.hq_sequence} behind</span>
              </div>
              <div style={{ marginTop: '6px', height: '2px', backgroundColor: 'var(--surface-border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: 'var(--status-recovering)', animation: 'sync-fill 1.5s ease-in-out infinite' }} />
              </div>
            </div>
          )}
          
          {stationState && (
            <>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <DigitalTwinView state={stationState} />
                <ParameterGraph state={stationState} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <EnvironmentCard env={stationState.environment} status={stationState.risk.factors.find(f => f.label === 'ENV')?.status || 'normal'} />
                <PowerCard power={stationState.power} status={stationState.risk.factors.find(f => f.label === 'POWER')?.status || 'normal'} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <LogisticsCard logistics={stationState.logistics} status={stationState.risk.factors.find(f => f.label === 'FUEL')?.status || 'normal'} />
                <RiskCard risk={stationState.risk} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <AlertsPanel state={stationState} />
                <ControlsPanel stationId={stationId} activeScenario={stationState.scenario_active} />
                <CommsPanel hqState={stationState} edgeState={edgeState} syncStatus={syncStatus} linkStatus={linkStatus as any} isStale={isStale} isBufferedReplay={isBufferedReplay} />
              </div>

              <ScenarioEngine stationId={stationId} currentState={stationState} />
              {/* Data trust legend */}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '8px 12px', backgroundColor: 'var(--surface-panel)', border: '1px solid var(--surface-border)', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                <span style={{ letterSpacing: '0.08em', fontWeight: 600, color: 'var(--text-secondary)' }}>Data provenance:</span>
                <span><span className="provenance provenance-live" style={{ marginRight: '4px' }}>live</span> direct telemetry</span>
                <span><span className="provenance provenance-sim" style={{ marginRight: '4px' }}>sim</span> simulated Antarctic conditions</span>
                <span><span className="provenance provenance-calc" style={{ marginRight: '4px' }}>calc</span> calculated</span>
                <span><span className="provenance provenance-cached" style={{ marginRight: '4px' }}>cached</span> HQ stale during blackout</span>
                <span><span className="provenance provenance-baseline" style={{ marginRight: '4px' }}>baseline</span> reference before scenario</span>
              </div>
            </>
          )}
          {/* Empty data state */}
          {!stationState && connectionStatus === 'connected' && (
            <div className="state-empty" style={{ gridColumn: '1 / -1' }} role="status">
              <span className="state-label">No telemetry</span>
              <span className="state-message">Connected to {stationId} but no state received yet. Waiting for next 5s tick · check backend simulator.</span>
              <div className="state-code">ERR_EMPTY_DATA · HQ seq {syncStatus?.hq_sequence ?? '-'} · EDGE seq {syncStatus?.edge_sequence ?? '-'}</div>
            </div>
          )}
          {/* Sync failure state */}
          {syncStatus && syncStatus.is_syncing && syncStatus.db_buffered > 50 && (
            <div className="state-sync-failure" style={{ gridColumn: '1 / -1' }} role="alert">
              <span className="state-label">Synchronization delay</span>
              <span className="state-message">HQ sync is taking longer than expected ({syncStatus.db_buffered} pkts queued, {syncStatus.blackout_duration_s.toFixed(1)}s blackout). Check SQLite buffer and link.</span>
              <div className="state-code">SYNC: {syncStatus.db_buffered} pkts · staleness {syncStatus.staleness_s.toFixed(1)}s</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
