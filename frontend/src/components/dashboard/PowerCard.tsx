import React from 'react';
import { PowerState, ComponentStatus } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';
import MetricRow from '../ui/MetricRow';

export default function PowerCard({ power, status }: { power: PowerState, status: ComponentStatus }) {
  return (
    <SectionPanel title="Power" status={status} provenance="calc">
      <MetricRow label="Total Load" value={power.total_demand_kw.toFixed(1)} unit="kW" />
      <MetricRow label="Heating Load" value={power.thermal_demand_kw.toFixed(1)} unit="kW" />
      <MetricRow label="Base Load" value={power.base_load_kw.toFixed(1)} unit="kW" />
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--surface-border)' }}>
        {power.generators.map((gen, idx) => (
          <MetricRow 
            key={gen.generator_id} 
            label={`Generator ${idx + 1}`} 
            value={gen.output_kw.toFixed(1)} 
            unit="kW" 
            status={gen.status} 
          />
        ))}
        <MetricRow label="Solar Output" value={power.solar_output_kw.toFixed(1)} unit="kW" />
        <MetricRow label="Wind Output" value={power.wind_output_kw.toFixed(1)} unit="kW" />
      </div>
      <div style={{ marginTop: '6px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Calculated: thermal model + generator dispatch · 0.28 L/kWh</div>
    </SectionPanel>
  );
}
