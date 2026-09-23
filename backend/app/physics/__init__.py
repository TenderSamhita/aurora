"""
aurora/backend/app/physics/__init__.py

Pure calculation functions — no I/O, no side effects, no state.

Every function here has a docstring that references the formula source.
These are stubs in Phase 1: the signatures and formulas are correct,
but the simulator loop that calls them is wired up in Phase 2.

All inputs and outputs use SI-adjacent units matching the Pydantic models.
"""

import math
from ..config import PHYSICS


# ---------------------------------------------------------------------------
# Atmospheric / Environmental
# ---------------------------------------------------------------------------

def calculate_wind_chill(temperature_c: float, wind_speed_ms: float) -> float:
    """
    Apparent temperature using the JAG/TI 2001 Wind Chill Index.
    Valid for: T ≤ 10 °C and V ≥ 1.3 m/s (4.8 km/h).

    Formula:
        WC = 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16
    where T = air temperature (°C), V = wind speed (km/h).

    Reference: Environment Canada / National Weather Service (2001).
    """
    if wind_speed_ms < 1.3 or temperature_c > 10.0:
        return round(temperature_c, 2)

    v_kmh = wind_speed_ms * 3.6
    wc = (
        PHYSICS.wc_const_a
        + PHYSICS.wc_const_b * temperature_c
        + PHYSICS.wc_const_c * (v_kmh ** PHYSICS.wc_v_exponent)
        + PHYSICS.wc_const_d * temperature_c * (v_kmh ** PHYSICS.wc_v_exponent)
    )
    # Wind chill must not exceed actual temperature
    return round(min(wc, temperature_c), 2)


def calculate_solar_output_kw(
    irradiance_wm2: float,
    panel_area_m2: float | None = None,
    panel_efficiency: float | None = None,
) -> float:
    """
    DC power output from photovoltaic panels.

    Formula: P = G × A × η
    where G = irradiance (W/m²), A = panel area (m²), η = efficiency fraction.

    Reference: IEC 61724-1 photovoltaic system performance monitoring.
    """
    area = panel_area_m2 if panel_area_m2 is not None else PHYSICS.solar_panel_area_m2
    eta = panel_efficiency if panel_efficiency is not None else PHYSICS.solar_panel_efficiency
    output_w = irradiance_wm2 * area * eta
    return round(output_w / 1000.0, 3)  # W → kW


def calculate_wind_turbine_output_kw(
    wind_speed_ms: float,
    rated_kw: float | None = None,
    rated_speed_ms: float | None = None,
    cutin_ms: float | None = None,
    cutout_ms: float | None = None,
) -> float:
    """
    Simplified wind turbine power curve (cubic region + rated cap + cut-out).

    P(V) = P_rated × (V³ / V_rated³)   for V_cutin ≤ V < V_rated
    P(V) = P_rated                       for V_rated ≤ V ≤ V_cutout
    P(V) = 0                             otherwise

    This is a simplified Betz-model curve, not a real turbine power table.
    Reference: Burton et al., "Wind Energy Handbook" (2011), Chapter 3.
    """
    rated = rated_kw or PHYSICS.wind_turbine_rated_kw
    v_rated = rated_speed_ms or PHYSICS.wind_turbine_rated_ms
    v_cutin = cutin_ms or PHYSICS.wind_turbine_cutin_ms
    v_cutout = cutout_ms or PHYSICS.wind_turbine_cutout_ms

    if wind_speed_ms < v_cutin or wind_speed_ms > v_cutout:
        return 0.0
    if wind_speed_ms >= v_rated:
        return round(rated, 3)
    # Cubic interpolation
    power = rated * ((wind_speed_ms ** 3) / (v_rated ** 3))
    return round(power, 3)


# ---------------------------------------------------------------------------
# Thermal / HVAC
# ---------------------------------------------------------------------------

def calculate_thermal_demand_kw(
    temperature_c: float,
    wind_speed_ms: float,
    t_habitat: float = 21.0,
    alpha: float = 0.01,
) -> float:
    """
    Thermal demand calculation.
    Q_heat = alpha * (T_habitat - T_ambient) * (1 + 0.02 * wind_speed)
    """
    if temperature_c >= t_habitat:
        return 0.0
    return alpha * (t_habitat - temperature_c) * (1 + 0.02 * wind_speed_ms)


def calculate_base_load_kw(personnel_count: int, base_per_person_kw: float | None = None) -> float:
    """
    Non-thermal electrical base load: instrumentation, comms, lighting, computers.
    Scales linearly with occupancy as a first-order approximation.
    """
    base = base_per_person_kw or PHYSICS.base_thermal_kw_per_occupant
    return round(personnel_count * base, 2)


def calculate_total_power_demand_kw(
    q_heat: float,
    p_base: float = 15.0,
    p_science: float = 10.0,
    p_life_support: float = 5.0,
) -> float:
    """
    Total electrical demand = P_base + Q_heat + P_science + P_life_support
    """
    return p_base + q_heat + p_science + p_life_support


# ---------------------------------------------------------------------------
# Fuel / Logistics
# ---------------------------------------------------------------------------

def calculate_fuel_consumption_lph(
    power_output_kw: float,
) -> float:
    """
    F_rate = P_total * 0.25 L/kWh
    """
    return power_output_kw * 0.25


def calculate_autonomy_days(
    fuel_litres: float,
    consumption_rate_lph: float,
) -> float:
    """
    Days of fuel remaining at a constant consumption rate.

    Formula: days = litres / (rate × 24)
    """
    if consumption_rate_lph <= 0:
        return 9999.0
    return round(fuel_litres / (consumption_rate_lph * 24), 1)


# ---------------------------------------------------------------------------
# Risk evaluation helpers
# ---------------------------------------------------------------------------

def evaluate_fuel_risk_status(autonomy_days: float, thresholds) -> str:
    """
    Map fuel autonomy to a ComponentStatus string using configured thresholds.
    'below' direction: lower value = higher risk.
    """
    if autonomy_days <= thresholds.fuel_autonomy_critical_days:
        return "critical"
    if autonomy_days <= thresholds.fuel_autonomy_warning_days:
        return "warning"
    return "normal"


def evaluate_power_risk_status(deficit_kw: float, thresholds) -> str:
    """Map power deficit to ComponentStatus. Positive deficit = supply shortfall."""
    if deficit_kw >= thresholds.power_deficit_critical_kw:
        return "critical"
    if deficit_kw >= thresholds.power_deficit_warning_kw:
        return "warning"
    return "normal"


def evaluate_environment_risk_status(wind_chill_c: float, visibility_m: float, thresholds) -> str:
    """Map environmental severity to ComponentStatus."""
    if wind_chill_c <= thresholds.wind_chill_critical_c or visibility_m <= thresholds.visibility_critical_m:
        return "critical"
    if wind_chill_c <= thresholds.wind_chill_warning_c or visibility_m <= thresholds.visibility_warning_m:
        return "warning"
    return "normal"


def calculate_overall_risk_score(
    fuel_risk: float,
    power_risk: float,
    structural_risk: float,
    environmental_risk: float,
) -> float:
    """
    R = 0.35 × FuelRisk + 0.25 × PowerRisk + 0.25 × StructuralRisk + 0.15 × EnvironmentalRisk
    Normalize individual risks to 0–100. (Assuming inputs are already 0-100)
    """
    r = 0.35 * fuel_risk + 0.25 * power_risk + 0.25 * structural_risk + 0.15 * environmental_risk
    return max(0.0, min(100.0, r))
