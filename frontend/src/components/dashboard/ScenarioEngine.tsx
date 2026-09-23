import React, { useState } from 'react';
import { StationID, StationState } from '@/lib/types';
import { API_BASE_URL } from '@/lib/constants';
import SectionPanel from '../ui/SectionPanel';

const SCENARIOS = [
  {
    id: 'polar_vortex',
    name: 'POLAR VORTEX',
    desc: 'Extreme temperature drop — tests thermal envelope',
    params: 'Temperature → -55°C',
    cascade: 'Thermal Demand → HVAC Load → Generator Load → Fuel Consumption → Runway → Risk',
    affected: ['ENV', 'POWER', 'FUEL', 'RISK'],
  },
  {
    id: 'katabatic_blizzard',
    name: 'KATABATIC BLIZZARD',
    desc: 'Extreme katabatic wind surge — tests structural & power resilience',
    params: 'Wind → 90 knots (46.3 m/s)',
    cascade: 'Thermal Loss → Power Demand → Structural / Environmental Risk → Load Shedding',
    affected: ['ENV', 'POWER', 'STRUCTURAL', 'RISK'],
  },
  {
    id: 'generator_failure',
    name: 'MAIN GENERATOR FAILURE',
    desc: 'Primary genset trip — tests redundancy & shedding logic',
    params: 'Generator 1 → Inactive (OFFLINE)',
    cascade: 'Available Capacity → Load Shedding → Power Risk → Overall Risk',
    affected: ['POWER', 'FUEL', 'RISK'],
  },
  {
    id: 'satcom_blackout',
    name: 'SAT-COM BLACKOUT',
    desc: 'VSAT link loss — tests offline buffering & replay',
    params: 'Communications → Offline',
    cascade: 'Cached Telemetry Mode → Local State Storage → Synchronization After Restoration',
    affected: ['COMMS', 'TELEMETRY'],
  },
  {
    id: 'resupply_delay',
    name: 'RESUPPLY DELAY',
    desc: 'Logistics vessel delayed — tests runway vs arrival window',
    params: 'Ship Arrival Time → +30 days (Delayed)',
    cascade: 'Fuel Runway vs Arrival Window → Logistics Risk → Critical Alert',
    affected: ['LOGISTICS', 'FUEL', 'RISK'],
  },
  {
    id: 'renewable_boost',
    name: 'RENEWABLE ENERGY BOOST',
    desc: 'Optimal renewables — tests fuel offset & emissions',
    params: 'Renewable Contribution → +70 kW (Solar 20 + Wind 50)',
    cascade: 'Generator Load → Fuel Consumption → Runway → Emissions Estimate',
    affected: ['POWER', 'FUEL', 'EMISSIONS'],
  }
];

export default function ScenarioEngine({ stationId, currentState }: { stationId: StationID, currentState: StationState }) {
  const [baselineState, setBaselineState] = useState<StationState | null>(null);
  const [showCompare, setShowCompare] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeScenario = currentState.scenario_active;
  const activeScenarioDef = SCENARIOS.find(s => s.id === activeScenario);

  const applyScenario = async (scenario: string) => {
    setError(null);
    // retain baseline before first apply
    if (!activeScenario && !baselineState) {
      setBaselineState(currentState);
      setShowCompare(true);
    }
    if (!baselineState) {
      setBaselineState(currentState);
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/station/${stationId}/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0,120)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Scenario apply failed · ${msg} · check backend /api/station/${stationId}/scenario`);
      console.error('[SCENARIO] apply failed', err);
    }
    setLoading(false);
  };

  const resetScenario = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/station/${stationId}/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShowCompare(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Reset failed · ${msg}`);
      console.error('[SCENARIO] reset failed', err);
    }
    setLoading(false);
  };

  const clearBaseline = () => {
    setBaselineState(null);
    setShowCompare(false);
  };

  const formatDiff = (curr: number, base: number, unit = '') => {
    const d = curr - base;
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}${unit ? ' ' + unit : ''}`;
  };

  const getRiskColor = (status: string) => {
    switch(status) {
      case 'critical': return 'var(--status-critical)';
      case 'warning': return 'var(--status-warning)';
      case 'offline': return 'var(--status-offline)';
      default: return 'var(--status-normal)';
    }
  };

  const renderComparison = () => {
    if (!baselineState || !activeScenario || !showCompare) return null;

    // Calculate emissions estimate: 2.68 kg CO2 per litre diesel
    const baseEmissions = baselineState.logistics.fuel.consumption_rate_lph * 24 * 2.68;
    const scenEmissions = currentState.logistics.fuel.consumption_rate_lph * 24 * 2.68;

    const metrics = [
      {
        label: 'Temperature',
        base: `${baselineState.environment.temperature_c.toFixed(1)} °C`,
        scen: `${currentState.environment.temperature_c.toFixed(1)} °C`,
        diff: formatDiff(currentState.environment.temperature_c, baselineState.environment.temperature_c, '°C'),
        rawDiff: currentState.environment.temperature_c - baselineState.environment.temperature_c,
      },
      {
        label: 'Wind Speed',
        base: `${baselineState.environment.wind_speed_ms.toFixed(1)} m/s`,
        scen: `${currentState.environment.wind_speed_ms.toFixed(1)} m/s`,
        diff: formatDiff(currentState.environment.wind_speed_ms, baselineState.environment.wind_speed_ms, 'm/s'),
        rawDiff: currentState.environment.wind_speed_ms - baselineState.environment.wind_speed_ms,
      },
      {
        label: 'Wind Chill',
        base: `${baselineState.environment.wind_chill_c.toFixed(1)} °C`,
        scen: `${currentState.environment.wind_chill_c.toFixed(1)} °C`,
        diff: formatDiff(currentState.environment.wind_chill_c, baselineState.environment.wind_chill_c, '°C'),
        rawDiff: currentState.environment.wind_chill_c - baselineState.environment.wind_chill_c,
      },
      {
        label: 'Heating Load',
        base: `${baselineState.power.thermal_demand_kw.toFixed(2)} kW`,
        scen: `${currentState.power.thermal_demand_kw.toFixed(2)} kW`,
        diff: formatDiff(currentState.power.thermal_demand_kw, baselineState.power.thermal_demand_kw, 'kW'),
        rawDiff: currentState.power.thermal_demand_kw - baselineState.power.thermal_demand_kw,
      },
      {
        label: 'Total Power',
        base: `${baselineState.power.total_demand_kw.toFixed(1)} kW`,
        scen: `${currentState.power.total_demand_kw.toFixed(1)} kW`,
        diff: formatDiff(currentState.power.total_demand_kw, baselineState.power.total_demand_kw, 'kW'),
        rawDiff: currentState.power.total_demand_kw - baselineState.power.total_demand_kw,
      },
      {
        label: 'Gen Output',
        base: `${baselineState.power.generator_output_kw.toFixed(1)} kW`,
        scen: `${currentState.power.generator_output_kw.toFixed(1)} kW`,
        diff: formatDiff(currentState.power.generator_output_kw, baselineState.power.generator_output_kw, 'kW'),
        rawDiff: currentState.power.generator_output_kw - baselineState.power.generator_output_kw,
      },
      {
        label: 'Solar / Wind',
        base: `${baselineState.power.solar_output_kw.toFixed(1)} / ${baselineState.power.wind_output_kw.toFixed(1)} kW`,
        scen: `${currentState.power.solar_output_kw.toFixed(1)} / ${currentState.power.wind_output_kw.toFixed(1)} kW`,
        diff: `${formatDiff(currentState.power.solar_output_kw + currentState.power.wind_output_kw, baselineState.power.solar_output_kw + baselineState.power.wind_output_kw, 'kW')}`,
        rawDiff: (currentState.power.solar_output_kw + currentState.power.wind_output_kw) - (baselineState.power.solar_output_kw + baselineState.power.wind_output_kw),
      },
      {
        label: 'Fuel Burn',
        base: `${baselineState.logistics.fuel.consumption_rate_lph.toFixed(2)} L/h`,
        scen: `${currentState.logistics.fuel.consumption_rate_lph.toFixed(2)} L/h`,
        diff: formatDiff(currentState.logistics.fuel.consumption_rate_lph, baselineState.logistics.fuel.consumption_rate_lph, 'L/h'),
        rawDiff: currentState.logistics.fuel.consumption_rate_lph - baselineState.logistics.fuel.consumption_rate_lph,
      },
      {
        label: 'Fuel Runway',
        base: `${baselineState.logistics.fuel.autonomy_days.toFixed(1)} days`,
        scen: `${currentState.logistics.fuel.autonomy_days.toFixed(1)} days`,
        diff: formatDiff(currentState.logistics.fuel.autonomy_days, baselineState.logistics.fuel.autonomy_days, 'd'),
        rawDiff: currentState.logistics.fuel.autonomy_days - baselineState.logistics.fuel.autonomy_days,
      },
      {
        label: 'Diesel Remaining',
        base: `${baselineState.logistics.fuel.diesel_litres.toFixed(0)} L`,
        scen: `${currentState.logistics.fuel.diesel_litres.toFixed(0)} L`,
        diff: formatDiff(currentState.logistics.fuel.diesel_litres, baselineState.logistics.fuel.diesel_litres, 'L'),
        rawDiff: currentState.logistics.fuel.diesel_litres - baselineState.logistics.fuel.diesel_litres,
      },
      {
        label: 'Resupply Status',
        base: `${baselineState.logistics.next_resupply?.status.toUpperCase() || 'NONE'}${baselineState.logistics.next_resupply?.delay_days ? ` (+${baselineState.logistics.next_resupply.delay_days}d)` : ''}`,
        scen: `${currentState.logistics.next_resupply?.status.toUpperCase() || 'NONE'}${currentState.logistics.next_resupply?.delay_days ? ` (+${currentState.logistics.next_resupply.delay_days}d)` : ''}`,
        diff: baselineState.logistics.next_resupply?.status !== currentState.logistics.next_resupply?.status ? 'CHANGED' : 'SAME',
        rawDiff: 0,
      },
      {
        label: 'Comms / Buffered',
        base: `${baselineState.comms.is_blackout ? 'BLACKOUT' : 'ONLINE'} (${baselineState.comms.buffered_packets})`,
        scen: `${currentState.comms.is_blackout ? 'BLACKOUT' : 'ONLINE'} (${currentState.comms.buffered_packets})`,
        diff: baselineState.comms.is_blackout !== currentState.comms.is_blackout ? (currentState.comms.is_blackout ? 'LOST' : 'RESTORED') : 'SAME',
        rawDiff: 0,
      },
      {
        label: 'Load Shedding',
        base: baselineState.power.load_shedding_active ? `ACTIVE (${baselineState.power.shed_loads_kw.toFixed(1)} kW)` : 'INACTIVE',
        scen: currentState.power.load_shedding_active ? `ACTIVE (${currentState.power.shed_loads_kw.toFixed(1)} kW)` : 'INACTIVE',
        diff: baselineState.power.load_shedding_active !== currentState.power.load_shedding_active ? (currentState.power.load_shedding_active ? 'TRIGGERED' : 'CLEARED') : 'SAME',
        rawDiff: 0,
      },
      {
        label: 'Emissions (est.)',
        base: `${baseEmissions.toFixed(0)} kg CO₂/day`,
        scen: `${scenEmissions.toFixed(0)} kg CO₂/day`,
        diff: formatDiff(scenEmissions, baseEmissions, 'kg/d'),
        rawDiff: scenEmissions - baseEmissions,
      },
      {
        label: 'Overall Risk',
        base: baselineState.risk.overall.toUpperCase(),
        scen: currentState.risk.overall.toUpperCase(),
        diff: currentState.risk.overall !== baselineState.risk.overall ? 'CHANGED' : 'SAME',
        rawDiff: 0,
      }
    ];

    return (
      <div style={{ marginTop: '12px', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--surface-border)' }}>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', letterSpacing: '0.06em' }}>BASELINE COMPARISON</span>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{baselineState.timestamp ? new Date(baselineState.timestamp).toLocaleTimeString() : ''} → {new Date(currentState.timestamp).toLocaleTimeString()}</span>
        </div>
        <table style={{ width: '100%', fontSize: '11px', fontFamily: 'var(--font-mono)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--surface-border)', textAlign: 'left', color: 'var(--text-muted)', backgroundColor: 'var(--surface-panel)' }}>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Metric</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Baseline</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Scenario</th>
              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => {
              const isPositive = m.rawDiff > 0.01;
              const isNegative = m.rawDiff < -0.01;
              // For fuel runway, negative is bad (less days), for fuel burn positive is bad
              let changeColor = 'var(--text-muted)';
              if (m.label === 'Fuel Runway' || m.label === 'Diesel Remaining') {
                changeColor = isNegative ? 'var(--status-critical)' : isPositive ? 'var(--status-normal)' : 'var(--text-muted)';
              } else if (m.label === 'Fuel Burn' || m.label === 'Heating Load' || m.label === 'Total Power') {
                changeColor = isPositive ? 'var(--status-warning)' : isNegative ? 'var(--status-normal)' : 'var(--text-muted)';
              } else if (m.label === 'Temperature' || m.label === 'Wind Chill') {
                changeColor = isNegative ? 'var(--status-critical)' : 'var(--text-muted)';
              } else if (m.label === 'Overall Risk') {
                changeColor = m.diff === 'CHANGED' ? 'var(--status-warning)' : 'var(--text-muted)';
              } else {
                changeColor = m.rawDiff !== 0 ? 'var(--accent)' : 'var(--text-muted)';
              }
              return (
                <tr key={m.label} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.label}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{m.base}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 500 }}>{m.scen}</td>
                  <td style={{ padding: '6px 8px', color: changeColor, fontWeight: 600 }}>{m.diff}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '6px 8px', fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', backgroundColor: 'var(--surface-raised)', borderTop: '1px solid var(--surface-border)' }}>
          Emissions est. = Fuel burn × 2.68 kg CO₂/L × 24h · Runway = Diesel / (Burn × 24)
        </div>
      </div>
    );
  };

  const renderActiveDetails = () => {
    if (!activeScenarioDef || !baselineState) return null;
    // Calculate derived deltas for display
    const tempDelta = (currentState.environment.temperature_c - baselineState.environment.temperature_c).toFixed(1);
    const windDelta = (currentState.environment.wind_speed_ms - baselineState.environment.wind_speed_ms).toFixed(1);
    const thermalDelta = (currentState.power.thermal_demand_kw - baselineState.power.thermal_demand_kw).toFixed(2);
    const powerDelta = (currentState.power.total_demand_kw - baselineState.power.total_demand_kw).toFixed(1);
    const fuelDelta = (currentState.logistics.fuel.consumption_rate_lph - baselineState.logistics.fuel.consumption_rate_lph).toFixed(2);
    const runwayDelta = (currentState.logistics.fuel.autonomy_days - baselineState.logistics.fuel.autonomy_days).toFixed(1);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ backgroundColor: 'var(--surface-raised)', padding: '8px', border: '1px solid var(--surface-border)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.08em', marginBottom: '4px' }}>CHANGED PARAMETERS</div>
            <div style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {activeScenario === 'polar_vortex' && <>Temp: {baselineState.environment.temperature_c.toFixed(1)} → <span style={{ color: 'var(--status-critical)' }}>{currentState.environment.temperature_c.toFixed(1)} °C ({tempDelta}°C)</span></>}
              {activeScenario === 'katabatic_blizzard' && <>Wind: {baselineState.environment.wind_speed_ms.toFixed(1)} → <span style={{ color: 'var(--status-warning)' }}>{currentState.environment.wind_speed_ms.toFixed(1)} m/s ({windDelta})</span><br/>Visibility: {baselineState.environment.visibility_m.toFixed(0)} → {currentState.environment.visibility_m.toFixed(0)} m</>}
              {activeScenario === 'generator_failure' && <>GEN-1: NORMAL → <span style={{ color: 'var(--status-critical)' }}>{currentState.power.generators[0]?.status.toUpperCase()}</span><br/>Output: {baselineState.power.generators[0]?.output_kw.toFixed(1)} → {currentState.power.generators[0]?.output_kw.toFixed(1)} kW</>}
              {activeScenario === 'satcom_blackout' && <>Link: ONLINE → <span style={{ color: 'var(--status-critical)' }}>BLACKOUT</span><br/>Buffered: {currentState.comms.buffered_packets} pkts<br/>Duration: {currentState.comms.blackout_duration_s.toFixed(0)}s</>}
              {activeScenario === 'resupply_delay' && <>Resupply: SCHEDULED → <span style={{ color: 'var(--status-warning)' }}>{currentState.logistics.next_resupply?.status.toUpperCase()} (+{currentState.logistics.next_resupply?.delay_days}d)</span><br/>Vessel: {currentState.logistics.next_resupply?.vessel_name}</>}
              {activeScenario === 'renewable_boost' && <>Solar: {baselineState.power.solar_output_kw.toFixed(1)} → <span style={{ color: 'var(--status-normal)' }}>{currentState.power.solar_output_kw.toFixed(1)} kW</span><br/>Wind: {baselineState.power.wind_output_kw.toFixed(1)} → {currentState.power.wind_output_kw.toFixed(1)} kW</>}
              {activeScenario && !['polar_vortex','katabatic_blizzard','generator_failure','satcom_blackout','resupply_delay','renewable_boost'].includes(activeScenario) && <>{activeScenarioDef.params}</>}
            </div>
          </div>
          <div style={{ backgroundColor: 'var(--surface-raised)', padding: '8px', border: '1px solid var(--surface-border)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.08em', marginBottom: '4px' }}>RESULTING CHANGES</div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Thermal: {thermalDelta} kW<br/>
              Power: {powerDelta} kW<br/>
              Fuel: {fuelDelta} L/h<br/>
              Runway: {runwayDelta} days
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface-raised)', padding: '8px', border: '1px solid var(--surface-border)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.08em' }}>CURRENT RISK</span>
            <span style={{ color: getRiskColor(currentState.risk.overall), fontWeight: 700, fontSize: '11px' }}>{currentState.risk.overall.toUpperCase()}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {currentState.risk.factors.map(f => (
              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{f.label} {f.value.toFixed(1)}{f.unit}</span>
                <span style={{ color: getRiskColor(f.status), fontWeight: 600 }}>{f.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
          {currentState.risk.evacuation_recommended && <div style={{ marginTop: '6px', color: 'var(--status-critical)', fontWeight: 700 }}>EVACUATION RECOMMENDED</div>}
        </div>

        <div style={{ backgroundColor: 'var(--surface-raised)', padding: '8px', border: '1px solid var(--surface-border)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.08em', marginBottom: '4px' }}>AFFECTED SYSTEMS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {activeScenarioDef.affected.map(sys => (
              <span key={sys} style={{ padding: '2px 6px', backgroundColor: 'var(--surface-panel)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>{sys}</span>
            ))}
          </div>
          <div style={{ marginTop: '6px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Cascade: {activeScenarioDef.cascade}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="scenarios" className="scenario-engine-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '8px' }}>
          <h2 style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: 0, letterSpacing: '0.08em' }}>STRESS TEST SCENARIOS</h2>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{SCENARIOS.length} SCENARIOS</span>
        </div>
        {SCENARIOS.map(s => {
          const isActive = activeScenario === s.id;
          return (
            <SectionPanel key={s.id} title={s.name} subtitle={s.desc} status={isActive ? 'warning' : undefined} compact>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.5 }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Parameters Affected:</strong> {s.params}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Expected Cascade:</strong> {s.cascade}</div>
                <div style={{ marginTop: '4px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {s.affected.map(a => (
                    <span key={a} style={{ fontSize: '9px', padding: '1px 4px', backgroundColor: 'var(--surface-raised)', border: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>{a}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => applyScenario(s.id)}
                  disabled={loading || isActive}
                  style={{
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: isActive ? 'var(--accent-dim)' : 'var(--surface-raised)',
                    color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--surface-border)'}`,
                    cursor: isActive || loading ? 'not-allowed' : 'pointer',
                    opacity: isActive ? 0.6 : 1,
                    letterSpacing: '0.04em'
                  }}
                >
                  {isActive ? 'ACTIVE' : 'APPLY'}
                </button>
                {isActive && <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', alignSelf: 'center' }}>● ACTIVE SCENARIO</span>}
              </div>
            </SectionPanel>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionPanel title="ACTIVE SCENARIO" status={activeScenario ? 'warning' : error ? 'critical' : 'normal'} provenance={activeScenario ? 'sim' : undefined}>
          {error && (
            <div style={{ marginBottom: '12px', padding: '8px', backgroundColor: 'var(--status-critical-bg)', border: '1px solid var(--status-critical)', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--status-critical)' }} role="alert">
              <div style={{ fontWeight: 600 }}>Scenario error</div>
              <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>{error}</div>
              <button onClick={() => setError(null)} style={{ marginTop: '6px', fontSize: '10px', fontFamily: 'var(--font-mono)', backgroundColor: 'transparent', border: '1px solid var(--status-critical)', color: 'var(--status-critical)', padding: '2px 6px', cursor: 'pointer' }}>Dismiss</button>
            </div>
          )}
          {activeScenarioDef ? (
            <>
              <h3 style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--status-warning)', margin: '0 0 8px 0', letterSpacing: '0.06em' }}>{activeScenarioDef.name}</h3>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '12px' }}>{activeScenarioDef.desc}</div>
              
              {renderActiveDetails()}

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={resetScenario}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: 'var(--surface-panel)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--surface-border)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.06em'
                  }}
                >
                  RESET
                </button>
                <button
                  onClick={() => setShowCompare(!showCompare)}
                  disabled={!baselineState}
                  style={{
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: showCompare ? 'var(--accent-dim)' : 'var(--surface-panel)',
                    color: showCompare ? 'var(--accent)' : 'var(--text-primary)',
                    border: `1px solid ${showCompare ? 'var(--accent)' : 'var(--surface-border)'}`,
                    cursor: !baselineState || loading ? 'not-allowed' : 'pointer',
                    opacity: !baselineState ? 0.5 : 1,
                    letterSpacing: '0.06em'
                  }}
                >
                  {showCompare ? 'HIDE BASELINE' : 'COMPARE WITH BASELINE'}
                </button>
                {baselineState && (
                  <button
                    onClick={clearBaseline}
                    style={{
                      padding: '8px 12px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      border: '1px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    CLEAR
                  </button>
                )}
              </div>

              {baselineState && showCompare && renderComparison()}
            </>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              <div style={{ fontSize: '12px', letterSpacing: '0.08em', marginBottom: '8px' }}>NO SCENARIO ACTIVE</div>
              <div>Select a scenario on the left and click APPLY.</div>
              <div style={{ marginTop: '8px' }}>The simulation engine will run the physics cascade and the UI will update via WebSocket with the resulting state.</div>
              {baselineState && <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Baseline retained from {new Date(baselineState.timestamp).toLocaleTimeString()} — ready to compare next scenario.</div>}
            </div>
          )}
        </SectionPanel>

        {baselineState && !activeScenario && (
          <SectionPanel title="BASELINE RETAINED" status="normal" compact>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Baseline captured at {new Date(baselineState.timestamp).toLocaleTimeString()}<br/>
              Temp {baselineState.environment.temperature_c.toFixed(1)}°C · Wind {baselineState.environment.wind_speed_ms.toFixed(1)} m/s · Power {baselineState.power.total_demand_kw.toFixed(1)} kW · Burn {baselineState.logistics.fuel.consumption_rate_lph.toFixed(1)} L/h · Runway {baselineState.logistics.fuel.autonomy_days.toFixed(1)}d · Risk {baselineState.risk.overall.toUpperCase()}
            </div>
          </SectionPanel>
        )}
      </div>
    </div>
  );
}
