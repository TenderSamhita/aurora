"""aurora/backend/app/models/risk.py"""

from enum import Enum
from datetime import datetime
from typing import List
from pydantic import BaseModel, Field


class ComponentStatus(str, Enum):
    """
    Six-state component health model.
    Used for both individual components and aggregate risk assessments.
    """
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    RECOVERING = "recovering"


# Severity order — higher index = more severe
STATUS_SEVERITY: dict[ComponentStatus, int] = {
    ComponentStatus.NORMAL: 0,
    ComponentStatus.RECOVERING: 1,
    ComponentStatus.DEGRADED: 2,
    ComponentStatus.WARNING: 3,
    ComponentStatus.CRITICAL: 4,
    ComponentStatus.OFFLINE: 5,
}


def worst_status(*statuses: ComponentStatus) -> ComponentStatus:
    """Return the most severe status from a collection."""
    return max(statuses, key=lambda s: STATUS_SEVERITY[s])


class RiskFactor(BaseModel):
    """A single measurable risk dimension."""

    name: str = Field(description="Human-readable factor name, e.g. 'Fuel Autonomy'")
    label: str = Field(description="Short display label, e.g. 'FUEL'")
    status: ComponentStatus
    value: float = Field(description="Current measured value")
    threshold_warning: float = Field(description="Value at which status becomes WARNING")
    threshold_critical: float = Field(description="Value at which status becomes CRITICAL")
    unit: str = Field(description="Unit string for display, e.g. 'days', 'kW', '°C'")
    direction: str = Field(
        default="below",
        description=(
            "'below' = lower value is worse (e.g. fuel days), "
            "'above' = higher value is worse (e.g. power deficit)"
        ),
    )

    @property
    def pct_to_critical(self) -> float:
        """Fraction of distance from warning threshold to critical threshold consumed."""
        span = abs(self.threshold_critical - self.threshold_warning)
        if span == 0:
            return 1.0 if self.status == ComponentStatus.CRITICAL else 0.0
        if self.direction == "below":
            consumed = self.threshold_warning - self.value
        else:
            consumed = self.value - self.threshold_warning
        return max(0.0, min(1.0, consumed / span))


class RiskAssessment(BaseModel):
    """Aggregate station-level risk evaluation."""

    overall: ComponentStatus
    factors: List[RiskFactor]
    evacuation_recommended: bool = False
    last_evaluated: datetime

    @classmethod
    def derive_overall(cls, factors: List[RiskFactor]) -> ComponentStatus:
        """Overall status is the worst status across all factors."""
        if not factors:
            return ComponentStatus.NORMAL
        return worst_status(*(f.status for f in factors))
