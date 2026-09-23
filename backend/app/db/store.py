"""
aurora/backend/app/db/store.py

SQLite persistence layer for telemetry buffering.

Purpose: During comms blackouts the simulation continues producing telemetry.
These packets are buffered here and replayed to the client when the link
is restored, with is_buffered=True so the frontend can indicate catch-up mode.
"""

import json
import logging
import aiosqlite
from datetime import datetime
from typing import List

from ..config import DB_PATH, StationID

log = logging.getLogger(__name__)


async def init_db() -> None:
    """Initialize the SQLite database and create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS telemetry_buffer (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id  TEXT    NOT NULL,
                packet_id   TEXT    UNIQUE NOT NULL,
                timestamp   TEXT    NOT NULL,
                sequence    INTEGER NOT NULL,
                payload     TEXT    NOT NULL,
                synced      INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_station_synced
            ON telemetry_buffer (station_id, synced, sequence)
        """)
        # Scenario event log for audit/replay
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scenario_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                station_id  TEXT    NOT NULL,
                scenario    TEXT    NOT NULL,
                started_at  TEXT    NOT NULL,
                ended_at    TEXT,
                triggered_by TEXT   NOT NULL DEFAULT 'operator'
            )
        """)
        await db.commit()
    log.info("Database initialized at %s", DB_PATH)


async def buffer_packet(station_id: StationID, packet_id: str, timestamp: datetime, sequence: int, payload: dict) -> None:
    """Store a telemetry packet in the buffer (for later replay). Keep payload compact."""
    # Use compact JSON to keep payloads small (no whitespace)
    compact = json.dumps(payload, separators=(',', ':'))
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT OR IGNORE INTO telemetry_buffer
                (station_id, packet_id, timestamp, sequence, payload)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                station_id.value,
                packet_id,
                timestamp.isoformat(),
                sequence,
                compact,
            ),
        )
        await db.commit()


async def get_unsynced_count(station_id: StationID) -> int:
    """Return count of unsynced buffered packets for a station."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT COUNT(*) as cnt FROM telemetry_buffer WHERE station_id = ? AND synced = 0",
            (station_id.value,),
        ) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else 0


async def get_unsynced_packets(station_id: StationID, limit: int = 100) -> List[dict]:
    """Retrieve buffered packets that have not yet been marked as synced."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """
            SELECT packet_id, timestamp, sequence, payload
            FROM telemetry_buffer
            WHERE station_id = ? AND synced = 0
            ORDER BY sequence ASC
            LIMIT ?
            """,
            (station_id.value, limit),
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def mark_synced(packet_ids: List[str]) -> None:
    """Mark packets as successfully delivered to the client."""
    if not packet_ids:
        return
    placeholders = ",".join("?" * len(packet_ids))
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            f"UPDATE telemetry_buffer SET synced = 1 WHERE packet_id IN ({placeholders})",
            packet_ids,
        )
        await db.commit()


async def purge_old_synced_packets(keep_days: int = 7) -> int:
    """Remove synced packets older than keep_days days. Returns row count deleted."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """
            DELETE FROM telemetry_buffer
            WHERE synced = 1
              AND created_at < strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)
            """,
            (f"-{keep_days} days",),
        )
        await db.commit()
        return cursor.rowcount


async def log_scenario_start(station_id: StationID, scenario: str, triggered_by: str = "operator") -> None:
    """Record a scenario activation event."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO scenario_log (station_id, scenario, started_at, triggered_by) VALUES (?, ?, ?, ?)",
            (station_id.value, scenario, datetime.utcnow().isoformat(), triggered_by),
        )
        await db.commit()


async def log_scenario_end(station_id: StationID, scenario: str) -> None:
    """Record scenario deactivation."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            UPDATE scenario_log
            SET ended_at = ?
            WHERE station_id = ? AND scenario = ? AND ended_at IS NULL
            """,
            (datetime.utcnow().isoformat(), station_id.value, scenario),
        )
        await db.commit()
