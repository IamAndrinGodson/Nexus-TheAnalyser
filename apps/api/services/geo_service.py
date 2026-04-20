from typing import Dict, Any, Optional
import math
import logging
logger = logging.getLogger(__name__)

# Haversine formula for distance
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return R * c

class GeoService:
    def __init__(self, geoip_db_path: str = None):
        # In a real setup, connect to MaxMind geoip2 reader
        self.reader = None
        self.enabled = False
        
        if geoip_db_path:
            try:
                import geoip2.database
                self.reader = geoip2.database.Reader(geoip_db_path)
                self.enabled = True
                logger.info(f"Initialized GeoIP from {geoip_db_path}")
            except Exception as e:
                logger.warning(f"Could not load GeoIP DB: {e}")

    def lookup_ip(self, ip_address: str) -> Dict[str, Any]:
        if not self.enabled or not ip_address or ip_address in ("127.0.0.1", "::1"):
            return {
                "city": "Local",
                "country": "LA",
                "lat": 0.0,
                "lon": 0.0
            }

        try:
            response = self.reader.city(ip_address)
            return {
                "city": response.city.name,
                "country": response.country.iso_code,
                "lat": response.location.latitude,
                "lon": response.location.longitude
            }
        except Exception as e:
            logger.warning(f"GeoIP lookup failed for {ip_address}: {e}")
            return {}

    def is_in_geofence(self, user_lat: float, user_lon: float,
                       zone_lat: float, zone_lon: float, 
                       radius_km: int = 50) -> bool:
        """Check if coordinates fall within allowed zone radius"""
        if None in (user_lat, user_lon, zone_lat, zone_lon):
            return False

        dist = calculate_distance(user_lat, user_lon, zone_lat, zone_lon)
        return dist <= radius_km
