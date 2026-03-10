# apps/api/main.py — FastAPI Risk Engine entrypoint with OpenTelemetry
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# OpenTelemetry (optional — requires packages)
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=os.getenv("OTEL_ENDPOINT", "http://tempo:4317")))
    )
    trace.set_tracer_provider(tracer_provider)
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False

from routers import session, risk, geo, events
import ws_simulator
import ws_engine
import database
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database
    await database.init_db()
    yield

app = FastAPI(
    title="NEXUS TLS Risk Engine",
    description="Secure session management API with risk-adaptive timeouts, geo-fencing, and behavioral biometrics",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
cors_origins = os.getenv("CORS_ORIGINS", '["http://localhost:3000"]')
import json
app.add_middleware(
    CORSMiddleware,
    allow_origins=json.loads(cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(session.router)
app.include_router(risk.router)
app.include_router(geo.router)
app.include_router(events.router)
app.include_router(ws_simulator.router)
app.include_router(ws_engine.router)

# Instrument with OpenTelemetry if available
if OTEL_AVAILABLE:
    FastAPIInstrumentor.instrument_app(app)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "nexus-tls-risk-engine", "version": "2.0.0"}
