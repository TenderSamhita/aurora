"""
aurora/backend/app/api/websocket.py

WebSocket connection manager.

Manages per-station client registries and broadcasts TelemetryPackets.
One station can have multiple simultaneous WebSocket clients
(e.g., dashboard on two monitors, mobile client).
"""

import asyncio
import logging
from collections import defaultdict
from typing import Dict, List, Set
from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    """
    Registry and broadcast hub for WebSocket clients.

    Clients subscribe per station_id.
    All clients for a station receive the same broadcast payload.
    """

    def __init__(self) -> None:
        # station_id (str) → set of active WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, station_id: str) -> None:
        """Accept connection and register client for the given station."""
        await websocket.accept()
        self._connections[station_id].add(websocket)
        log.info(
            "WS client connected: station=%s total_clients=%d",
            station_id,
            len(self._connections[station_id]),
        )

    def disconnect(self, websocket: WebSocket, station_id: str) -> None:
        """Remove client from registry."""
        self._connections[station_id].discard(websocket)
        log.info(
            "WS client disconnected: station=%s remaining=%d",
            station_id,
            len(self._connections[station_id]),
        )

    def client_count(self, station_id: str) -> int:
        return len(self._connections.get(station_id, set()))

    async def send_json(self, websocket: WebSocket, data: dict) -> bool:
        """
        Send JSON to a single client.
        Returns False if the send fails (client disconnected mid-send).
        """
        try:
            await websocket.send_json(data)
            return True
        except Exception as exc:
            log.warning("WS send failed: %s", exc)
            return False

    async def broadcast(self, station_id: str, data: dict) -> None:
        """
        Broadcast JSON payload to all connected clients for a station.
        Failed sends remove the client from the registry silently.
        """
        clients = list(self._connections.get(station_id, set()))
        if not clients:
            return

        dead_clients = []
        tasks = [self.send_json(ws, data) for ws in clients]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for ws, result in zip(clients, results):
            if result is False or isinstance(result, Exception):
                dead_clients.append(ws)

        for ws in dead_clients:
            self.disconnect(ws, station_id)

    def active_stations(self) -> List[str]:
        """Return list of station_ids with at least one active client."""
        return [sid for sid, conns in self._connections.items() if conns]


# Module-level singleton — shared across all WebSocket route handlers
manager = ConnectionManager()
