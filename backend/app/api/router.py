"""
aurora/backend/app/api/router.py

REST API routes + WebSocket for Phase 6.

Phase 6 adds EDGE/HQ distinction and store-and-forward.
"""

import asyncio
import logging
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Body
from fastapi.responses import JSONResponse

from ..config import StationID, STATION_META, WS_TICK_INTERVAL_S
from ..models import TelemetryPacket, EnvironmentOverride
from ..simulator import engine
from .websocket import manager
from ..db.store import buffer_packet, get_unsynced_packets, get_unsynced_count, mark_synced

log = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/health")
async def health_check():
    """Service liveness check."""
    return {
        "status": "ok",
        "service": "AURORA Backend",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "stations": [sid.value for sid in StationID],
    }


@router.get("/stations")
async def list_stations():
    """Return metadata for all configured stations (HQ state)."""
    result = []
    for sid in StationID:
        meta = STATION_META[sid]
        # Phase 6: return HQ (cloud) state for dashboard
        state = engine.get_hq_state(sid) if hasattr(engine, 'get_hq_state') else engine.get_state(sid)
        result.append({
            "id": sid.value,
            "name": meta.name,
            "location": meta.location_description,
            "coordinates": {"lat": meta.latitude, "lon": meta.longitude},
            "altitude_m": meta.altitude_m,
            "year_established": meta.year_established,
            "personnel_summer": meta.personnel_summer,
            "personnel_winter": meta.personnel_winter,
            "operational_mode": state.operational_mode,
            "personnel_count": state.personnel_count,
            "comms_status": state.comms.satellite_link.value,
            "risk_overall": state.risk.overall.value,
        })
    return result


@router.get("/station/{station_id}/state")
async def get_station_state(station_id: str):
    """Return the current HQ (cloud) StationState for a station."""
    try:
        sid = StationID(station_id.upper())
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown station: {station_id}")

    # Phase 6: HQ is what dashboard sees (stale during blackout)
    state = engine.get_hq_state(sid) if hasattr(engine, 'get_hq_state') else engine.get_state(sid)
    return state.model_dump(mode="json")


@router.get("/station/{station_id}/edge/state")
async def get_edge_state(station_id: str):
    """Return the live EDGE state (always advancing, even during blackout)."""
    try:
        sid = StationID(station_id.upper())
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown station: {station_id}")

    state = engine.get_edge_state(sid)
    return state.model_dump(mode="json")


@router.get("/station/{station_id}/sync/status")
async def get_sync_status(station_id: str):
    """Return sync status: buffered count, link status, HQ vs EDGE sequences."""
    try:
        sid = StationID(station_id.upper())
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown station: {station_id}")

    # In-memory sync status + DB buffered count
    base = engine.get_sync_status(sid)
    try:
        db_cnt = await get_unsynced_count(sid)
        base["db_buffered"] = db_cnt
        base["buffered_packets"] = db_cnt  # override with DB truth
    except Exception as exc:
        log.warning(f"sync status DB error: {exc}")
        base["db_buffered"] = base.get("buffered_packets", 0)

    # Add HQ vs EDGE timestamps for staleness detection
    try:
        edge = engine.get_edge_state(sid)
        hq = engine.get_hq_state(sid)
        base["edge_timestamp"] = edge.timestamp.isoformat()
        base["hq_timestamp"] = hq.timestamp.isoformat()
        # staleness seconds
        base["staleness_s"] = (edge.timestamp - hq.timestamp).total_seconds() if edge.timestamp and hq.timestamp else 0
    except Exception:
        pass

    return base


@router.post("/station/{station_id}/environment")
async def override_environment(station_id: str, override: EnvironmentOverride):
    """
    Apply operator-driven environment override.
    Phase 6: updates EDGE always; HQ only if link ONLINE, otherwise buffered.
    """
    try:
        sid = StationID(station_id.upper())
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown station: {station_id}")

    updated_edge = engine.apply_environment_override(
        sid,
        temperature_c=override.temperature_c,
        wind_speed_ms=override.wind_speed_ms,
        visibility_m=override.visibility_m,
        solar_irradiance_wm2=override.solar_irradiance_wm2,
        blizzard_probability=override.blizzard_probability,
    )

    # Phase 6: tick to propagate cascade on EDGE
    # Use sync tick (physics) then handle HQ sync
    updated_edge = engine.tick(sid)

    seq = engine.next_sequence(sid)
    packet = TelemetryPacket(
        station_id=sid,
        timestamp=updated_edge.timestamp,
        sequence=seq,
        state=updated_edge,
        is_buffered=False,
        source="scenario",
    )

    # Store-and-forward decision
    if updated_edge.comms.is_blackout:
        # BLACKOUT: buffer to SQLite, do NOT broadcast to HQ/dashboard
        payload = packet.model_dump(mode="json")
        # Compact is handled in buffer_packet
        await buffer_packet(sid, packet.packet_id, packet.timestamp, seq, payload)
        log.info(f"[STORE] buffered env override for {sid.value} seq={seq} blackout")
        return {"ok": True, "sequence": seq, "buffered": True, "hq_stale": True}
    else:
        # ONLINE: update HQ and broadcast
        # HQ already updated via engine.tick's HQ handling, but ensure
        engine._hq_states[sid] = updated_edge.model_copy(deep=True)
        engine._hq_sequence[sid] = seq
        # If was syncing, complete
        if engine._sync_meta[sid].get("is_syncing"):
            engine.complete_sync(sid, 0, 0, updated_edge.timestamp)
        await manager.broadcast(sid.value, packet.model_dump(mode="json"))
        return {"ok": True, "sequence": seq, "buffered": False}


from pydantic import BaseModel
class ScenarioRequest(BaseModel):
    scenario: str | None

@router.post("/station/{station_id}/scenario")
async def override_scenario(station_id: str, request: ScenarioRequest):
    """
    Apply operator-driven scenario override.
    Phase 6: handles EDGE/HQ and buffering.
    """
    try:
        sid = StationID(station_id.upper())
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown station: {station_id}")

    # Capture previous blackout state for transition detection
    prev_edge = engine.get_edge_state(sid)
    prev_blackout = prev_edge.comms.is_blackout

    updated_edge = engine.set_scenario(sid, request.scenario)
    
    # Force a tick immediately to apply scenario effects for snappy UI response
    updated_edge = engine.tick(sid)

    seq = engine.next_sequence(sid)
    packet = TelemetryPacket(
        station_id=sid,
        timestamp=updated_edge.timestamp,
        sequence=seq,
        state=updated_edge,
        is_buffered=False,
        source="scenario",
    )

    # Detect restoration vs blackout
    is_now_blackout = updated_edge.comms.is_blackout

    if is_now_blackout:
        # Entering or staying in BLACKOUT: buffer, HQ stale
        payload = packet.model_dump(mode="json")
        await buffer_packet(sid, packet.packet_id, packet.timestamp, seq, payload)
        # Do NOT broadcast to dashboard (HQ remains at last sync)
        # But we should ensure HQ not updated (engine already handled)
        log.info(f"[STORE] buffered scenario {request.scenario} for {sid.value} seq={seq} blackout={is_now_blackout}")
        return {"ok": True, "sequence": seq, "buffered": True, "blackout": True}
    else:
        # ONLINE or RESTORATION
        if prev_blackout:
            # RESTORATION path: need to replay buffered before broadcasting current
            # Check buffered count
            buffered = await get_unsynced_count(sid)
            if buffered > 0:
                # Mark syncing
                engine.set_syncing(sid, True)
                start = datetime.now(tz=timezone.utc)
                # Retrieve all buffered
                packets = await get_unsynced_packets(sid, limit=1000)
                # Send replay via broadcast with is_buffered True
                # We will broadcast each as replay
                for row in packets:
                    payload = json.loads(row["payload"])
                    payload["is_buffered"] = True
                    payload["source"] = "replay"
                    # Ensure packet_id, sequence from row
                    payload["packet_id"] = row["packet_id"]
                    payload["sequence"] = row["sequence"]
                    payload["timestamp"] = row["timestamp"]
                    await manager.broadcast(sid.value, payload)
                    await asyncio.sleep(0.05)

                # Mark synced
                await mark_synced([r["packet_id"] for r in packets])
                duration = (datetime.now(tz=timezone.utc) - start).total_seconds()
                # Update HQ to current edge
                engine._hq_states[sid] = updated_edge.model_copy(deep=True)
                engine._hq_sequence[sid] = seq
                engine.complete_sync(sid, len(packets), duration, updated_edge.timestamp)
                # Broadcast current live HQ packet after replay
                hq_packet = TelemetryPacket(
                    station_id=sid,
                    timestamp=updated_edge.timestamp,
                    sequence=seq,
                    state=engine.get_hq_state(sid),
                    is_buffered=False,
                    source="live",
                )
                await manager.broadcast(sid.value, hq_packet.model_dump(mode="json"))
                return {"ok": True, "sequence": seq, "buffered": False, "sync_complete": True, "replayed": len(packets), "duration_s": duration}
            else:
                # No buffered but was blackout, just sync HQ
                engine._hq_states[sid] = updated_edge.model_copy(deep=True)
                engine._hq_sequence[sid] = seq
                engine.complete_sync(sid, 0, 0, updated_edge.timestamp)
                await manager.broadcast(sid.value, packet.model_dump(mode="json"))
                return {"ok": True, "sequence": seq, "restored": True}
        else:
            # Normal online scenario change
            engine._hq_states[sid] = updated_edge.model_copy(deep=True)
            engine._hq_sequence[sid] = seq
            if engine._sync_meta[sid].get("is_syncing"):
                engine.complete_sync(sid, 0, 0, updated_edge.timestamp)
            await manager.broadcast(sid.value, packet.model_dump(mode="json"))
            return {"ok": True, "sequence": seq}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@router.websocket("/ws/{station_id}")
async def websocket_endpoint(websocket: WebSocket, station_id: str):
    """
    Live telemetry stream for a station – Phase 6 HQ (cloud) view.

    - On connect: sends current HQ state immediately (source='initial', HQ timestamp).
    - Then: ticks EDGE every WS_TICK_INTERVAL_S, but only broadcasts HQ when ONLINE.
    - During BLACKOUT: EDGE advances and buffers to SQLite, HQ stays stale, dashboard sees stale.
    - On RESTORATION: replays buffered (is_buffered=True, source='replay') then HQ live, marks SYNC COMPLETE.
    """
    try:
        sid = StationID(station_id.upper())
    except ValueError:
        await websocket.close(code=4004, reason=f"Unknown station: {station_id}")
        return

    await manager.connect(websocket, sid.value)

    try:
        # Send initial HQ state immediately on connection (cloud view)
        hq_state = engine.get_hq_state(sid)
        seq = engine._hq_sequence[sid] if hasattr(engine, '_hq_sequence') else engine.next_sequence(sid)
        # For initial, ensure HQ sequence is used
        if seq == 0:
            seq = engine.next_sequence(sid)
            engine._hq_sequence[sid] = seq
        initial_packet = TelemetryPacket(
            station_id=sid,
            timestamp=hq_state.timestamp,
            sequence=seq,
            state=hq_state,
            is_buffered=False,
            source="initial",
        )
        await websocket.send_json(initial_packet.model_dump(mode="json"))

        # Listen for client messages (acks, overrides) while ticking
        async def receive_loop():
            while True:
                try:
                    msg = await websocket.receive_json()
                    # Phase 6: handle acks for sync confirmation
                    # Expected: {"type":"ack", "last_received_sequence": N}
                    if isinstance(msg, dict) and msg.get("type") == "ack":
                        last_seq = msg.get("last_received_sequence")
                        if last_seq is not None:
                            # Could mark synced up to last_seq, but we use DB
                            log.debug(f"WS ack from client {sid.value} seq={last_seq}")
                    else:
                        log.debug("WS message from client: %s", msg)
                except WebSocketDisconnect:
                    return
                except Exception as exc:
                    log.warning("WS receive error: %s", exc)
                    return

        async def tick_loop():
            while True:
                await asyncio.sleep(WS_TICK_INTERVAL_S)
                try:
                    # Always advance EDGE (live simulator)
                    updated_edge = engine.tick(sid)
                    edge_seq = engine.next_sequence(sid)

                    # Create EDGE packet (for buffering)
                    edge_packet = TelemetryPacket(
                        station_id=sid,
                        timestamp=updated_edge.timestamp,
                        sequence=edge_seq,
                        state=updated_edge,
                        is_buffered=False,
                        source="live",
                    )

                    if updated_edge.comms.is_blackout:
                        # BLACKOUT: store to SQLite, do NOT send to HQ/dashboard
                        payload = edge_packet.model_dump(mode="json")
                        await buffer_packet(sid, edge_packet.packet_id, edge_packet.timestamp, edge_seq, payload)
                        log.debug(f"[STORE] tick buffered {sid.value} seq={edge_seq} blackout_duration={updated_edge.comms.blackout_duration_s}")
                        # HQ remains stale – do not send to websocket
                        continue

                    # ONLINE path – check if we were previously in blackout and have buffered
                    was_blackout = engine._was_blackout.get(sid, False)
                    # Query DB for buffered count
                    try:
                        buffered_cnt = await get_unsynced_count(sid)
                    except Exception as exc:
                        log.warning(f"DB count error: {exc}")
                        buffered_cnt = 0

                    if was_blackout and buffered_cnt > 0:
                        # RESTORATION – enter SYNCING
                        engine.set_syncing(sid, True)
                        start = datetime.now(tz=timezone.utc)
                        log.info(f"[SYNC] restoration detected for {sid.value}, buffered={buffered_cnt}, starting replay")
                        # Notify client that syncing started (send HQ stale with syncing flag? We'll send replay packets)
                        # Send buffered replay
                        packets = await get_unsynced_packets(sid, limit=1000)
                        # Send each buffered as replay
                        for row in packets:
                            try:
                                payload = json.loads(row["payload"])
                            except Exception:
                                payload = json.loads(row["payload"]) if isinstance(row["payload"], str) else row["payload"]
                            payload["is_buffered"] = True
                            payload["source"] = "replay"
                            # Keep original packet_id/sequence/timestamp from row
                            payload["packet_id"] = row["packet_id"]
                            payload["sequence"] = row["sequence"]
                            payload["timestamp"] = row["timestamp"]
                            # Send to this specific websocket (and also broadcast to all for simplicity)
                            ok = await manager.send_json(websocket, payload)
                            if not ok:
                                # Client gone, abort sync
                                return
                            await asyncio.sleep(0.05)  # simulate sync duration (50ms per packet)
                        # Mark synced
                        await mark_synced([r["packet_id"] for r in packets])
                        duration = (datetime.now(tz=timezone.utc) - start).total_seconds()
                        # Update HQ to current EDGE
                        engine._hq_states[sid] = updated_edge.model_copy(deep=True)
                        engine._hq_sequence[sid] = edge_seq
                        engine.complete_sync(sid, len(packets), duration, updated_edge.timestamp)
                        log.info(f"[SYNC] complete for {sid.value} replayed={len(packets)} duration={duration:.2f}s")

                        # Now send current HQ live packet
                        hq_state = engine.get_hq_state(sid)
                        hq_packet = TelemetryPacket(
                            station_id=sid,
                            timestamp=hq_state.timestamp,
                            sequence=edge_seq,
                            state=hq_state,
                            is_buffered=False,
                            source="live",
                        )
                        ok = await manager.send_json(websocket, hq_packet.model_dump(mode="json"))
                        if not ok:
                            return
                        # Also ensure was_blackout cleared (complete_sync does)
                    else:
                        # Normal ONLINE – no buffered, just sync HQ and broadcast
                        # Update HQ
                        engine._hq_states[sid] = updated_edge.model_copy(deep=True)
                        engine._hq_sequence[sid] = edge_seq
                        # Clear any lingering sync flag
                        if engine._sync_meta[sid].get("is_syncing"):
                            engine.complete_sync(sid, 0, 0, updated_edge.timestamp)
                        engine._was_blackout[sid] = False

                        hq_state = engine.get_hq_state(sid)
                        hq_packet = TelemetryPacket(
                            station_id=sid,
                            timestamp=hq_state.timestamp,
                            sequence=edge_seq,
                            state=hq_state,
                            is_buffered=False,
                            source="live",
                        )
                        ok = await manager.send_json(websocket, hq_packet.model_dump(mode="json"))
                        if not ok:
                            return  # client gone
                except Exception as exc:
                    log.error("Tick error for %s: %s", sid, exc)
                    return

        # Run both loops concurrently; stop when either exits
        done, pending = await asyncio.wait(
            [
                asyncio.create_task(receive_loop()),
                asyncio.create_task(tick_loop()),
            ],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.error("WS handler error for %s: %s", station_id, exc)
    finally:
        manager.disconnect(websocket, sid.value)
