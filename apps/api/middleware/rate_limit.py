"""
middleware/rate_limit.py — Rate limiting middleware using in-memory store.

Falls back to in-memory tracking when Redis is not available.
"""

import time
import logging
from collections import defaultdict
from typing import Optional

from fastapi import Request, HTTPException

logger = logging.getLogger(__name__)

# ── In-memory rate limit store (for dev / when Redis is unavailable) ──
_rate_store: dict[str, list[float]] = defaultdict(list)


async def rate_limit(
    request: Request,
    limit: int = 100,
    window: int = 60,
):
    """
    Sliding window rate limiter.

    Args:
        request: FastAPI request
        limit: Max requests per window
        window: Window size in seconds
    """
    ip = request.client.host if request.client else "unknown"
    endpoint = request.url.path
    key = f"{endpoint}:{ip}"

    now = time.time()

    # Try Redis first
    try:
        from db.redis import get_redis_client
        client = get_redis_client()
        redis_key = f"rate_limit:{key}"
        current = await client.incr(redis_key)
        if current == 1:
            await client.expire(redis_key, window)
        await client.close()

        if current > limit:
            logger.warning(f"Rate limit exceeded for {key}: {current}/{limit}")
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Limit: {limit} per {window}s.",
            )
        return
    except (ImportError, ConnectionError, Exception):
        pass  # Fall back to in-memory

    # In-memory fallback
    cutoff = now - window
    _rate_store[key] = [t for t in _rate_store[key] if t > cutoff]
    _rate_store[key].append(now)

    if len(_rate_store[key]) > limit:
        logger.warning(f"Rate limit exceeded (in-memory) for {key}")
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Limit: {limit} per {window}s.",
        )


async def strict_rate_limit(request: Request):
    """Stricter rate limit for auth endpoints: 10 requests/minute."""
    await rate_limit(request, limit=10, window=60)


async def relaxed_rate_limit(request: Request):
    """Relaxed rate limit for general API: 200 requests/minute."""
    await rate_limit(request, limit=200, window=60)
