"""aurora/backend/app/models/telemetry.py"""

import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator

from ..config import StationID
from .station import StationState


class TelemetryPacket(BaseModel):
    """
    Wire format for all data transmission — WebSocket frames, buffered store,
    and REST snapshot responses.

    The sequence number allows the frontend to detect gaps in the stream
    and request replay of buffered packets after a comms blackout.
    """

    packet_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="UUID4 unique packet identifier",
    )
    station_id: StationID
    timestamp: datetime
    sequence: int = Field(
        description="Monotonically increasing counter per station, reset on restart",
        ge=0,
    )
    state: StationState
    is_buffered: bool = Field(
        default=False,
        description="True if this packet was queued during a comms blackout and is being replayed",
    )
    source: Literal["live", "replay", "scenario", "initial"] = Field(
        default="live",
        description=(
            "live = normal operation; "
            "replay = replayed after blackout; "
            "scenario = injected by scenario engine; "
            "initial = sent on WebSocket connection establishment"
        ),
    )


class TelemetryAck(BaseModel):
    """Client → server acknowledgement of received packets."""

    last_received_sequence: int
    station_id: StationID


class EnvironmentOverride(BaseModel):
    """
    REST/WebSocket payload for operator-driven environment changes.
    Only specified fields are updated; unspecified fields retain their values.
    """

    station_id: StationID
    temperature_c: float | None = None
    wind_speed_ms: float | None = None
    visibility_m: float | None = None
    solar_irradiance_wm2: float | None = None
    blizzard_probability: float | None = None

    @field_validator("blizzard_probability")
    @classmethod
    def clamp_probability(cls, v: float | None) -> float | None:
        if v is not None:
            return max(0.0, min(1.0, v))
        return v
