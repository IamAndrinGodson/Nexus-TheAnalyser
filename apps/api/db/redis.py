import os
from redis.asyncio import Redis, ConnectionPool

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Connection pool for better performance in async contexts
pool = ConnectionPool.from_url(REDIS_URL, decode_responses=False)

def get_redis_client() -> Redis:
    return Redis(connection_pool=pool)

async def get_redis():
    """FastAPI Dependency for Redis"""
    client = get_redis_client()
    try:
        yield client
    finally:
        await client.close()
