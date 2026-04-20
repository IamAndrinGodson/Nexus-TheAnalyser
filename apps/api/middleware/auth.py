"""
middleware/auth.py — JWT authentication middleware for NEXUS TLS.

Supports both bearer tokens and cookie-based tokens.
"""

import os
from typing import Optional

from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer(auto_error=False)

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-in-prod")
ALGORITHM = "HS256"


async def verify_jwt(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> dict:
    """
    Verify JWT from either:
      1. Authorization: Bearer <token> header
      2. Cookie: nexus_token=<token>

    Returns the decoded JWT payload.
    """
    token = None

    # 1. Try Bearer header
    if credentials and credentials.credentials:
        token = credentials.credentials

    # 2. Fallback to cookie
    if not token:
        token = request.cookies.get("nexus_token")

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Provide a Bearer token or nexus_token cookie.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_admin(
    token_payload: dict = Security(verify_jwt),
) -> dict:
    """Dependency that requires admin role."""
    if token_payload.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )
    return token_payload
