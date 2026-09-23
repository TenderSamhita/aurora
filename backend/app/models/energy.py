"""aurora/backend/app/models/energy.py"""

from typing import List
from pydantic import BaseModel, Field, computed_field
from .risk import ComponentStatus


class GeneratorState(BaseModel):
    """State of a single diesel generator unit."""

    generator_id: str = Field(description="Unit identifier, e.g. 'GEN-1'")
    status: ComponentStatus
    rated_kw: float = Field(description="Nameplate capacity (kW)", gt=0)
    output_kw: float = Field(description="Current electrical output (kW)", ge=0.0)
    fuel_consumption_lph: float = Field(
        description="Instantaneous diesel consumption (litres/hour)", ge=0.0
    )
    runtime_hours_total: float = Field(
        description="Cumulative operating hours since installation", ge=0.0
    )
    hours_since_maintenance: float = Field(
        description="Hours elapsed since last scheduled maintenance", ge=0.0
    )

    @computed_field  # type: ignore[misc]
    @property
    def load_pct(self) -> float:
        """Generator load as fraction of rated capacity (0.0–1.0)."""
        if self.rated_kw == 0:
            return 0.0
        return round(min(1.0, self.output_kw / self.rated_kw), 4)


class PowerState(BaseModel):
    """Instantaneous power balance for a station."""

    total_demand_kw: float = Field(
        description="Total electrical demand (kW) including heating, lighting, comms",
        ge=0.0,
    )
    thermal_demand_kw: float = Field(
        description="Heating component of total demand (kW)", ge=0.0
    )
    base_load_kw: float = Field(
        description="Non-thermal baseline load (kW) — instruments, comms, lighting",
        ge=0.0,
    )
    generators: List[GeneratorState]
    solar_output_kw: float = Field(
        description="Total photovoltaic output (kW)", ge=0.0, default=0.0
    )
    wind_output_kw: float = Field(
        description="Total wind turbine output (kW)", ge=0.0, default=0.0
    )
    load_shedding_active: bool = Field(
        default=False,
        description="True when non-essential loads have been disconnected",
    )
    shed_loads_kw: float = Field(
        default=0.0,
        description="Power demand removed by load shedding (kW)",
    )

    @computed_field  # type: ignore[misc]
    @property
    def generator_output_kw(self) -> float:
        return round(sum(g.output_kw for g in self.generators), 2)

    @computed_field  # type: ignore[misc]
    @property
    def total_supply_kw(self) -> float:
        return round(self.generator_output_kw + self.solar_output_kw + self.wind_output_kw, 2)

    @computed_field  # type: ignore[misc]
    @property
    def deficit_kw(self) -> float:
        """Positive = demand exceeds supply (critical); negative = surplus."""
        return round(self.total_demand_kw - self.total_supply_kw, 2)

    @computed_field  # type: ignore[misc]
    @property
    def total_fuel_consumption_lph(self) -> float:
        return round(sum(g.fuel_consumption_lph for g in self.generators), 2)
