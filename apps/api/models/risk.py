from pydantic import BaseModel, Field
from typing import List

class RiskFactor(BaseModel):
    label: str
    impact: str = Field(description="'+' or '-'")
    delta: int

class RiskResultSchema(BaseModel):
    adapted_timeout: int
    risk_level: str
    active_factors: List[RiskFactor]
    step_up_required: bool

class ThreatFeedResponse(BaseModel):
    is_threat: bool
    score: int
    reports: int = 0
