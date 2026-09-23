"""aurora/backend/app/models/logistics.py"""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, computed_field


class FuelState(BaseModel):
    """Diesel fuel inventory and consumption tracking."""

    diesel_litres: float = Field(
        description="Current diesel volume in storage (litres)", ge=0.0
    )
    diesel_capacity_litres: float = Field(
        description="Total tank capacity (litres)", gt=0.0
    )
    consumption_rate_lph: float = Field(
        description="Current consumption rate (litres/hour) — live from generator sum",
        ge=0.0,
    )
    last_resupply_date: Optional[date] = Field(
        default=None,
        description="Date of most recent fuel delivery",
    )
    last_resupply_volume_litres: Optional[float] = Field(
        default=None,
        description="Volume delivered at last resupply (litres)",
    )

    @computed_field  # type: ignore[misc]
    @property
    def fill_pct(self) -> float:
        """Tank fill level as a fraction (0.0–1.0)."""
        if self.diesel_capacity_litres == 0:
            return 0.0
        return round(self.diesel_litres / self.diesel_capacity_litres, 4)

    @computed_field  # type: ignore[misc]
    @property
    def autonomy_days(self) -> float:
        """Days of fuel remaining at current consumption rate."""
        if self.consumption_rate_lph <= 0:
            return 9999.0  # essentially indefinite
        return round(self.diesel_litres / (self.consumption_rate_lph * 24), 1)


class ResupplyEvent(BaseModel):
    """A scheduled or historical resupply event."""

    vessel_name: str
    cargo_type: str = Field(description="e.g. 'fuel+food', 'fuel only', 'personnel'")
    scheduled_date: Optional[date] = None
    actual_date: Optional[date] = None
    fuel_litres: Optional[float] = None
    food_kg: Optional[float] = None
    status: str = Field(
        default="scheduled",
        description="'scheduled' | 'en_route' | 'delivered' | 'delayed' | 'cancelled'",
    )
    delay_days: int = Field(default=0, description="Positive = delayed, negative = early")


class SupplyState(BaseModel):
    """Complete logistics inventory for a station."""

    fuel: FuelState
    food_days_remaining: float = Field(
        description="Estimated days of food supply at current occupancy", ge=0.0
    )
    medical_supplies_days: float = Field(
        description="Estimated days of medical supply runway", ge=0.0
    )
    potable_water_days: float = Field(
        description="Days of stored potable water (excluding melt capacity)", ge=0.0
    )
    next_resupply: Optional[ResupplyEvent] = Field(
        default=None,
        description="Next scheduled resupply event, if known",
    )
    resupply_history: list[ResupplyEvent] = Field(default_factory=list)

    @computed_field  # type: ignore[misc]
    @property
    def most_critical_supply_days(self) -> float:
        """Minimum days remaining across all consumables — the binding constraint."""
        return round(
            min(
                self.fuel.autonomy_days,
                self.food_days_remaining,
                self.medical_supplies_days,
                self.potable_water_days,
            ),
            1,
        )
