/**
 * aurora/frontend/src/lib/constants.ts
 *
 * Station metadata and operational thresholds — frontend mirror of backend config.py.
 * Never hardcode station data anywhere else in the frontend.
 */

import type { StationID, ComponentStatus } from './types';

// ---------------------------------------------------------------------------
// Station metadata
// ---------------------------------------------------------------------------

export interface StationMeta {
  id: StationID;
  name: string;
  shortName: string;
  location: string;
  region: string;
  coordinates: { lat: number; lon: number };
  altitude_m: number;
  yearEstablished: number;
  personnelSummer: number;
  personnelWinter: number;
  isWinterized: boolean;
  operatingOrg: string;
}

export const STATIONS: Record<StationID, StationMeta> = {
  MAITRI: {
    id: 'MAITRI',
    name: 'Maitri',
    shortName: 'MTR',
    location: 'Schirmacher Oasis, Queen Maud Land',
    region: 'East Antarctica',
    coordinates: { lat: -70.7667, lon: 11.7333 },
    altitude_m: 130,
    yearEstablished: 1989,
    personnelSummer: 25,
    personnelWinter: 8,
    isWinterized: true,
    operatingOrg: 'NCPOR / MoES',
  },
  BHARATI: {
    id: 'BHARATI',
    name: 'Bharati',
    shortName: 'BHR',
    location: 'Larsemann Hills, Prydz Bay',
    region: 'East Antarctica',
    coordinates: { lat: -69.4069, lon: 76.1923 },
    altitude_m: 35,
    yearEstablished: 2012,
    personnelSummer: 23,
    personnelWinter: 0,
    isWinterized: false,
    operatingOrg: 'NCPOR / MoES',
  },
};

// ---------------------------------------------------------------------------
// Operational thresholds (mirrors backend THRESHOLDS)
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  fuel: {
    autonomy_warning_days: 30,
    autonomy_critical_days: 14,
    fill_warning_pct: 0.40,
    fill_critical_pct: 0.20,
  },
  power: {
    deficit_warning_kw: 5,
    deficit_critical_kw: 20,
  },
  environment: {
    wind_chill_warning_c: -35,
    wind_chill_critical_c: -50,
    visibility_warning_m: 500,
    visibility_critical_m: 100,
  },
  comms: {
    blackout_warning_s: 300,
    blackout_critical_s: 3600,
  },
  generator: {
    maintenance_warning_h: 4000,
    maintenance_critical_h: 5000,
  },
} as const;

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

export const STATUS_CONFIG: Record<
  ComponentStatus,
  { label: string; colorVar: string; bgColorVar: string }
> = {
  normal:     { label: 'NORMAL',     colorVar: '--status-normal',     bgColorVar: '--status-normal-bg' },
  warning:    { label: 'WARNING',    colorVar: '--status-warning',    bgColorVar: '--status-warning-bg' },
  critical:   { label: 'CRITICAL',   colorVar: '--status-critical',   bgColorVar: '--status-critical-bg' },
  offline:    { label: 'OFFLINE',    colorVar: '--status-offline',    bgColorVar: '--status-offline-bg' },
  degraded:   { label: 'DEGRADED',   colorVar: '--status-degraded',   bgColorVar: '--status-degraded-bg' },
  recovering: { label: 'RECOVERING', colorVar: '--status-recovering', bgColorVar: '--status-recovering-bg' },
};

// ---------------------------------------------------------------------------
// Backend API config
// ---------------------------------------------------------------------------

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/api/ws';

// ---------------------------------------------------------------------------
// Scenario definitions (Phase 5 — listed here for routing/display)
// ---------------------------------------------------------------------------

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  severity: ComponentStatus;
  affectedSystems: string[];
}

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'polar_vortex',
    name: 'Polar Vortex Intensification',
    description: 'Sudden temperature drop to −60 °C with 35 m/s winds, 50 m visibility',
    severity: 'critical',
    affectedSystems: ['environment', 'power', 'logistics'],
  },
  {
    id: 'katabatic_blizzard',
    name: 'Katabatic Blizzard',
    description: 'Katabatic wind surge from plateau, 25–40 m/s, rapid snow accumulation',
    severity: 'warning',
    affectedSystems: ['environment', 'power'],
  },
  {
    id: 'main_gen_failure',
    name: 'Main Generator Failure',
    description: 'GEN-1 trips offline; GEN-2 assumes load; load shedding initiated',
    severity: 'critical',
    affectedSystems: ['power', 'logistics'],
  },
  {
    id: 'satcom_blackout',
    name: 'Sat-Com Blackout',
    description: 'VSAT link loss due to storm; telemetry buffered for replay',
    severity: 'warning',
    affectedSystems: ['comms'],
  },
  {
    id: 'resupply_delay',
    name: 'Resupply Vessel Delay',
    description: 'MV Varalangi delayed +30 days due to sea ice conditions',
    severity: 'warning',
    affectedSystems: ['logistics'],
  },
  {
    id: 'renewable_boost',
    name: 'Renewable Energy Boost',
    description: 'Clear-sky conditions; solar + wind covering 40% of demand',
    severity: 'normal',
    affectedSystems: ['power'],
  },
];
