import React from 'react';
import { StationState } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';

export default function AlertsPanel({ state }: { state: StationState }) {
  const alerts: { severity: string; timestamp: string; source: string; description: string }[] = [];
  
  if (state.risk.factors.find(f => f.label === 'FUEL')?.status === 'critical') {
    alerts.push({ severity: 'critical', timestamp: state.timestamp, source: 'LOGISTICS', description: 'FUEL AUTONOMY BELOW RESUPPLY WINDOW' });
  }
  if (state.power.generators.filter(g => g.status === 'offline').length > 0) {
    alerts.push({ severity: 'warning', timestamp: state.timestamp, source: 'POWER', description: 'GENERATOR REDUNDANCY LOST' });
  }
  if (state.comms.is_blackout) {
    alerts.push({ severity: 'critical', timestamp: state.timestamp, source: 'COMMS', description: 'SATELLITE COMMUNICATION DEGRADED' });
  }
  const envStatus = state.risk.factors.find(f => f.label === 'ENV')?.status;
  if (envStatus === 'critical' || envStatus === 'warning') {
    alerts.push({ severity: envStatus, timestamp: state.timestamp, source: 'ENV', description: 'ENVIRONMENTAL THRESHOLD EXCEEDED' });
  }

  return (
    <SectionPanel title="System Alerts" provenance="calc" subtitle={`${alerts.length} active`}>
      {alerts.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--surface-border)', backgroundColor: 'var(--surface-raised)' }}>
          <div style={{ color: 'var(--status-normal)', fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 600 }}>NO ACTIVE ALERTS</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>All systems nominal · evaluated {new Date(state.timestamp).toISOString().slice(11,19)} UTC</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {alerts.map((a, i) => (
            <div key={i} className="alert-in" style={{ borderLeft: `2px solid var(--status-${a.severity})`, padding: '6px 8px', backgroundColor: `var(--status-${a.severity}-bg)`, borderTop: '1px solid var(--surface-border)', borderRight: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                {new Date(a.timestamp).toISOString().slice(11,19)} UTC · {a.source} · live
              </div>
              <div style={{ fontSize: '11px', color: `var(--status-${a.severity})`, fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '2px' }}>
                {a.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}
