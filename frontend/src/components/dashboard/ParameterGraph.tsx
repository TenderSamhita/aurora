import React from 'react';
import { StationState } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';

export default function ParameterGraph({ state }: { state: StationState }) {
  // Extract values
  const envTemp = state.environment.temperature_c.toFixed(1);
  const wind = state.environment.wind_speed_ms.toFixed(1);
  const qHeat = state.power.thermal_demand_kw.toFixed(1);
  const pTotal = state.power.total_demand_kw.toFixed(1);
  const fRate = state.logistics.fuel.consumption_rate_lph.toFixed(1);
  const fuel = state.logistics.fuel.diesel_litres.toFixed(0);
  const runway = state.logistics.fuel.autonomy_days.toFixed(1);
  const risk = state.risk.overall.toUpperCase();

  const Node = ({ title, value, unit, status }: { title: string, value: string, unit?: string, status?: string }) => {
    const color = status ? `var(--status-${status})` : 'var(--text-primary)';
    return (
      <div style={{
        border: '1px solid var(--surface-border)',
        padding: '6px 8px',
        backgroundColor: 'var(--surface-base)',
        minWidth: '0',
        flex: '1 1 110px',
        maxWidth: '160px',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: '12px', color: color, fontFamily: 'var(--font-mono)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {value} {unit && <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span>}
        </div>
      </div>
    );
  };

  const Arrow = () => (
    <div style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 2px' }}>
      →
    </div>
  );

  return (
    <SectionPanel title="Parameter Cascade" provenance="calc" subtitle="thermal → power → fuel → runway → risk">
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '8px 0' }}>
        <Node title="Environment" value={`${envTemp}`} unit="°C" />
        <Arrow />
        <Node title="Thermal" value={qHeat} unit="kW" />
        <Arrow />
        <Node title="Power" value={pTotal} unit="kW" />
        <Arrow />
        <Node title="Fuel" value={fRate} unit="L/h" />
        <Arrow />
        <Node title="Runway" value={runway} unit="days" />
        <Arrow />
        <Node title="Risk" value={risk} status={state.risk.overall} />
      </div>
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '4px' }}>Calculated from physics · not direct sensor readings · provenance: calc</div>
    </SectionPanel>
  );
}
