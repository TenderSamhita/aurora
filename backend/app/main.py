"""
aurora/backend/app/main.py

FastAPI application entry point.

Startup sequence:
  1. Initialize SQLite database
  2. Initialize SimulatorEngine (builds initial state for all stations)
  3. Register routes

Run:
  uvicorn app.main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .simulator import engine
from .api.router import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup → serve → shutdown."""
    log.info("AURORA backend starting up")

    # Database
    await init_db()

    # Simulation engine
    engine.initialize()
    log.info("SimulatorEngine initialized for stations: MAITRI, BHARATI")

    yield  # serve

    log.info("AURORA backend shutting down")


app = FastAPI(
    title="AURORA — Antarctic Digital Twin API",
    description=(
        "Backend for the AURORA digital twin platform for NCPOR's "
        "Indian Antarctic Research Stations (Maitri & Bharati)."
    ),
    version="0.1.0-phase1",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS — allow Next.js dev server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routes under /api prefix
# WebSocket routes are also in the same router (FastAPI handles /ws/* separately)
app.include_router(router, prefix="/api")
