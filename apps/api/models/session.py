from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID

class SessionBase(BaseModel):
    user_id: UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_score: int = 0
    geo_city: Optional[str] = None
    geo_country: Optional[str] = None
    geo_lat: Optional[float] = None
    geo_lon: Optional[float] = None
    is_geo_anomaly: bool = False
    adapted_timeout: int = 120
    biometric_score: int = 100
    status: str = "active"

class SessionCreate(SessionBase):
    pass

class SessionOut(SessionBase):
    id: UUID
    created_at: datetime
    expires_at: datetime
    last_activity: datetime

    model_config = ConfigDict(from_attributes=True)

class SessionEventBase(BaseModel):
    session_id: UUID
    user_id: UUID
    event_type: str
    severity: str = "info"
    metadata: dict = {}
    ip_address: Optional[str] = None

class SessionEventOut(SessionEventBase):
    time: datetime

    model_config = ConfigDict(from_attributes=True)
