"""aurora/backend/app/models/station.py"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

from ..config import StationID
from .environment import EnvironmentalConditions
from .energy import PowerState
from .logistics import SupplyState
from .risk import RiskAssessment, ComponentStatus


class CommsStatus(BaseModel):
    """Communication link health for a station."""

    satellite_link: ComponentStatus = ComponentStatus.NORMAL
    vsat_uplink_mbps: float = Field(default=0.0, ge=0.0)
    last_contact: datetime
    blackout_duration_s: float = Field(
        default=0.0,
        description="Seconds since last successful contact (0 = currently connected)",
        ge=0.0,
    )
    buffered_packets: int = Field(
        default=0,
        description="Telemetry packets queued for transmission during blackout",
        ge=0,
    )
    is_blackout: bool = Field(
        default=False,
        description="True when active communication blackout is in progress",
    )


class StationOperationalMode(str):
    NORMAL = "normal"
    EMERGENCY = "emergency"
    REDUCED = "reduced"        # load shedding / conservation
    EVACUATION = "evacuation"
    STANDBY = "standby"        # station unmanned / off-season


class StationState(BaseModel):
    """
    Complete instantaneous state of one Antarctic research station.

    This is the canonical data contract between the simulation engine
    and every consumer (REST API, WebSocket, frontend, persistence layer).

    All derived metrics (deficit, autonomy, etc.) are computed fields
    on the sub-models — never duplicated here.
    """

    station_id: StationID
    station_name: str
    timestamp: datetime
    operational_mode: str = Field(default="normal")
    personnel_count: int = Field(
        description="Number of personnel currently on station", ge=0
    )
    environment: EnvironmentalConditions
    power: PowerState
    logistics: SupplyState
    risk: RiskAssessment
    comms: CommsStatus
    scenario_active: str | None = Field(
        default=None,
        description="Name of the active simulation scenario, if any",
    )
    simulation_speed: float = Field(
        default=1.0,
        description="Simulation time multiplier (1.0 = real-time)",
        gt=0.0,
    )
