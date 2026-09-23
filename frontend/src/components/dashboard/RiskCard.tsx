import React from 'react';
import { RiskAssessment } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';
import MetricRow from '../ui/MetricRow';

export default function RiskCard({ risk }: { risk: RiskAssessment }) {
  return (
    <SectionPanel title="Operational Risk" status={risk.overall} provenance="calc">
      <MetricRow label="Overall Risk" value={risk.overall.toUpperCase()} status={risk.overall} />
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--surface-border)' }}>
        {risk.factors.map(f => (
          <MetricRow 
            key={f.name}
            label={f.name}
            value={f.value.toFixed(1)}
            unit={f.unit}
            status={f.status}
          />
        ))}
      </div>
      <div style={{ marginTop: '6px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Thresholds: fuel 30/14d · power 5/20kW · wind chill -35/-50°C · evaluated {new Date(risk.last_evaluated).toISOString().slice(11,19)} UTC</div>
    </SectionPanel>
  );
}
