import React, { useState } from 'react';
import { StationState } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';
import MetricRow from '../ui/MetricRow';

export default function DigitalTwinView({ state }: { state: StationState }) {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'critical': return 'var(--status-critical)';
      case 'warning': return 'var(--status-warning)';
      case 'offline': return 'var(--status-offline)';
      default: return 'var(--status-normal)';
    }
  };

  const modules = [
    { id: 'power', label: 'Power House', status: state.risk.factors.find(f => f.label === 'POWER')?.status || 'normal' },
    { id: 'habitat', label: 'Habitat', status: state.risk.factors.find(f => f.label === 'ENV')?.status || 'normal' },
    { id: 'lab', label: 'Laboratory', status: 'normal' },
    { id: 'storage', label: 'Storage', status: state.logistics.food_days_remaining < 30 ? 'critical' : 'normal' },
    { id: 'comms', label: 'Communications', status: state.comms.is_blackout ? 'critical' : 'normal' },
    { id: 'fuel', label: 'Fuel Storage', status: state.risk.factors.find(f => f.label === 'FUEL')?.status || 'normal' },
    { id: 'life', label: 'Life Support', status: 'normal' },
  ];

  const renderModuleInfo = () => {
    if (!selectedModule) return <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>Select a module to view telemetry</div>;

    switch (selectedModule) {
      case 'power':
        return (
          <>
            <MetricRow label="Total Load" value={state.power.total_demand_kw.toFixed(1)} unit="kW" />
            <MetricRow label="Generator Status" value={state.power.generators[0]?.status.toUpperCase() || 'OFFLINE'} status={state.power.generators[0]?.status} />
          </>
        );
      case 'habitat':
        return (
          <>
            <MetricRow label="Internal Setpoint" value="21.0" unit="°C" />
            <MetricRow label="Thermal Demand" value={state.power.thermal_demand_kw.toFixed(1)} unit="kW" />
            <MetricRow label="Personnel Count" value={state.personnel_count.toString()} unit="PAX" />
          </>
        );
      case 'lab':
        return <MetricRow label="Science Load" value="10.0" unit="kW" />;
      case 'storage':
        return <MetricRow label="Food Reserve" value={state.logistics.food_days_remaining.toFixed(1)} unit="days" />;
      case 'comms':
        return (
          <>
            <MetricRow label="Link Status" value={state.comms.is_blackout ? 'OFFLINE' : 'CONNECTED'} status={state.comms.is_blackout ? 'critical' : 'normal'} />
            <MetricRow label="Buffered Packets" value={state.comms.buffered_packets.toString()} />
          </>
        );
      case 'fuel':
        return (
          <>
            <MetricRow label="Diesel Volume" value={state.logistics.fuel.diesel_litres.toFixed(0)} unit="L" />
            <MetricRow label="Runway" value={state.logistics.fuel.autonomy_days.toFixed(1)} unit="days" />
          </>
        );
      case 'life':
        return <MetricRow label="Water Reserve" value={state.logistics.potable_water_days.toFixed(1)} unit="days" />;
    }
  };

  const renderSchematic = () => {
    if (state.station_id === 'MAITRI') {
      return (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: 'auto', border: '1px solid var(--surface-border)', backgroundColor: 'var(--surface-base)' }}>
          {/* Stilted structures logic */}
          <line x1="50" y1="150" x2="350" y2="150" stroke="var(--surface-border)" strokeWidth="2" strokeDasharray="4 4" />
          
          <rect x="150" y="70" width="100" height="60" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'habitat')?.status || 'normal')} strokeWidth={selectedModule === 'habitat' ? 2 : 1} onClick={() => setSelectedModule('habitat')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedModule('habitat');}}} tabIndex={0} role="button" aria-label="Habitat module" style={{ cursor: 'pointer' }} />
          <text x="200" y="105" textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontFamily="monospace" pointerEvents="none">HABITAT</text>
          
          <rect x="60" y="90" width="70" height="40" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'power')?.status || 'normal')} strokeWidth={selectedModule === 'power' ? 2 : 1} onClick={() => setSelectedModule('power')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedModule('power');}}} tabIndex={0} role="button" aria-label="Power module" style={{ cursor: 'pointer' }} />
          <text x="95" y="115" textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontFamily="monospace" pointerEvents="none">POWER</text>
          
          <rect x="270" y="90" width="70" height="40" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'lab')?.status || 'normal')} strokeWidth={selectedModule === 'lab' ? 2 : 1} onClick={() => setSelectedModule('lab')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedModule('lab');}}} tabIndex={0} role="button" aria-label="Lab module" style={{ cursor: 'pointer' }} />
          <text x="305" y="115" textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontFamily="monospace" pointerEvents="none">LAB</text>

          <circle cx="100" cy="50" r="15" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'fuel')?.status || 'normal')} strokeWidth={selectedModule === 'fuel' ? 2 : 1} onClick={() => setSelectedModule('fuel')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedModule('fuel');}}} tabIndex={0} role="button" aria-label="Fuel module" style={{ cursor: 'pointer' }} />
          <text x="100" y="53" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none">FUEL</text>

          <rect x="280" y="50" width="40" height="20" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'comms')?.status || 'normal')} strokeWidth={selectedModule === 'comms' ? 2 : 1} onClick={() => setSelectedModule('comms')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedModule('comms');}}} tabIndex={0} role="button" aria-label="Comms module" style={{ cursor: 'pointer' }} />
          <text x="300" y="62" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none">COMMS</text>
          
          <rect x="160" y="40" width="40" height="20" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'life')?.status || 'normal')} strokeWidth={selectedModule === 'life' ? 2 : 1} onClick={() => setSelectedModule('life')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedModule('life');}}} tabIndex={0} role="button" aria-label="Life module" style={{ cursor: 'pointer' }} />
          <text x="180" y="52" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none">LIFE</text>
          
          <rect x="210" y="40" width="40" height="20" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'storage')?.status || 'normal')} strokeWidth={selectedModule === 'storage' ? 2 : 1} onClick={() => setSelectedModule('storage')} onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedModule('storage');}}} tabIndex={0} role="button" aria-label="Storage module" style={{ cursor: 'pointer' }} />
          <text x="230" y="52" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none">STORE</text>

          {/* Connections */}
          <line x1="130" y1="110" x2="150" y2="110" stroke="var(--surface-border)" />
          <line x1="250" y1="110" x2="270" y2="110" stroke="var(--surface-border)" />
          <line x1="100" y1="65" x2="100" y2="90" stroke="var(--surface-border)" />
          <line x1="180" y1="60" x2="180" y2="70" stroke="var(--surface-border)" />
          <line x1="230" y1="60" x2="230" y2="70" stroke="var(--surface-border)" />
          <line x1="300" y1="70" x2="300" y2="90" stroke="var(--surface-border)" />
        </svg>
      );
    } else {
      return (
        <svg viewBox="0 0 400 200" style={{ width: '100%', height: 'auto', border: '1px solid var(--surface-border)', backgroundColor: 'var(--surface-base)' }}>
          {/* Coastal block structure logic */}
          <rect x="40" y="130" width="320" height="40" fill="var(--surface-border)" opacity="0.3" />
          
          <rect x="80" y="70" width="240" height="60" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'habitat')?.status || 'normal')} strokeWidth={selectedModule === 'habitat' ? 2 : 1} onClick={() => setSelectedModule('habitat')} style={{ cursor: 'pointer' }} />
          <text x="200" y="105" textAnchor="middle" fill="var(--text-primary)" fontSize="10" fontFamily="monospace" pointerEvents="none">MAIN COMPLEX (HABITAT / LAB)</text>
          
          <rect x="50" y="80" width="30" height="50" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'power')?.status || 'normal')} strokeWidth={selectedModule === 'power' ? 2 : 1} onClick={() => setSelectedModule('power')} style={{ cursor: 'pointer' }} />
          <text x="65" y="105" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none" transform="rotate(-90 65,105)">POWER</text>
          
          <rect x="320" y="80" width="30" height="50" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'storage')?.status || 'normal')} strokeWidth={selectedModule === 'storage' ? 2 : 1} onClick={() => setSelectedModule('storage')} style={{ cursor: 'pointer' }} />
          <text x="335" y="105" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none" transform="rotate(90 335,105)">STORE</text>

          <circle cx="280" cy="40" r="15" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'comms')?.status || 'normal')} strokeWidth={selectedModule === 'comms' ? 2 : 1} onClick={() => setSelectedModule('comms')} style={{ cursor: 'pointer' }} />
          <text x="280" y="43" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none">VSAT</text>
          
          <rect x="100" y="50" width="40" height="20" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'life')?.status || 'normal')} strokeWidth={selectedModule === 'life' ? 2 : 1} onClick={() => setSelectedModule('life')} style={{ cursor: 'pointer' }} />
          <text x="120" y="62" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none">LIFE</text>

          <rect x="150" y="50" width="40" height="20" fill="var(--surface-panel)" stroke={getStatusColor(modules.find(m => m.id === 'fuel')?.status || 'normal')} strokeWidth={selectedModule === 'fuel' ? 2 : 1} onClick={() => setSelectedModule('fuel')} style={{ cursor: 'pointer' }} />
          <text x="170" y="62" textAnchor="middle" fill="var(--text-primary)" fontSize="8" fontFamily="monospace" pointerEvents="none">FUEL</text>
          
          {/* Invisible LAB overlay for clicking */}
          <rect x="180" y="70" width="140" height="60" fill="transparent" onClick={() => setSelectedModule('lab')} style={{ cursor: 'pointer' }} />
        </svg>
      );
    }
  };

  return (
    <div className="twin-grid">
      <SectionPanel title="Digital Twin Schematic" provenance="sim" subtitle="Maitri stilted · Bharati coastal">
        {renderSchematic()}
      </SectionPanel>
      <SectionPanel title={`Module: ${selectedModule ? modules.find(m => m.id === selectedModule)?.label : '—'}`} provenance="live">
        {renderModuleInfo()}
        <div style={{ marginTop: '8px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Select a module on the schematic · live telemetry · click to focus</div>
      </SectionPanel>
    </div>
  );
}
