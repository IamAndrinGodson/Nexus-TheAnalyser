import httpx
import os
import logging
logger = logging.getLogger(__name__)

ABUSEIPDB_API_KEY = os.getenv("ABUSEIPDB_API_KEY")

class ThreatFeedService:
    """
    Interacts with external threat feeds (AbuseIPDB, Spamhaus) 
    to validate IP reputation during login.
    """
    
    @staticmethod
    async def check_ip_reputation(ip_address: str) -> dict:
        if not ABUSEIPDB_API_KEY or ip_address in ("127.0.0.1", "::1"):
            return {"is_threat": False, "score": 0}
            
        url = "https://api.abuseipdb.com/api/v2/check"
        querystring = {
            "ipAddress": ip_address,
            "maxAgeInDays": "30"
        }
        headers = {
            "Accept": "application/json",
            "Key": ABUSEIPDB_API_KEY
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, params=querystring, timeout=3.0)
                if response.status_code == 200:
                    data = response.json()["data"]
                    score = data.get("abuseConfidenceScore", 0)
                    return {
                        "is_threat": score > 50,
                        "score": score,
                        "reports": data.get("totalReports", 0)
                    }
        except Exception as e:
            logger.error(f"Threat feed lookup failed: {e}")
            
        return {"is_threat": False, "score": 0}
