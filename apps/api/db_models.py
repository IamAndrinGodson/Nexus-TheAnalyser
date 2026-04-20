import datetime
import uuid
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, BigInteger, Numeric
from sqlalchemy.orm import relationship
from database import Base


def _utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


def _genuuid():
    return str(uuid.uuid4())


# ─── USER MODEL ────────────────────────────────────────────────────────────────
class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=_genuuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    totp_secret = Column(String, nullable=True)     # encrypted at rest
    totp_enabled = Column(Boolean, default=False)
    role = Column(String, default="operator")        # operator | admin | viewer
    org_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    last_login = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)

    sessions = relationship("SessionModel", back_populates="user", cascade="all, delete-orphan")


# ─── SESSION MODEL ─────────────────────────────────────────────────────────────
class SessionModel(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status = Column(String, default="ACTIVE")  # ACTIVE, ENDED, KILLED, LOGGED_OUT
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    # Network context
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

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
    geo_city = Column(String, nullable=True)
    geo_country = Column(String, nullable=True)

    user = relationship("UserModel", back_populates="sessions")
    logs = relationship("AuditLogModel", back_populates="session", cascade="all, delete-orphan")
    transactions = relationship("TransactionModel", back_populates="session", cascade="all, delete-orphan")


# ─── AUDIT LOG MODEL ──────────────────────────────────────────────────────────
class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    timestamp = Column(DateTime(timezone=True), default=_utcnow)
    message = Column(Text)
    event_type = Column(String)  # info, warning, danger, success
    severity = Column(String, default="info")
    metadata_json = Column(Text, nullable=True)  # JSON string for extra data

    session = relationship("SessionModel", back_populates="logs")


# ─── TRANSACTION MODEL ────────────────────────────────────────────────────────
class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, index=True)  # TXN-1234
    session_id = Column(String, ForeignKey("sessions.id"))
    amount = Column(Integer)   # in cents/paise
    merchant = Column(String)
    route = Column(String)
    risk_level = Column(String)  # LOW, MEDIUM, HIGH
    status = Column(String)      # CLEARED, IN_TRANSIT, FLAGGED, BLOCKED, DELIVERED
    timestamp = Column(DateTime(timezone=True), default=_utcnow)

    session = relationship("SessionModel", back_populates="transactions")


# ─── GEO ZONE MODEL ───────────────────────────────────────────────────────────
class GeoZoneModel(Base):
    __tablename__ = "geo_zones"

    id = Column(String, primary_key=True, index=True, default=_genuuid)
    org_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    radius_km = Column(Integer, default=50)
    is_active = Column(Boolean, default=True)


# ─── TRUSTED DEVICE MODEL ─────────────────────────────────────────────────────
class TrustedDeviceModel(Base):
    __tablename__ = "trusted_devices"

    id = Column(String, primary_key=True, index=True, default=_genuuid)
    user_id = Column(String, ForeignKey("users.id"), index=True)
    fingerprint_hash = Column(String, nullable=False)
    label = Column(String, nullable=True)       # e.g. "Chrome on MacBook"
    last_seen = Column(DateTime(timezone=True), default=_utcnow)
    trust_granted_at = Column(DateTime(timezone=True), default=_utcnow)
    is_revoked = Column(Boolean, default=False)
