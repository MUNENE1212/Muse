import json
import os
from typing import Any, Dict, List, Optional

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/muse")

_POOL: Optional[asyncpg.Pool] = None


async def init_pool(database_url: str = DATABASE_URL, min_size: int = 1, max_size: int = 10) -> asyncpg.Pool:
    global _POOL
    if _POOL is None:
        _POOL = await asyncpg.create_pool(
            dsn=database_url,
            min_size=min_size,
            max_size=max_size,
        )
    return _POOL


async def close_pool() -> None:
    global _POOL
    if _POOL is not None:
        await _POOL.close()
        _POOL = None


def get_pool() -> asyncpg.Pool:
    if _POOL is None:
        raise RuntimeError("Database pool has not been initialized; call init_pool() first")
    return _POOL


async def get_room_artifacts(
    room_id: str,
    pool: Optional[asyncpg.Pool] = None,
) -> List[Dict[str, Any]]:
    pool = pool or get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, source_url, type, unstructured_data
            FROM artifacts
            WHERE room_id = $1
            """,
            room_id,
        )
    return [dict(row) for row in rows]


async def save_threads(
    room_id: str,
    threads: List[Dict[str, Any]],
    pool: Optional[asyncpg.Pool] = None,
) -> None:
    pool = pool or get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            for thread in threads:
                blueprint = thread["blueprint"]
                await conn.execute(
                    """
                    INSERT INTO threads (room_id, artifact_ids, ai_blueprint)
                    VALUES ($1, $2, $3::jsonb)
                    """,
                    room_id,
                    thread["artifact_ids"],
                    json.dumps(blueprint),
                )
