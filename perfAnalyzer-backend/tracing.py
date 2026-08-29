import os
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
import uptrace
from dotenv import load_dotenv

load_dotenv()

def setup_tracing_uptrace():
    uptrace.configure_opentelemetry(
            dsn=os.getenv("UPTRACE_DSN"),
            service_name="perfanalyzer-backend",
            service_version="1.0.0",
        )
    
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