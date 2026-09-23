import React from 'react';
import { SupplyState, ComponentStatus } from '@/lib/types';
import SectionPanel from '../ui/SectionPanel';
import MetricRow from '../ui/MetricRow';

export default function LogisticsCard({ logistics, status }: { logistics: SupplyState, status: ComponentStatus }) {
  return (
    <SectionPanel title="Logistics" status={status} provenance="calc">
      <MetricRow label="Fuel Remaining" value={logistics.fuel.diesel_litres.toFixed(0)} unit="L" />
      <MetricRow label="Fuel Runway" value={logistics.fuel.autonomy_days.toFixed(1)} unit="days" />
      <MetricRow label="Water Reserve" value={logistics.potable_water_days.toFixed(1)} unit="days" />
      <MetricRow label="Food Reserve" value={logistics.food_days_remaining.toFixed(1)} unit="days" />
      <MetricRow 
        label="Resupply Status" 
        value={logistics.next_resupply?.status.toUpperCase() || 'NONE'} 
        status={logistics.next_resupply?.status === 'delayed' ? 'warning' : 'normal'} 
      />
      <div style={{ marginTop: '6px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Runway = diesel / (burn × 24) · resupply window {logistics.next_resupply?.scheduled_date || 'TBD'}</div>
    </SectionPanel>
  );
}
