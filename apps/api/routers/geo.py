"""
routers/geo.py — Geo-fencing and IP lookup endpoints.

Endpoints:
  POST /api/geo/lookup       — Lookup geographic info for an IP address
  POST /api/geo/fence-check  — Check if coordinates are within a geo-fence zone
  GET  /api/geo/zones        — List all geo-fence zones
  POST /api/geo/zones        — Create a new geo-fence zone
"""

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from services.geo_service import GeoService
from database import get_db
from db_models import GeoZoneModel
from middleware.auth import verify_jwt

router = APIRouter(prefix="/api/geo", tags=["geo"])

geo_service = GeoService(geoip_db_path=os.getenv("GEOIP2_DB_PATH"))


# ── Models ─────────────────────────────────────────────────────────────────────
class GeoLookupRequest(BaseModel):
    ip_address: Optional[str] = None


class FenceCheckRequest(BaseModel):
    user_lat: float
    user_lon: float
    zone_lat: Optional[float] = None
    zone_lon: Optional[float] = None
    radius_km: int = 50
    zone_id: Optional[str] = None  # Alternatively check against a stored zone


class CreateZoneRequest(BaseModel):
    name: str
    lat: float
    lon: float
    radius_km: int = 50
    org_id: Optional[str] = None


# ─── IP LOOKUP ─────────────────────────────────────────────────────────────────
@router.post("/lookup")
async def geo_lookup(req: GeoLookupRequest, request: Request = None):
    """Lookup geographic info for an IP address."""
    ip = req.ip_address
    if not ip and request:
        ip = request.client.host if request.client else None
    result = geo_service.lookup_ip(ip or "127.0.0.1")
    return result


# ─── FENCE CHECK ───────────────────────────────────────────────────────────────
@router.post("/fence-check")
async def fence_check(
    req: FenceCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Check if coordinates are within a geo-fence zone."""

    # If zone_id is provided, look up the zone from DB
    if req.zone_id:
        result = await db.execute(
            select(GeoZoneModel).where(GeoZoneModel.id == req.zone_id)
        )
        zone = result.scalars().first()
        if not zone:
            raise HTTPException(status_code=404, detail="Geo zone not found.")
        in_fence = geo_service.is_in_geofence(
            req.user_lat, req.user_lon,
            zone.lat, zone.lon,
            zone.radius_km,
        )
        return {
            "in_fence": in_fence,
            "zone_name": zone.name,
            "zone_radius_km": zone.radius_km,
        }

    # Otherwise use provided coordinates
    if req.zone_lat is None or req.zone_lon is None:
        raise HTTPException(
            status_code=400,
            detail="Provide either zone_id or zone_lat/zone_lon.",
        )

    in_fence = geo_service.is_in_geofence(
        req.user_lat, req.user_lon,
        req.zone_lat, req.zone_lon,
        req.radius_km,
    )
    return {"in_fence": in_fence}


# ─── LIST ZONES ────────────────────────────────────────────────────────────────
@router.get("/zones")
async def list_zones(
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """List all active geo-fence zones."""
    result = await db.execute(
        select(GeoZoneModel).where(GeoZoneModel.is_active == True)
    )
    zones = result.scalars().all()

    return {
        "count": len(zones),
        "zones": [
            {
                "id": z.id,
                "name": z.name,
                "lat": z.lat,
                "lon": z.lon,
                "radius_km": z.radius_km,
                "org_id": z.org_id,
            }
            for z in zones
        ],
    }


# ─── CREATE ZONE ───────────────────────────────────────────────────────────────
@router.post("/zones")
async def create_zone(
    req: CreateZoneRequest,
    token_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Create a new geo-fence zone."""
    zone = GeoZoneModel(
        name=req.name,
        lat=req.lat,
        lon=req.lon,
        radius_km=req.radius_km,
        org_id=req.org_id,
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)

    return {
        "id": zone.id,
        "name": zone.name,
        "lat": zone.lat,
        "lon": zone.lon,
        "radius_km": zone.radius_km,
        "message": "Geo zone created",
    }
