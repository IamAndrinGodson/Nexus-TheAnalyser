import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

def _utcnow():
    return datetime.datetime.now(datetime.timezone.utc)

class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    status = Column(String, default="ACTIVE") # ACTIVE, ENDED, KILLED, LOGGED_OUT
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Core risk metrics
    base_timeout = Column(Integer, default=120)
    adapted_timeout = Column(Integer, default=120)
    remaining_timeout = Column(Integer, default=120)

    # Biometrics & Trust
    trust_score = Column(Integer, default=100)
    device_trust = Column(Integer, default=90)
    
    risk_level = Column(String, default="LOW")

    # Metrics history
    mouse_velocity = Column(Integer, default=100)
    keystroke_rhythm = Column(Integer, default=100)
    click_pattern = Column(Integer, default=100)
    scroll_pattern = Column(Integer, default=100)
    dwell_time = Column(Integer, default=100)

    geo_anomaly = Column(Boolean, default=False)

    logs = relationship("AuditLogModel", back_populates="session", cascade="all, delete-orphan")
    transactions = relationship("TransactionModel", back_populates="session", cascade="all, delete-orphan")

class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    timestamp = Column(DateTime(timezone=True), default=_utcnow)
    message = Column(Text)
    event_type = Column(String) # info, warning, danger, success

    session = relationship("SessionModel", back_populates="logs")

class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True) # TXN-1234
    session_id = Column(String, ForeignKey("sessions.id"))
    amount = Column(Integer)  # in cents/paise
    merchant = Column(String)
    route = Column(String)
    risk_level = Column(String) # LOW, MEDIUM, HIGH
    status = Column(String) # CLEARED, IN_TRANSIT, FLAGGED, BLOCKED, DELIVERED
    timestamp = Column(DateTime(timezone=True), default=_utcnow)

    session = relationship("SessionModel", back_populates="transactions")
