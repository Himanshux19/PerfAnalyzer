import json
import logging
import re
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from models import ApiRequest, CreateTestRequest

logger = logging.getLogger("perfanalyzer")

DISCOVERY_PATHS = ["/openapi.json", "/swagger.json", "/v3/api-docs"]


def resolve_ref(ref: str, spec: dict) -> dict:
    """Recursively resolves a JSON schema reference like #/components/schemas/Product."""
    if not ref or not ref.startswith("#/"):
        return {}
    parts = ref.split("/")[1:]
    current = spec
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return {}
    return current


def generate_dummy_val(schema: dict, spec: dict, seen: set = None) -> Any:
    """Generates dummy placeholder values for various schema types, breaking cyclic dependencies."""
    if seen is None:
        seen = set()
    if not isinstance(schema, dict):
        return None

    ref = schema.get("$ref")
    if ref:
        if ref in seen:
            return {}
        seen.add(ref)
        resolved = resolve_ref(ref, spec)
        return generate_dummy_val(resolved, spec, seen.copy())

    prop_type = schema.get("type")
    if not prop_type and "properties" in schema:
        prop_type = "object"

    if prop_type == "string":
        if "enum" in schema and schema["enum"]:
            return schema["enum"][0]
        return "string"
    elif prop_type in ("integer", "number"):
        return 1
    elif prop_type == "boolean":
        return True
    elif prop_type == "array":
        items = schema.get("items", {})
        if isinstance(items, dict):
            return [generate_dummy_val(items, spec, seen.copy())]
        return []
    elif prop_type == "object":
        return generate_dummy_body(schema, spec, seen.copy())
    return None


def generate_dummy_body(schema: dict, spec: dict, seen: set = None) -> dict:
    """Generates a dummy request body representing the structure of the schema."""
    if seen is None:
        seen = set()
    if not schema or not isinstance(schema, dict):
        return {}

    ref = schema.get("$ref")
    if ref:
        if ref in seen:
            return {}
        seen.add(ref)
        schema = resolve_ref(ref, spec)

    schema_type = schema.get("type")
    if not schema_type and "properties" in schema:
        schema_type = "object"

    if schema_type == "object":
        body = {}
        properties = schema.get("properties", {})
        for prop_name, prop_schema in properties.items():
            if isinstance(prop_schema, dict):
                body[prop_name] = generate_dummy_val(prop_schema, spec, seen.copy())
        return body
    elif schema_type == "array":
        items = schema.get("items", {})
        if isinstance(items, dict):
            return [generate_dummy_val(items, spec, seen.copy())]
        return []
    return {}


def resolve_path_parameters(path: str, parameters: list, spec: dict) -> str:
    """Replaces path parameter placeholders (e.g. {id}) with concrete dummy values like 1."""
    params_in_path = re.findall(r"\{([^}]+)\}", path)
    if not params_in_path:
        return path

    param_values = {}
    for p in parameters:
        if not isinstance(p, dict):
            continue
        if "$ref" in p:
            p = resolve_ref(p["$ref"], spec)
        if not isinstance(p, dict):
            continue

        if p.get("in") == "path":
            name = p.get("name")
            schema = p.get("schema", {})
            if "$ref" in schema:
                schema = resolve_ref(schema["$ref"], spec)
            default_val = schema.get("default")

            if default_val is not None:
                param_values[name] = str(default_val)
            elif schema.get("type") in ("integer", "number"):
                param_values[name] = "1"
            elif schema.get("type") == "boolean":
                param_values[name] = "true"
            else:
                if name.lower().endswith("id"):
                    param_values[name] = "1"
                else:
                    param_values[name] = "default"

    resolved_path = path
    for name in params_in_path:
        val = param_values.get(name, "1" if name.lower().endswith("id") else "default")
        resolved_path = resolved_path.replace(f"{{{name}}}", val)
    return resolved_path


def discover_openapi(base_url: str) -> List[ApiRequest]:
    """Discovers APIs exposed by the baseUrl using OpenAPI / Swagger specification JSON."""
    base_url_clean = base_url.rstrip("/")
    spec = None
    last_error = None

    for path in DISCOVERY_PATHS:
        url = f"{base_url_clean}{path}"
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "PerfAnalyzer/1.0", "Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    content = response.read().decode("utf-8")
                    spec = json.loads(content)
                    logger.info("Successfully fetched spec from: %s", url)
                    break
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code} for {url}"
        except urllib.error.URLError as e:
            last_error = f"URL connection failed for {url}: {e.reason}"
        except json.JSONDecodeError as e:
            last_error = f"Invalid JSON format at {url}: {str(e)}"
        except Exception as e:
            last_error = f"Unexpected error fetching {url}: {str(e)}"

    if not spec:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to discover OpenAPI spec from {base_url}. Last error: {last_error or 'No response'}",
        )

    paths_dict = spec.get("paths", {})
    if not isinstance(paths_dict, dict) or not paths_dict:
        raise HTTPException(
            status_code=400, detail="OpenAPI specification does not contain a valid 'paths' object."
        )

    api_requests = []
    http_methods = {"get", "post", "put", "delete", "patch", "head", "options"}

    for path_key, path_item in paths_dict.items():
        if not isinstance(path_item, dict):
            continue

        path_params = path_item.get("parameters", [])
        if not isinstance(path_params, list):
            path_params = []

        for method_key, operation in path_item.items():
            if method_key.lower() not in http_methods:
                continue
            if not isinstance(operation, dict):
                continue

            method = method_key.upper()

            op_params = operation.get("parameters", [])
            if not isinstance(op_params, list):
                op_params = []
            merged_params = path_params + op_params

            # Path parameter resolution (e.g. /products/{id} -> /products/1)
            resolved_path = resolve_path_parameters(path_key, merged_params, spec)
            clean_path = resolved_path.lstrip("/")
            full_url = f"{base_url_clean}/{clean_path}"

            body = None
            headers = {}

            # 1. Try OpenAPI 3.x requestBody
            request_body = operation.get("requestBody")
            if request_body:
                if "$ref" in request_body:
                    request_body = resolve_ref(request_body["$ref"], spec)
                if isinstance(request_body, dict):
                    content_dict = request_body.get("content", {})
                    json_content = content_dict.get("application/json") or content_dict.get(
                        "application/x-www-form-urlencoded"
                    )
                    if json_content and isinstance(json_content, dict):
                        schema = json_content.get("schema", {})
                        body = generate_dummy_body(schema, spec)
                        headers["Content-Type"] = "application/json"

            # 2. Try Swagger 2.0 body parameters
            if not body:
                for p in merged_params:
                    if not isinstance(p, dict):
                        continue
                    if "$ref" in p:
                        p = resolve_ref(p["$ref"], spec)
                    if not isinstance(p, dict):
                        continue
                    if p.get("in") == "body":
                        schema = p.get("schema", {})
                        body = generate_dummy_body(schema, spec)
                        headers["Content-Type"] = "application/json"
                        break

            if not body and method in ("POST", "PUT", "PATCH"):
                body = {}
                headers["Content-Type"] = "application/json"

            sampler_name = f"{method} {path_key}"

            api_requests.append(
                ApiRequest(
                    url=full_url,
                    method=method,
                    headers=headers if headers else None,
                    body=body if body else None,
                    name=sampler_name,
                )
            )

    return api_requests


from urllib.parse import urlsplit

def discover_endpoints(request: CreateTestRequest) -> tuple[List[ApiRequest], str]:
    """
    Attempts to discover endpoints via OpenAPI.
    If discovery fails, falls back to Single Endpoint Mode.
    Returns:
        (api_requests, mode_used)
    """
    target_url = str(request.baseUrl or request.url)
    
    if request.discovery.lower() == "openapi":
        try:
            logger.info("Attempting OpenAPI discovery for: %s", target_url)
            api_requests = discover_openapi(target_url)
            if api_requests:
                return api_requests, "openapi"
        except Exception as e:
            logger.warning("OpenAPI discovery failed for %s: %s. Falling back to Single Endpoint Mode.", target_url, e)
            
    # Fallback to Single Endpoint Mode
    parsed = urlsplit(target_url)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
        
    method = (request.method or "GET").upper()
    sampler_name = f"{method} {path}"
    
    fallback_req = ApiRequest(
        url=target_url,
        method=method,
        headers=request.headers,
        body=request.body,
        name=sampler_name
    )
    return [fallback_req], "single"
