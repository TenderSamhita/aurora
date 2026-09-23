/**
 * aurora/frontend/src/lib/types.ts
 *
 * TypeScript interfaces mirroring all Pydantic backend models.
 * Keep in sync with aurora/backend/app/models/*.py
 *
 * These are pure data types — no methods, no classes.
 * All computed fields (deficit_kw, autonomy_days, etc.) are included
 * because FastAPI serializes them as regular JSON fields.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type StationID = 'MAITRI' | 'BHARATI';

export type ComponentStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'offline'
  | 'degraded'
  | 'recovering';

export type TelemetrySource = 'live' | 'replay' | 'scenario' | 'initial';

export type OperationalMode = 'normal' | 'emergency' | 'reduced' | 'evacuation' | 'standby';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export interface EnvironmentalConditions {
  temperature_c: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  wind_chill_c: number;
  relative_humidity_pct: number;
  pressure_hpa: number;
  visibility_m: number;
  snow_accumulation_mm: number;
  solar_irradiance_wm2: number;
  blizzard_probability: number;
}

// ---------------------------------------------------------------------------
// Energy
// ---------------------------------------------------------------------------

export interface GeneratorState {
  generator_id: string;
  status: ComponentStatus;
  rated_kw: number;
  output_kw: number;
  fuel_consumption_lph: number;
  runtime_hours_total: number;
  hours_since_maintenance: number;
  // computed fields from backend
  load_pct: number;
}

export interface PowerState {
  total_demand_kw: number;
  thermal_demand_kw: number;
  base_load_kw: number;
  generators: GeneratorState[];
  solar_output_kw: number;
  wind_output_kw: number;
  load_shedding_active: boolean;
  shed_loads_kw: number;
  // computed fields from backend
  generator_output_kw: number;
  total_supply_kw: number;
  deficit_kw: number;
  total_fuel_consumption_lph: number;
}

// ---------------------------------------------------------------------------
// Logistics
// ---------------------------------------------------------------------------

export interface FuelState {
  diesel_litres: number;
  diesel_capacity_litres: number;
  consumption_rate_lph: number;
  last_resupply_date: string | null;
  last_resupply_volume_litres: number | null;
  // computed fields from backend
  fill_pct: number;
  autonomy_days: number;
}

export type ResupplyStatus =
  | 'scheduled'
  | 'en_route'
  | 'delivered'
  | 'delayed'
  | 'cancelled';

export interface ResupplyEvent {
  vessel_name: string;
  cargo_type: string;
  scheduled_date: string | null;
  actual_date: string | null;
  fuel_litres: number | null;
  food_kg: number | null;
  status: ResupplyStatus;
  delay_days: number;
}

export interface SupplyState {
  fuel: FuelState;
  food_days_remaining: number;
  medical_supplies_days: number;
  potable_water_days: number;
  next_resupply: ResupplyEvent | null;
  resupply_history: ResupplyEvent[];
  // computed fields from backend
  most_critical_supply_days: number;
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

export interface RiskFactor {
  name: string;
  label: string;
  status: ComponentStatus;
  value: number;
  threshold_warning: number;
  threshold_critical: number;
  unit: string;
  direction: 'below' | 'above';
}

export interface RiskAssessment {
  overall: ComponentStatus;
  factors: RiskFactor[];
  evacuation_recommended: boolean;
  last_evaluated: string; // ISO datetime
}

// ---------------------------------------------------------------------------
// Station
// ---------------------------------------------------------------------------

export interface CommsStatus {
  satellite_link: ComponentStatus;
  vsat_uplink_mbps: number;
  last_contact: string; // ISO datetime
  blackout_duration_s: number;
  buffered_packets: number;
  is_blackout: boolean;
}

export interface StationState {
  station_id: StationID;
  station_name: string;
  timestamp: string; // ISO datetime
  operational_mode: OperationalMode;
  personnel_count: number;
  environment: EnvironmentalConditions;
  power: PowerState;
  logistics: SupplyState;
  risk: RiskAssessment;
  comms: CommsStatus;
  scenario_active: string | null;
  simulation_speed: number;
}

// ---------------------------------------------------------------------------
// Telemetry (WebSocket wire format)
// ---------------------------------------------------------------------------

export interface TelemetryPacket {
  packet_id: string;
  station_id: StationID;
  timestamp: string; // ISO datetime
  sequence: number;
  state: StationState;
  is_buffered: boolean;
  source: TelemetrySource;
}

// ---------------------------------------------------------------------------
// REST: Station list item
// ---------------------------------------------------------------------------

export interface StationListItem {
  id: StationID;
  name: string;
  location: string;
  coordinates: { lat: number; lon: number };
  altitude_m: number;
  year_established: number;
  personnel_summer: number;
  personnel_winter: number;
  operational_mode: OperationalMode;
  personnel_count: number;
  comms_status: ComponentStatus;
  risk_overall: ComponentStatus;
}

// ---------------------------------------------------------------------------
// WebSocket client hook state
// ---------------------------------------------------------------------------

export type WSConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type LinkStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'SYNCING';

export interface SyncStatus {
  station_id: StationID;
  edge_sequence: number;
  hq_sequence: number;
  edge_timestamp: string;
  hq_timestamp: string;
  is_blackout: boolean;
  is_syncing: boolean;
  link_status: LinkStatus;
  buffered_packets: number;
  db_buffered: number;
  blackout_duration_s: number;
  last_sync_duration_s: number;
  last_sync_buffered: number;
  last_sync_timestamp: string | null;
  staleness_s: number;
  // optional hq/edge timestamps for staleness
  was_blackout?: boolean;
}

export interface StationSocketState {
  connectionStatus: WSConnectionStatus;
  stationState: StationState | null; // HQ (cloud) state – stale during blackout
  edgeState: StationState | null; // EDGE live state (when available)
  lastPacket: TelemetryPacket | null;
  lastSequence: number;
  error: string | null;
  isBufferedReplay: boolean;
  linkStatus: LinkStatus;
  isStale: boolean;
  syncStatus: SyncStatus | null;
  syncProgress: { isSyncing: boolean; buffered: number; lastSyncBuffered: number; lastSyncDuration: number; lastSyncTimestamp: string | null } | null;
}
