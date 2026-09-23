# AURORA — Antarctic Digital Twin Platform

**Operational digital twin for Indian Antarctic Research Stations Maitri & Bharati — MoES / NCPOR (SIH26060)**

> Scientific operations platform for remote station management under extreme Antarctic constraints. No marketing copy, no AI gloss — just physics, telemetry, and store-and-forward.

![Status](https://img.shields.io/badge/status-operational-4caf7d) ![Backend](https://img.shields.io/badge/backend-FastAPI-009688) ![Frontend](https://img.shields.io/badge/frontend-Next.js_16-black) ![License](https://img.shields.io/badge/license-MIT-556070)

---

## 1. Overview

AURORA provides a **live digital twin** of Maitri (Schirmacher Oasis, 70.77°S) and Bharati (Larsemann Hills, 69.41°S). It simulates thermal, power, logistics and comms physics, exposes them via REST + WebSocket, and renders them in a dark, high-density operations console intended for NCPOR engineers — not a generic dashboard.

**Key guarantees:**

* Every displayed number carries provenance: `live` / `sim` / `calc` / `cached` / `baseline` — simulated data never masquerades as verified telemetry.
* All scenario cascades are computed in the simulation engine, not hard-coded in the UI.
* Edge continues advancing during SAT-COM blackout; HQ shows stale cached state from SQLite, then replays.

---

## 2. Architecture

```mermaid
flowchart TB
    subgraph EDGE["EDGE — Antarctic Station (Maitri/Bharati)"]
        SIM[SimulatorEngine<br/>physics tick every 5s]
        DB[(SQLite<br/>aurora_telemetry.db<br/>telemetry_buffer + scenario_log)]
        SIM -->|tick: thermal→power→fuel→risk| EDGE_STATE[Edge State<br/>always live]
        EDGE_STATE -->|is_blackout? buffer| DB
    end

    subgraph HQ["HQ CLOUD — Gateway"]
        HQ_STATE[HQ State<br/>last synced]
        SYNC[Sync Status<br/>link: ONLINE/DEGRADED/OFFLINE/SYNCING]
        HQ_STATE <--> SYNC
    end

    EDGE_STATE -.->|online: copy| HQ_STATE
    DB -->|restoration: replay is_buffered| HQ_STATE

    subgraph API["FastAPI 8000"]
        REST[REST /api/stations<br/>/state /edge/state /sync/status]
        WS[WebSocket /api/ws/{id}<br/>TelemeteryPacket]
    end

    HQ_STATE --> REST
    HQ_STATE --> WS
    EDGE_STATE --> REST

    subgraph FE["Next.js 16 Frontend 3000"]
        TOP[TopBar<br/>LINK + VSAT + LIVE + UTC]
        DASH[Dashboard Grid<br/>Environment/Power/Logistics/Risk/Alerts/Comms]
        TWIN[Digital Twin Schematic<br/>2D SVG]
        SCEN[Scenario Engine<br/>6 stress tests]
        COMMS[CommsPanel<br/>HQ vs EDGE + SQLite queue]
    end

    WS -->|HQ live or replay| FE
    REST --> FE
    FE -->|POST /scenario /environment| EDGE
```

**Data flow (normal):** `Simulator tick (physics) → Edge State → (link ONLINE) → HQ copy → REST + WebSocket → Frontend (LIVE)`

**Data flow (blackout):** `Edge tick → SQLite buffer (timestamp, station_id, sequence, compact JSON) → HQ frozen → Frontend shows STALE, LINK: OFFLINE, queued pkts`

**Data flow (restoration):** `Operator clears satcom_blackout → get_unsynced_packets ORDER BY sequence → broadcast is_buffered=True source=replay (50ms spacing) → mark_synced → HQ = EDGE → SYNC COMPLETE (replayed N, duration, latest timestamp) → LINK: ONLINE`

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| **Backend** | **FastAPI** + **Uvicorn[standard]** | Async REST + WebSocket, Pydantic validation, single OpenAPI spec |
| **Models** | **Pydantic v2** + `computed_field` | Strict `StationState` contract, derived `autonomy_days`, `deficit_kw`, `load_pct` |
| **Physics** | Pure Python `app/physics` | No I/O, deterministic. `JAG/TI 2001` wind chill, `Q_heat = α·(21−T)·(1+0.02·V)`, `P_total = base+Q_heat+science+life`, `F_rate = P·0.28 L/kWh`, `autonomy = diesel/(F·24)` |
| **Simulation** | `SimulatorEngine` singleton | Holds `_states` (EDGE), `_hq_states` (HQ), `_baseline`, `_sequence`/`_hq_sequence`, `_env_overrides`, `_sync_meta`, `_was_blackout`. Tick is physics + load-shedding + risk scoring |
| **Persistence** | **aiosqlite** `aurora_telemetry.db` | `telemetry_buffer (packet_id, timestamp, sequence, payload compact, synced)` + `scenario_log`. Compact JSON via `separators=(',',':')` |
| **Realtime** | `websockets` via FastAPI | `ConnectionManager` per-station broadcast, per-connection `tick_loop` + `receive_loop` |
| **Frontend** | **Next.js 16.3.6 (Turbopack)** + **React 19.2** + **TypeScript 5** | App Router, `useStationSocket` hook with exponential backoff, `fetch` for REST |
| **Styling** | **globals.css design tokens** + **Inter + JetBrains Mono** | Dark command console: `surface-base #0c0e11`, `status-normal #4caf7d` etc., no gradients/glass/shadows, `4px` spacing scale, tabular numbers |
| **Infra** | `venv` backend, `npm` frontend, CORS `localhost:3000` → `8000` | Local dev, no Docker drift |

**Single source of truth:** `backend/app/config.py` — `StationMeta`, `OperationalThresholds` (fuel 30/14d, power 5/20kW, wind chill -35/-50°C), `PhysicsConstants`, `DB_PATH`, `WS_TICK_INTERVAL_S=5.0`.

---

## 4. Features

### 4.1 Digital Twin & Parameter Cascade
* Schematic SVG for Maitri (stilted) vs Bharati (coastal block), clickable modules → `MetricRow` telemetry.
* `ParameterGraph` shows live cascade: `Environment °C → Thermal kW → Power kW → Fuel L/h → Runway days → Risk` — all `calc` provenance.

### 4.2 Stress-Test Scenarios (Phase 5)

All 6 call `POST /api/station/{id}/scenario` → engine `tick()`; UI only renders resulting state (table `Metric | Baseline | Scenario | Change`).

| Scenario | Change | Cascade | Risk |
|---|---|---|---|
| **POLAR VORTEX** | `temp → -55°C` | thermal→HVAC→gen→fuel→runway→risk | `ENV critical` |
| **KATABATIC BLIZZARD** | `wind → 90 kn (46.3 m/s)` | thermal loss→power→structural→shedding | `ENV critical, shedding` |
| **MAIN GENERATOR FAILURE** | `GEN-1 → OFFLINE` | capacity→shedding→power→overall | `POWER warning` |
| **SAT-COM BLACKOUT** | `comms → offline` | cached→buffer→sync | `OFFLINE` |
| **RESUPPLY DELAY** | `arrival +30d delayed` | runway vs window→logistics critical | `FUEL critical` |
| **RENEWABLE BOOST** | `solar 20 + wind 50 kW` | gen→fuel→runway→emissions | `fuel 8.5→0 L/h` |

### 4.3 Store-and-Forward (Phase 6)

* **NORMAL:** `LINK: ONLINE`, HQ = EDGE, `SYNC` live.
* **BLACKOUT (`satcom_blackout`):** `LINK: OFFLINE`, HQ frozen at `hq_timestamp`, EDGE advances, `buffered_packets++`, SQLite insert, `staleness_s` grows, `CommsPanel` shows `HQ STALE · EDGE LIVE` + queued count.
* **Operator env change during blackout:** `POST /environment {"temperature_c":-30}` → EDGE `-30°C`, HQ stays `-22°C` → proves no freeze.
* **Restoration:** clear scenario → `get_unsynced_packets` → broadcast `is_buffered True, source replay` → `mark_synced` → `HQ = EDGE` → `LINK: SYNCING` (pulse) → `SYNC COMPLETE` with `replayed N`, `duration s`, `latest timestamp`.

### 4.4 Operations Console UX (Production)

* **No AI slop:** flat surfaces, `1px` borders, `2px` top accent, no gradients/glass/rounded `128px`, no emojis, no fake activity, no shadows.
* **Typography hierarchy:** Application title `14px/700 mono`, Section heading `11px/600 mono`, Metric label `9px sans`, Metric value `13px mono tabular`, Unit `10px muted`, Status `10px/600`, Timestamp `10px mono`.
* **Spacing:** `4px` scale (`--sp-1`..`--sp-12`), `12px` grid gap, `200px` sidebar, `44px` topbar.
* **Microinteractions only where it communicates:** `blink` for CONNECTING/SYNCING, `pulse-critical 4s` for critical dot, `link-transition` for LINK changes, `alert-in` for alerts, `sync-fill` for progress. No floating cards.
* **Responsive:** `dashboard-grid` `3 → 2 → 1` col at `1200/800px`; `scenario-engine-grid` / `twin-grid` stack at `900px`; `overflow-x:hidden`, `min-width:0`, `table-layout:fixed` prevents overflow at `1366×768`, `1440×900`, `1920×1080`.
* **Keyboard:** all buttons `tabIndex` + `focus-visible: 2px accent`, SVG modules `role=button` + `onKeyDown`.

---

## 5. Project Structure

```
aurora/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI lifespan, CORS, router mount
│   │   ├── config.py            # StationMeta, thresholds, physics, DB_PATH, WS interval
│   │   ├── physics/__init__.py  # wind_chill, thermal, power, fuel, autonomy, risk
│   │   ├── models/              # Pydantic: station, environment, energy, logistics, risk, telemetry
│   │   │   └── station.py       # CommsStatus (is_blackout, buffered_packets)
│   │   ├── simulator/__init__.py# SimulatorEngine (EDGE/HQ, overrides, tick physics)
│   │   ├── db/store.py          # aiosqlite buffer_packet, get_unsynced, mark_synced, get_unsynced_count
│   │   └── api/
│   │       ├── router.py        # REST + WS, EDGE/HQ branching, replay
│   │       └── websocket.py     # ConnectionManager (per-station broadcast)
│   ├── requirements.txt
│   ├── aurora_telemetry.db      # SQLite (generated)
│   └── venv/                    # Python 3.14 venv
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css      # Design tokens, typography scale, grid, states, provenance
│   │   │   ├── layout.tsx       # Metadata, fonts preconnect
│   │   │   ├── page.tsx         # Station selector (2 cards, live risk)
│   │   │   └── station/[id]/page.tsx # Dashboard shell (TopBar, Sidebar, grid, Comms+Scenario)
│   │   ├── components/
│   │   │   ├── layout/TopBar.tsx    # LINK: ONLINE/DEGRADED/OFFLINE/SYNCING, VSAT, LIVE, UTC
│   │   │   ├── layout/Sidebar.tsx   # Station switcher + Modules nav
│   │   │   ├── ui/SectionPanel.tsx  # 2px top accent, provenance badge, status
│   │   │   ├── ui/MetricRow.tsx     # label | value tabular | unit | status dot
│   │   │   └── dashboard/           # EnvironmentCard, PowerCard, LogisticsCard, RiskCard, AlertsPanel, ControlsPanel, DigitalTwinView, ParameterGraph, CommsPanel (HQ vs EDGE), ScenarioEngine
│   │   └── lib/
│   │       ├── types.ts         # TS mirrors of Pydantic + SyncStatus, LinkStatus
│   │       ├── constants.ts     # STATIONS, THRESHOLDS, STATUS_CONFIG
│   │       └── websocket.ts     # useStationSocket (WS + sync/edge polling every 3s)
│   ├── package.json             # Next 16.3.6, React 19.2, TS 5
│   └── next.config.ts
└── README.md
```

---

## 6. Quick Start

### Prerequisites
* Python 3.11+ (tested 3.14), Node 20+, `npm`

### 1. Backend

```bash
cd backend
# venv already present; if not:
python -m venv venv

# Windows
.\venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Run
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/api/docs (Swagger)
# → http://localhost:8000/api/health
# → ws://localhost:8000/api/ws/MAITRI
```

`init_db()` creates `aurora_telemetry.db` if missing; `SimulatorEngine.initialize()` seeds Maitri (`-22°C, 8.5 m/s, 185kl diesel`) and Bharati.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
npm run build # production check (Turbopack, TS, static pages)
```

### 3. Environment

No `.env` required for local dev. For custom URLs:

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/ws
```

---

## 7. API

**REST (HQ = cloud, stale during blackout):**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | `{"status":"ok","stations":["MAITRI","BHARATI"]}` |
| `GET` | `/api/stations` | List with `risk_overall`/`comms_status` from HQ |
| `GET` | `/api/station/{id}/state` | HQ state (what dashboard shows) |
| `GET` | `/api/station/{id}/edge/state` | EDGE live state (always advancing) |
| `GET` | `/api/station/{id}/sync/status` | `{edge_sequence,hq_sequence,edge_timestamp,hq_timestamp,is_blackout,is_syncing,link_status,db_buffered,staleness_s,last_sync_*}` |
| `POST` | `/api/station/{id}/environment` | Body `EnvironmentOverride` → EDGE tick, buffered if offline else HQ |
| `POST` | `/api/station/{id}/scenario` | Body `{"scenario":"polar_vortex"\|...\|null}` → triggers `tick()` + store/replay |

**WebSocket:**

```
ws://localhost:8000/api/ws/{MAITRI|BHARATI}
→ {"packet_id","station_id","timestamp","sequence","state":StationState,"is_buffered":bool,"source":"initial|live|replay|scenario"}
```

* `initial` on connect (HQ)
* `live` every 5s when `LINK: ONLINE` (HQ)
* silence when `OFFLINE` (HQ stale, EDGE buffered)
* `replay is_buffered True` burst on restoration, then `live`

---

## 8. Demo — The Critical Workflow

This is the **one workflow** that proves the platform:

```bash
# 1. NORMAL
curl http://localhost:8000/api/station/MAITRI/sync/status | jq .link_status
# → ONLINE, hq_timestamp == edge_timestamp, db_buffered 0

# 2. BLACKOUT
curl -X POST http://localhost:8000/api/station/MAITRI/scenario -H "Content-Type: application/json" -d '{"scenario":"satcom_blackout"}'
# → LINK: OFFLINE, HQ stale (2026-...), EDGE live, is_blackout True

# 3. Change env during blackout (edge continues, HQ not)
curl -X POST http://localhost:8000/api/station/MAITRI/environment -H "Content-Type: application/json" -d '{"station_id":"MAITRI","temperature_c":-30,"wind_speed_ms":15}'
# → EDGE temp -30, HQ temp -22 (check /edge/state vs /state), db_buffered 2

# 4. Restore
curl -X POST http://localhost:8000/api/station/MAITRI/scenario -H "Content-Type: application/json" -d '{"scenario":null}'
# → replays 2 buffered is_buffered True, then live; LINK: SYNCING (50ms/pkt) → SYNC COMPLETE

# 5. Verify HQ = EDGE after sync
curl http://localhost:8000/api/station/MAITRI/sync/status | jq '{hq: .hq_timestamp, edge: .edge_timestamp, link: .link_status, replayed: .last_sync_buffered}'
# → hq == edge, link ONLINE, last_sync_buffered 2, duration ~0.12s
```

In the dashboard: `TopBar` shows `LINK: OFFLINE STALE 2 PKT QUEUED` → `SYNCING...` pulse → `SYNC COMPLETE 2 pkts 0.12s`; `CommsPanel` shows `HQ CLOUD STATE` vs `EDGE STATE` tables diverging then converging.

---

## 9. Physics & Data Provenance

* **Wind chill:** `WC = 13.12 +0.6215·T −11.37·V^0.16 +0.3965·T·V^0.16`
* **Thermal:** `Q_heat = α·(21−T)·(1+0.02·V)` α=0.01
* **Power:** `P_total = 15+Q_heat+10+5` (base+science+life), `P_net = max(0, P_total−solar−wind)`, dispatch evenly across available gens (`0.28 L/kWh`)
* **Fuel:** `F_rate = Σ gen_fuel`, `diesel -= F·dt/3600`, `autonomy = diesel/(F·24)`
* **Risk:** `R = 0.35·Fuel +0.25·Power +0.25·Structural +0.15·Env` → `>75 critical, >50 warning` + `derive_overall` worst factor.

Every card header carries a provenance badge: `live` (WS HQ), `sim` (Antarctic model), `calc` (derived), `cached` (HQ stale), `baseline` (pre-scenario).

---

## 10. UX Principles (Production)

* Flat `1px` borders, `2px` top accent only, no shadows/gradients/glass.
* `JetBrains Mono` for numbers (tabular), `Inter` for UI, `9–13px` hierarchy, units always explicit (`°C`, `kW`, `days`, `kn`, `hPa`, `m`, `L`, `s`, `pkts`).
* `12px` grid gap, `200px` sidebar, `44px` topbar — consistent at `1366/1440/1920`, no horizontal scroll, `min-width:0` prevents overflow.
* Alerts slide `alert-in`, link `pulse`/`blink` only for state, respects `prefers-reduced-motion`.
* Error states are operational panels: `Backend Unavailable` (`ERR_API_UNREACHABLE` + Retry), `WebSocket failure` (`ERR_WS_FAILURE`), `Link offline` (HQ cached, EDGE live, auto-reconnect), `No telemetry` (`ERR_EMPTY_DATA`), `Synchronization delay` (`SYNC: 50 pkts`), `Scenario error` (critical panel).

---

## 11. Verification

```bash
# Backend unit (physics + engine)
.\venv\Scripts\python.exe -m unittest test_simulation -v  # 11/11 pass

# Frontend production
npm run build  # ✓ Compiled, ✓ TypeScript, ✓ 3 routes

# Live
uvicorn app.main:app --reload --port 8000 & npm run dev
# → http://localhost:3000 → Maitri → TopBar LINK: ONLINE → Apply SAT-COM BLACKOUT → LINK: OFFLINE → change temp → CommsPanel HQ -22 vs EDGE -30 → Clear → SYNCING → SYNC COMPLETE
```

---

## 12. Deployment

*No secrets, no env drift.* `CORS` allows `localhost:3000`. For production, set `NEXT_PUBLIC_API_URL`/`WS_URL` and serve `frontend` via `next start` behind reverse proxy, `backend` via `uvicorn app.main:app --host 0.0.0.0 --port 8000` with `DB_PATH` persistent volume.

---

## 13. License & Credits

* `NCPOR / MoES` — National Centre for Polar and Ocean Research, Ministry of Earth Sciences.
* Stations: Maitri (1989, 25S/8W) — Bharati (2012, 23S/0W).
* Built for **SIH26060**. Design: Antarctic operations console, not SaaS.

> Run it: `cd backend && uvicorn app.main:app --reload --port 8000` + `cd frontend && npm run dev` → `http://localhost:3000`
