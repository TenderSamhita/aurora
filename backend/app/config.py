"""
aurora/backend/app/config.py

Station constants, operational thresholds, and physics constants.
Single source of truth — never duplicate these values in other modules.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Dict


# ---------------------------------------------------------------------------
# Station identifiers
# ---------------------------------------------------------------------------

class StationID(str, Enum):
    MAITRI = "MAITRI"
    BHARATI = "BHARATI"


# ---------------------------------------------------------------------------
# Station metadata
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StationMeta:
    id: StationID
    name: str
    location_description: str
    latitude: float          # decimal degrees, negative = south
    longitude: float         # decimal degrees
    altitude_m: float
    year_established: int
    personnel_summer: int
    personnel_winter: int    # 0 = not winterized
    floor_area_m2: float     # approximate heated floor area
    insulation_r_value: float  # approximate thermal resistance (m²·K/W)


STATION_META: Dict[StationID, StationMeta] = {
    StationID.MAITRI: StationMeta(
        id=StationID.MAITRI,
        name="Maitri",
        location_description="Schirmacher Oasis, Queen Maud Land, East Antarctica",
        latitude=-70.7667,
        longitude=11.7333,
        altitude_m=130.0,
        year_established=1989,
        personnel_summer=25,
        personnel_winter=8,
        floor_area_m2=1800.0,
        insulation_r_value=4.5,
    ),
    StationID.BHARATI: StationMeta(
        id=StationID.BHARATI,
        name="Bharati",
        location_description="Larsemann Hills, Prydz Bay, East Antarctica",
        latitude=-69.4069,
        longitude=76.1923,
        altitude_m=35.0,
        year_established=2012,
        personnel_summer=23,
        personnel_winter=0,  # not permanently winterized
        floor_area_m2=2200.0,
        insulation_r_value=5.2,
    ),
}


# ---------------------------------------------------------------------------
# Operational thresholds
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class OperationalThresholds:
    # Fuel
    fuel_warning_pct: float = 0.40        # 40 % capacity → warning
    fuel_critical_pct: float = 0.20       # 20 % capacity → critical
    fuel_autonomy_warning_days: float = 30.0
    fuel_autonomy_critical_days: float = 14.0

    # Power
    power_deficit_warning_kw: float = 5.0
    power_deficit_critical_kw: float = 20.0
    load_shedding_threshold_pct: float = 0.95  # 95 % of supply → shed

    # Environmental
    wind_chill_warning_c: float = -35.0
    wind_chill_critical_c: float = -50.0
    visibility_warning_m: float = 500.0
    visibility_critical_m: float = 100.0

    # Generator
    generator_runtime_warning_h: float = 4000.0   # hours since maintenance
    generator_runtime_critical_h: float = 5000.0

    # Comms
    comms_blackout_warning_s: float = 300.0    # 5 min gap → warning
    comms_blackout_critical_s: float = 3600.0  # 1 hr gap → critical


THRESHOLDS = OperationalThresholds()


# ---------------------------------------------------------------------------
# Physics constants
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PhysicsConstants:
    # Diesel fuel
    diesel_energy_density_mj_per_l: float = 35.8   # MJ/litre (HHV)
    diesel_generator_efficiency: float = 0.35       # 35 % typical

    # Thermal
    # Wind chill formula: JAG/TI 2001 (Environment Canada / NWS)
    # WC = 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16
    # where T = temp °C, V = wind speed km/h
    wc_const_a: float = 13.12
    wc_const_b: float = 0.6215
    wc_const_c: float = -11.37
    wc_const_d: float = 0.3965
    wc_v_exponent: float = 0.16

    # Base thermal load per station (kW at 0 °C, no wind)
    base_thermal_kw_per_occupant: float = 1.2    # lighting, electronics, etc.
    base_hvac_coefficient: float = 0.8           # scales with |wind_chill|

    # Solar (simplified clear-sky model)
    solar_panel_efficiency: float = 0.18         # 18 % monocrystalline
    solar_panel_area_m2: float = 120.0           # Maitri; Bharati overridden

    # Wind turbine (simplified Betz)
    wind_turbine_rated_kw: float = 30.0
    wind_turbine_rated_ms: float = 12.0          # rated speed m/s
    wind_turbine_cutin_ms: float = 3.5           # cut-in speed
    wind_turbine_cutout_ms: float = 25.0         # cut-out (storm protection)


PHYSICS = PhysicsConstants()


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DB_PATH = "aurora_telemetry.db"


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

WS_TICK_INTERVAL_S: float = 5.0      # seconds between state broadcasts
