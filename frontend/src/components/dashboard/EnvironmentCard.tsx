import React from 'react';
import { EnvironmentalConditions, ComponentStatus } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';
import MetricRow from '../ui/MetricRow';

export default function EnvironmentCard({ env, status }: { env: EnvironmentalConditions, status: ComponentStatus }) {
  return (
    <SectionPanel title="Environment" status={status} provenance="sim">
      <MetricRow label="Temperature" value={env.temperature_c.toFixed(1)} unit="°C" />
      <MetricRow label="Wind Chill" value={env.wind_chill_c.toFixed(1)} unit="°C" />
      <MetricRow label="Wind Speed" value={env.wind_speed_ms.toFixed(1)} unit="m/s" />
      <MetricRow label="Pressure" value={env.pressure_hpa.toFixed(0)} unit="hPa" />
      <MetricRow label="Visibility" value={env.visibility_m.toFixed(0)} unit="m" />
      <div style={{ marginTop: '6px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Source: simulated Antarctic mesoscale model · updated every 5s</div>
    </SectionPanel>
  );
}
