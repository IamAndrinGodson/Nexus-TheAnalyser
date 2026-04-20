"""
routers/auth.py — Authentication endpoints for NEXUS TLS.

Endpoints:
  POST /api/auth/register     — Create a new user account
  POST /api/auth/login        — Authenticate and receive JWT
  POST /api/auth/totp/setup   — Generate TOTP secret for 2FA
  POST /api/auth/totp/verify  — Verify TOTP code and enable 2FA
  GET  /api/auth/me           — Get current user info
  POST /api/auth/password     — Change password
  POST /api/auth/logout       — Revoke session
"""

import os
import uuid
import json
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from passlib.context import CryptContext
from jose import jwt, JWTError
import pyotp

from database import get_db
from db_models import UserModel, SessionModel, AuditLogModel
from models.auth import (
    RegisterRequest, RegisterResponse,
    LoginRequest, LoginResponse,
    TOTPSetupResponse,
    TOTPVerifyRequest, TOTPVerifyResponse,
    UserInfoResponse,
    PasswordChangeRequest, PasswordChangeResponse,
)
from middleware.auth import verify_jwt

# ── Config ─────────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 3600  # 1 hour

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Helpers ────────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    user_id: str,
    session_id: str,
    role: str,
    email: str,
    expires_delta: int = JWT_EXPIRATION_SECONDS,
) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": user_id,
        "session_id": session_id,
        "role": role,
        "email": email,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + datetime.timedelta(seconds=expires_delta),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def _log_event(
    db: AsyncSession,
    session_id: str,
    message: str,
    event_type: str = "info",
    severity: str = "info",
    metadata: Optional[dict] = None,
):
    log = AuditLogModel(
        session_id=session_id,
        message=message,
        event_type=event_type,
        severity=severity,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(log)
    await db.commit()


# ─── REGISTER ──────────────────────────────────────────────────────────────────
@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account with bcrypt-hashed password."""

    # Check for existing email
    existing = await db.execute(
        select(UserModel).where(UserModel.email == req.email)
    )
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = UserModel(
        email=req.email,
        password_hash=hash_password(req.password),
        role=req.role,
        org_id=req.org_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return RegisterResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
    )


# ─── LOGIN ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate user, issue JWT. Supports optional TOTP verification."""

    # 1. Find user
    result = await db.execute(
        select(UserModel).where(UserModel.email == req.email)
    )
    user = result.scalars().first()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    # 2. TOTP check
    if user.totp_enabled and user.totp_secret:
        if not req.totp_code:
            # Return a specific response telling the client that TOTP is required
            return LoginResponse(
                access_token="",
                session_id="",
                user_id=user.id,
                role=user.role,
                expires_in=0,
                totp_required=True,
            )
        # Verify TOTP
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(req.totp_code, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code.",
            )

    # 3. Create session
    session_id = f"sess-{uuid.uuid4().hex[:12]}"
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    session = SessionModel(
        id=session_id,
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        base_timeout=120,
        adapted_timeout=120,
        remaining_timeout=120,
        trust_score=85,
    )
    db.add(session)

    # 4. Update last login
    user.last_login = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()

    # 5. Log the event
    await _log_event(
        db, session_id,
        f"User {user.email} logged in from {ip_address}",
        event_type="success",
        severity="info",
        metadata={"ip": ip_address, "user_agent": user_agent},
    )

    # 6. Issue JWT
    access_token = create_access_token(
        user_id=user.id,
        session_id=session_id,
        role=user.role,
        email=user.email,
    )

    return LoginResponse(
        access_token=access_token,
        session_id=session_id,
        user_id=user.id,
        role=user.role,
        expires_in=JWT_EXPIRATION_SECONDS,
    )


# ─── TOTP SETUP ───────────────────────────────────────────────────────────────
@router.post("/totp/setup", response_model=TOTPSetupResponse)
async def totp_setup(
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Generate a TOTP secret for 2FA enrollment."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP is already enabled. Disable it first to re-enroll.",
        )

    # Generate new secret
    secret = pyotp.random_base32()
    user.totp_secret = secret
    await db.commit()

    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name="NEXUS TLS",
    )

    return TOTPSetupResponse(
        secret=secret,
        provisioning_uri=provisioning_uri,
    )


# ─── TOTP VERIFY (Finalize enrollment) ────────────────────────────────────────
@router.post("/totp/verify", response_model=TOTPVerifyResponse)
async def totp_verify(
    req: TOTPVerifyRequest,
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Verify a TOTP code to finalize 2FA enrollment."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalars().first()

    if not user or not user.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP not set up yet.")

    totp = pyotp.TOTP(user.totp_secret)
    if totp.verify(req.code, valid_window=1):
        user.totp_enabled = True
        await db.commit()

        session_id = token_payload.get("session_id", "unknown")
        await _log_event(
            db, session_id,
            f"TOTP enabled for {user.email}",
            event_type="success",
            severity="info",
        )

        return TOTPVerifyResponse(verified=True, message="2FA is now enabled.")
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TOTP code. Try again.",
        )


# ─── GET CURRENT USER ─────────────────────────────────────────────────────────
@router.get("/me", response_model=UserInfoResponse)
async def get_me(
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Return info about the currently authenticated user."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    return UserInfoResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        org_id=user.org_id,
        totp_enabled=user.totp_enabled,
        created_at=user.created_at,
        last_login=user.last_login,
    )


# ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
@router.post("/password", response_model=PasswordChangeResponse)
async def change_password(
    req: PasswordChangeRequest,
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Change the current user's password."""
    user_id = token_payload.get("sub")
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    user.password_hash = hash_password(req.new_password)
    await db.commit()

    session_id = token_payload.get("session_id", "unknown")
    await _log_event(
        db, session_id,
        f"Password changed for {user.email}",
        event_type="info",
        severity="high",
    )

    return PasswordChangeResponse()


# ─── LOGOUT ────────────────────────────────────────────────────────────────────
@router.post("/logout")
async def logout(
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """End the current session."""
    session_id = token_payload.get("session_id")

    if session_id:
        result = await db.execute(
            select(SessionModel).where(SessionModel.id == session_id)
        )
        session = result.scalars().first()
        if session:
            session.status = "LOGGED_OUT"
            session.ended_at = datetime.datetime.now(datetime.timezone.utc)
            await db.commit()

        await _log_event(
            db, session_id,
            "User logged out",
            event_type="info",
            severity="info",
        )

    return {"message": "Logged out successfully", "session_id": session_id}
