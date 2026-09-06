import os
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
import uptrace
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend .env is loaded regardless of working directory
_backend_env = Path(__file__).resolve().parent / ".env"
if _backend_env.exists():
    load_dotenv(dotenv_path=_backend_env)
load_dotenv()

import logging
import opentelemetry.trace as trace_mod
from opentelemetry.trace import NoOpTracerProvider, ProxyTracerProvider

logger = logging.getLogger("perfanalyzer.tracing")

_TRACING_ACTIVE = False
_ACTIVE_SERVICE_NAME = None
_FASTAPI_APP = None

def _reset_tracer_provider():
    """Resets OpenTelemetry internal singletons so tracer providers can be dynamically swapped."""
    trace_mod._TRACER_PROVIDER = None
    trace_mod._TRACER_PROVIDER_SET_ONCE._done = False
    trace_mod._PROXY_TRACER_PROVIDER = ProxyTracerProvider()

def setup_tracing_uptrace(app=None, service_name=None, dsn=None):
    """
    Configures and activates Uptrace OpenTelemetry tracing for the backend.
    Accepts optional custom service_name and dsn.
    """
    global _TRACING_ACTIVE, _ACTIVE_SERVICE_NAME, _FASTAPI_APP
    if app is not None:
        _FASTAPI_APP = app

    target_service = (service_name or os.getenv("OTEL_SERVICE_NAME", "perfanalyzer-backend")).strip()
    target_dsn = (dsn or os.getenv("UPTRACE_DSN", "")).strip()

    if not target_dsn:
        logger.warning("No UPTRACE_DSN found. Backend monitoring not initialized.")
        return False

    try:
        _reset_tracer_provider()
        uptrace.configure_opentelemetry(
            dsn=target_dsn,
            service_name=target_service,
            service_version="1.0.0",
        )
        try:
            Psycopg2Instrumentor().instrument()
        except Exception:
            pass

        if _FASTAPI_APP:
            try:
                FastAPIInstrumentor.instrument_app(_FASTAPI_APP)
                # CRITICAL: Only rebuild middleware_stack if it was already initialized/cached.
                # During initial module load, middleware_stack is None and will build on first request.
                # During runtime re-enable, middleware_stack is already cached, so we must rebuild it.
                if getattr(_FASTAPI_APP, "middleware_stack", None) is not None and hasattr(_FASTAPI_APP, "build_middleware_stack"):
                    _FASTAPI_APP.middleware_stack = _FASTAPI_APP.build_middleware_stack()
            except Exception as e:
                logger.warning(f"Failed to attach FastAPI instrumentation middleware: {e}")

        _TRACING_ACTIVE = True
        _ACTIVE_SERVICE_NAME = target_service
        logger.info(f"OpenTelemetry tracing started for service '{target_service}'.")

        # Emit an immediate lifecycle span so Uptrace registers the service telemetry right away
        try:
            tracer = trace.get_tracer("perfanalyzer.lifecycle")
            with tracer.start_as_current_span("monitoring.service.active") as span:
                span.set_attribute("service.name", target_service)
                span.set_attribute("monitoring.status", "active")
            provider = trace.get_tracer_provider()
            if hasattr(provider, "force_flush"):
                provider.force_flush()
        except Exception:
            pass

        return True
    except Exception as e:
        logger.error(f"Failed to setup Uptrace tracing for '{target_service}': {e}")
        return False

def stop_tracing_uptrace(service_name=None, app=None):
    """
    Stops OpenTelemetry tracing in the backend.
    Shuts down tracer provider, uninstruments FastAPI/psycopg2, and swaps in NoOpTracerProvider.
    """
    global _TRACING_ACTIVE, _ACTIVE_SERVICE_NAME, _FASTAPI_APP
    app_to_uninstrument = app or _FASTAPI_APP
    current_svc = _ACTIVE_SERVICE_NAME or os.getenv("OTEL_SERVICE_NAME", "perfanalyzer-backend")
    target_svc = service_name or current_svc

    try:
        tp = trace.get_tracer_provider()
        if hasattr(tp, "shutdown"):
            try:
                tp.shutdown()
            except Exception:
                pass

        _reset_tracer_provider()
        trace_mod.set_tracer_provider(NoOpTracerProvider())

        if app_to_uninstrument:
            try:
                FastAPIInstrumentor.uninstrument_app(app_to_uninstrument)
            except Exception:
                pass

        try:
            Psycopg2Instrumentor().uninstrument()
        except Exception:
            pass

        _TRACING_ACTIVE = False
        _ACTIVE_SERVICE_NAME = None
        logger.info(f"OpenTelemetry tracing stopped for service '{target_svc}'. Monitoring halted.")
        return True
    except Exception as e:
        logger.error(f"Error stopping Uptrace tracing for '{target_svc}': {e}")
        return False

def get_tracing_status():
    """Returns current active state and service name of backend tracing."""
    return {
        "active": _TRACING_ACTIVE,
        "service_name": _ACTIVE_SERVICE_NAME if _TRACING_ACTIVE else None
    }

def setup_tracing_jaeger(app, engine=None):
    resource = Resource.create({
        "service.name": "perfanalyzer-backend",
        "service.version": "1.0.0",
        "deployment.environment": "development"
    })

    provider = TracerProvider(
        resource=resource
    )

    exporter = OTLPSpanExporter(
        endpoint="http://localhost:4317",
        insecure=True
    )

    processor = BatchSpanProcessor(exporter)

    provider.add_span_processor(processor)

    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)

    if engine:
        SQLAlchemyInstrumentor().instrument(
            engine=engine
        )