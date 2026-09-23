"""aurora/backend/app/models/environment.py"""

from pydantic import BaseModel, Field, field_validator


class EnvironmentalConditions(BaseModel):
    """
    Observed or simulated atmospheric conditions at a station.
    All values are instantaneous point readings, not averages.
    """

    temperature_c: float = Field(
        description="Ambient dry-bulb air temperature (°C)",
        ge=-90.0,
        le=20.0,
    )
    wind_speed_ms: float = Field(
        description="10-minute mean wind speed at 10 m height (m/s)",
        ge=0.0,
        le=80.0,
    )
    wind_direction_deg: float = Field(
        default=180.0,
        description="Wind direction (° true north, meteorological convention)",
        ge=0.0,
        le=360.0,
    )
    wind_chill_c: float = Field(
        description="Calculated apparent temperature (°C), JAG/TI 2001 formula"
    )
    relative_humidity_pct: float = Field(
        default=75.0,
        description="Relative humidity (%)",
        ge=0.0,
        le=100.0,
    )
    pressure_hpa: float = Field(
        default=985.0,
        description="Station-level atmospheric pressure (hPa)",
        ge=870.0,
        le=1060.0,
    )
    visibility_m: float = Field(
        description="Prevailing meteorological visibility (m)",
        ge=0.0,
        le=50000.0,
    )
    snow_accumulation_mm: float = Field(
        default=0.0,
        description="Snow accumulation in last 6 hours (mm water equivalent)",
        ge=0.0,
    )
    solar_irradiance_wm2: float = Field(
        description="Global horizontal irradiance (W/m²)",
        ge=0.0,
        le=1400.0,
    )
    blizzard_probability: float = Field(
        default=0.0,
        description="Estimated probability of blizzard onset within 6 h (0.0–1.0)",
        ge=0.0,
        le=1.0,
    )

    @field_validator("wind_chill_c")
    @classmethod
    def wind_chill_must_be_le_temperature(cls, v: float, info) -> float:
        # Wind chill is always ≤ actual temperature
        temp = info.data.get("temperature_c")
        if temp is not None and v > temp + 0.1:
            raise ValueError("wind_chill_c cannot exceed temperature_c")
        return v
