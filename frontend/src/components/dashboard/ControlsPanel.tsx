import React, { useState } from 'react';
import { StationID } from '@/lib/types';
import { API_BASE_URL } from '@/lib/constants';
import SectionPanel from '../ui/SectionPanel';

const SCENARIOS = [
  { id: 'polar_vortex', label: 'Polar Vortex' },
  { id: 'katabatic_blizzard', label: 'Katabatic Blizzard' },
  { id: 'generator_failure', label: 'Generator Failure' },
  { id: 'satcom_blackout', label: 'Satcom Blackout' },
  { id: 'resupply_delay', label: 'Resupply Delay' },
  { id: 'renewable_boost', label: 'Renewable Boost' }
];

export default function ControlsPanel({ stationId, activeScenario }: { stationId: StationID, activeScenario: string | null }) {
  const [loading, setLoading] = useState(false);

  const setScenario = async (scenario: string | null) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/station/${stationId}/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
    } catch (err) {
      console.error('Failed to set scenario:', err);
    }
    setLoading(false);
  };

  return (
    <SectionPanel title="Simulation Controls" provenance="sim" subtitle={activeScenario ? `active: ${activeScenario}` : 'no active scenario'}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {SCENARIOS.map((s) => {
          const isActive = activeScenario === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setScenario(isActive ? null : s.id)}
              disabled={loading}
              aria-pressed={isActive}
              tabIndex={0}
              style={{
                padding: '6px 8px',
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                backgroundColor: isActive ? 'var(--accent-dim)' : 'var(--surface-raised)',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--surface-border)'}`,
                cursor: loading ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                letterSpacing: '0.04em',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {s.label.toUpperCase()}
            </button>
          );
        })}
        {activeScenario && (
          <button
            onClick={() => setScenario(null)}
            disabled={loading}
            tabIndex={0}
            style={{
              gridColumn: '1 / -1',
              padding: '6px 8px',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              backgroundColor: 'var(--surface-panel)',
              color: 'var(--text-primary)',
              border: '1px solid var(--surface-border)',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            CLEAR SCENARIO
          </button>
        )}
      </div>
      <div style={{ marginTop: '8px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Operator-initiated · scenario engine · simulated</div>
    </SectionPanel>
  );
}
