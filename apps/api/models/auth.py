"""
models/auth.py — Pydantic schemas for authentication endpoints.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# ─── Registration ──────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128, description="Password (min 8 chars)")
    role: str = Field(default="operator", pattern="^(operator|admin|viewer)$")
    org_id: Optional[str] = None


class RegisterResponse(BaseModel):
    id: str
    email: str
    role: str
    created_at: datetime
    message: str = "Registration successful"


# ─── Login ─────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = Field(None, min_length=6, max_length=6, description="6-digit TOTP code")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    session_id: str
    user_id: str
    role: str
    expires_in: int  # seconds
    totp_required: bool = False


# ─── TOTP ──────────────────────────────────────────────────────────────────────
class TOTPSetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    message: str = "Scan the QR code with your authenticator app, then verify with a code."


class TOTPVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TOTPVerifyResponse(BaseModel):
    verified: bool
    message: str


# ─── User Info ─────────────────────────────────────────────────────────────────
class UserInfoResponse(BaseModel):
    id: str
    email: str
    role: str
    org_id: Optional[str]
    totp_enabled: bool
    created_at: datetime
    last_login: Optional[datetime]


# ─── Password Change ──────────────────────────────────────────────────────────
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordChangeResponse(BaseModel):
    message: str = "Password changed successfully"
