import json
import logging
import os
import re
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup

from models import CreateTestRequest

logger = logging.getLogger("perfanalyzer")

# Configuration loaded via environment variables
MAX_CRAWL_DEPTH = int(os.getenv("MAX_CRAWL_DEPTH", "3"))
MAX_PAGES = int(os.getenv("MAX_PAGES", "20"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "10"))
USER_AGENT = os.getenv("USER_AGENT", "PerfAnalyzer/1.0 (Automatic Endpoint Discovery)")
PLAYWRIGHT_TIMEOUT = int(os.getenv("PLAYWRIGHT_TIMEOUT", "30000"))


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


def is_same_domain(url: str, base_url: str) -> bool:
    """Checks if a URL belongs to the same domain (netloc) as the base URL."""
    try:
        parsed_url = urlsplit(url)
        parsed_base = urlsplit(base_url)
        return parsed_url.netloc.lower() == parsed_base.netloc.lower()
    except Exception:
        return False


def normalize_url(url: str) -> str:
    """Normalizes a URL by stripping fragments, trailing slashes (except root), and lowercasing."""
    try:
        parsed = urlsplit(url.split("#")[0])
        path = parsed.path or "/"
        if path != "/" and path.endswith("/"):
            path = path[:-1]
        return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, parsed.query, ""))
    except Exception:
        return url


def deduplicate_endpoints(endpoints: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicates a list of endpoints by (method, normalized_url)."""
    seen = set()
    unique = []
    for ep in endpoints:
        method = ep.get("method", "GET").upper()
        url = ep.get("url", "")
        if not url:
            continue
        norm_url = normalize_url(url)
        key = (method, norm_url)
        if key not in seen:
            seen.add(key)
            unique.append(ep)
    return unique


# --- Strategy 1: OpenAPI / Swagger ---
def discover_openapi(base_url: str) -> List[Dict[str, Any]]:
    """Discovers APIs exposed by the baseUrl using OpenAPI / Swagger specification JSON."""
    base_url_clean = base_url.rstrip("/")
    spec = None
    last_error = None
    discovery_paths = ["/v3/api-docs", "/swagger.json", "/openapi.json", "/api-docs"]

    with requests.Session() as session:
        session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})
        for path in discovery_paths:
            url = f"{base_url_clean}{path}"
            try:
                logger.info("Checking OpenAPI/Swagger endpoint: %s", url)
                res = session.get(url, timeout=REQUEST_TIMEOUT)
                if res.status_code == 200:
                    spec = res.json()
                    logger.info("Successfully fetched spec from: %s", url)
                    break
            except Exception as e:
                last_error = f"{type(e).__name__}: {str(e)}"

    if not spec:
        logger.warning("Failed to discover OpenAPI spec from %s. Last error: %s", base_url, last_error)
        return []

    paths_dict = spec.get("paths", {})
    if not isinstance(paths_dict, dict) or not paths_dict:
        return []

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

            api_requests.append({
                "url": full_url,
                "method": method,
                "headers": headers if headers else None,
                "body": body if body else None,
                "name": sampler_name,
            })

    return api_requests


# --- Strategy 2: Sitemap ---
def discover_sitemap(base_url: str) -> List[Dict[str, Any]]:
    """Discovers GET endpoints from sitemap.xml."""
    base_url_clean = base_url.rstrip("/")
    url = f"{base_url_clean}/sitemap.xml"
    endpoints = []

    try:
        logger.info("Checking Sitemap: %s", url)
        res = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, "xml")
            locs = [loc.text.strip() for loc in soup.find_all("loc") if loc.text]
            
            for loc in locs:
                try:
                    if is_same_domain(loc, base_url):
                        endpoints.append({
                            "method": "GET",
                            "url": loc,
                            "name": f"GET {urlsplit(loc).path or '/'}"
                        })
                except Exception:
                    continue
    except Exception as e:
        logger.warning("Failed to fetch or parse sitemap at %s: %s", url, e)

    return endpoints


# --- Heuristics & Helper Functions for Crawler & Playwright ---
def is_javascript_heavy(html_content: str) -> bool:
    """Heuristic function to detect if a page is JS-heavy (React, Angular, Vue roots or scripts)."""
    if not html_content:
        return False
    soup = BeautifulSoup(html_content, "html.parser")
    # Heuristic 1: check for React/Vue/Angular root element
    has_spa_root = bool(soup.find(id=lambda v: v in ["root", "app", "__next", "__nuxt"]))
    # Heuristic 2: check for specific script keywords
    has_spa_scripts = False
    scripts = soup.find_all("script")
    for s in scripts:
        src = s.get("src") or ""
        if any(kw in src.lower() for kw in ["react", "vue", "angular", "webpack", "chunk", "bundle"]):
            has_spa_scripts = True
            break
    # Heuristic 3: large number of script tags
    has_many_scripts = len(scripts) >= 4

    return has_spa_root or has_spa_scripts or has_many_scripts


def extract_endpoints_from_html(html_content: str, current_url: str, base_url: str, stats: dict) -> List[Dict[str, Any]]:
    """Extracts hyperlinks, navigation links, forms, and button actions from HTML content."""
    endpoints = []
    try:
        soup = BeautifulSoup(html_content, "html.parser")
    except Exception as e:
        logger.warning("BeautifulSoup failed to parse HTML: %s", e)
        return []

    # 1. Hyperlinks (<a>, <link>, <area>)
    for tag in soup.find_all(["a", "link", "area"]):
        href = tag.get("href")
        if href:
            abs_url = urljoin(current_url, href).split("#")[0]
            if abs_url.lower().startswith(("http://", "https://")):
                if is_same_domain(abs_url, base_url):
                    endpoints.append({
                        "method": "GET",
                        "url": abs_url,
                        "name": f"GET {urlsplit(abs_url).path or '/'}"
                    })
                else:
                    stats["skipped_external_urls"] += 1

    # 2. Forms and buttons/inputs with formactions
    for form in soup.find_all("form"):
        action = form.get("action") or ""
        method = (form.get("method") or "GET").upper()
        abs_url = urljoin(current_url, action).split("#")[0]

        if abs_url.lower().startswith(("http://", "https://")):
            if is_same_domain(abs_url, base_url):
                endpoints.append({
                    "method": method if method in ["GET", "POST", "PUT", "DELETE", "PATCH"] else "GET",
                    "url": abs_url,
                    "name": f"{method} {urlsplit(abs_url).path or '/'}"
                })
            else:
                stats["skipped_external_urls"] += 1

        # Check buttons/inputs with formaction inside forms
        for btn in form.find_all(["button", "input"]):
            formaction = btn.get("formaction")
            if formaction:
                btn_method = (btn.get("formmethod") or method).upper()
                abs_btn_url = urljoin(current_url, formaction).split("#")[0]
                if abs_btn_url.lower().startswith(("http://", "https://")):
                    if is_same_domain(abs_btn_url, base_url):
                        endpoints.append({
                            "method": btn_method if btn_method in ["GET", "POST", "PUT", "DELETE", "PATCH"] else "GET",
                            "url": abs_btn_url,
                            "name": f"{btn_method} {urlsplit(abs_btn_url).path or '/'}"
                        })
                    else:
                        stats["skipped_external_urls"] += 1

    # Check button/input with formaction outside forms
    for btn in soup.find_all(["button", "input"]):
        # skip elements that are children of a form since they were already processed
        if btn.find_parent("form"):
            continue
        formaction = btn.get("formaction")
        if formaction:
            btn_method = (btn.get("formmethod") or "GET").upper()
            abs_btn_url = urljoin(current_url, formaction).split("#")[0]
            if abs_btn_url.lower().startswith(("http://", "https://")):
                if is_same_domain(abs_btn_url, base_url):
                    endpoints.append({
                        "method": btn_method if btn_method in ["GET", "POST", "PUT", "DELETE", "PATCH"] else "GET",
                        "url": abs_btn_url,
                        "name": f"{btn_method} {urlsplit(abs_btn_url).path or '/'}"
                    })
                else:
                    stats["skipped_external_urls"] += 1

    return endpoints


def extract_js_links(html_content: str, current_url: str, base_url: str) -> List[str]:
    """Extracts all same-domain JavaScript script src links from the HTML page."""
    js_urls = []
    try:
        soup = BeautifulSoup(html_content, "html.parser")
    except Exception:
        return []
    
    for script in soup.find_all("script"):
        src = script.get("src")
        if src:
            abs_url = urljoin(current_url, src).split("#")[0]
            try:
                if is_same_domain(abs_url, base_url) and abs_url.lower().startswith(("http://", "https://")):
                    js_urls.append(abs_url)
            except Exception:
                continue
    return js_urls


def fetch_page_content(url: str, session: requests.Session) -> Tuple[Optional[str], int, str]:
    """Helper to GET HTML page content using the connection pool session."""
    try:
        res = session.get(url, timeout=REQUEST_TIMEOUT)
        content_type = res.headers.get("Content-Type", "")
        if res.status_code == 200:
            return res.text, res.status_code, content_type
        return None, res.status_code, content_type
    except Exception as e:
        logger.debug("Error fetching page %s: %s", url, e)
        return None, 0, ""


# --- Strategy 3: HTML Crawler ---
def crawl_website(base_url: str, base_html: Optional[str], stats: dict) -> Tuple[List[dict], int, List[str], int, int]:
    """Concurrently crawls the target website using a BFS strategy, discovering pages and endpoints."""
    discovered = []
    seen_endpoints = set()

    def add_endpoint(method: str, url: str, name: Optional[str] = None):
        norm = normalize_url(url)
        key = (method, norm)
        if key not in seen_endpoints:
            seen_endpoints.add(key)
            discovered.append({
                "method": method,
                "url": url,
                "name": name or f"{method} {urlsplit(url).path or '/'}"
            })

    # Add starting URL
    add_endpoint("GET", base_url)

    visited = set()
    current_level_urls = {base_url}
    
    depth = 0
    pages_crawled = 0
    js_files_found = set()
    max_depth_reached = 0
    skipped_external = 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # Optimize: Parse base_html if already fetched to avoid re-requesting home page
    if base_html:
        visited.add(base_url)
        pages_crawled += 1
        
        extracted = extract_endpoints_from_html(base_html, base_url, base_url, stats)
        for ep in extracted:
            add_endpoint(ep["method"], ep["url"], ep.get("name"))
            if ep["method"] == "GET":
                current_level_urls.add(ep["url"])

        js_links = extract_js_links(base_html, base_url, base_url)
        js_files_found.update(js_links)

        depth = 1
        current_level_urls.discard(base_url)

    while current_level_urls and depth <= MAX_CRAWL_DEPTH and pages_crawled < MAX_PAGES:
        to_fetch = [u for u in current_level_urls if u not in visited]
        if not to_fetch:
            break

        remaining_slots = MAX_PAGES - pages_crawled
        if len(to_fetch) > remaining_slots:
            to_fetch = to_fetch[:remaining_slots]

        next_level_urls = set()
        concurrency = min(len(to_fetch), 10)
        
        max_depth_reached = max(max_depth_reached, depth)

        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            future_to_url = {
                executor.submit(fetch_page_content, url, session): url
                for url in to_fetch
            }

            for future in as_completed(future_to_url):
                url = future_to_url[future]
                visited.add(url)

                try:
                    html_content, status_code, content_type = future.result()
                    if html_content and "text/html" in content_type.lower():
                        pages_crawled += 1
                        extracted = extract_endpoints_from_html(html_content, url, base_url, stats)
                        for ep in extracted:
                            add_endpoint(ep["method"], ep["url"], ep.get("name"))
                            if ep["method"] == "GET":
                                next_level_urls.add(ep["url"])

                        js_links = extract_js_links(html_content, url, base_url)
                        js_files_found.update(js_links)
                except Exception as e:
                    logger.warning("Failed to crawl page %s: %s", url, e)

        current_level_urls = next_level_urls
        depth += 1

    return discovered, pages_crawled, list(js_files_found), max_depth_reached, skipped_external


# --- Strategy 4: JavaScript API Discovery ---
def extract_endpoints_from_js(js_content: str, base_url: str) -> List[Dict[str, Any]]:
    """Uses regex patterns to scan Javascript content for API endpoints."""
    endpoints = []

    def add_ep(method: str, path_or_url: str):
        if not path_or_url or path_or_url.lower().startswith(("javascript:", "tel:", "mailto:", "#")):
            return
        full_url = urljoin(base_url, path_or_url).split("#")[0]
        if full_url.lower().startswith(("http://", "https://")):
            if is_same_domain(full_url, base_url):
                endpoints.append({
                    "method": method.upper(),
                    "url": full_url,
                    "name": f"JS {method.upper()} {urlsplit(full_url).path or '/'}"
                })

    # 1. Axios calls: axios.get('url'), axios.post('url', ...)
    axios_matches = re.finditer(r'axios\.(get|post|put|delete|patch|options|head)\(\s*[\'"`]([^\'"`]+)[\'"`]', js_content, re.IGNORECASE)
    for m in axios_matches:
        method = m.group(1).upper()
        path = m.group(2)
        add_ep(method, path)

    # 2. XHR open: open('GET', 'url') or xhr.open('POST', 'url')
    xhr_matches = re.finditer(r'\.\s*open\(\s*[\'"`](GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)[\'"`]\s*,\s*[\'"`]([^\'"`]+)[\'"`]', js_content, re.IGNORECASE)
    for m in xhr_matches:
        method = m.group(1).upper()
        path = m.group(2)
        add_ep(method, path)

    # 3. Fetch calls: fetch('url') or fetch('url', { method: 'POST' })
    fetch_matches = re.finditer(r'\bfetch\(\s*[\'"`]([^\'"`]+)[\'"`]', js_content)
    for m in fetch_matches:
        path = m.group(1)
        start_idx = m.end()
        
        # Bounded lookahead to current statement/fetch boundary to prevent greediest matching
        end_boundary = js_content.find(";", start_idx)
        if end_boundary == -1:
            end_boundary = start_idx + 150
        else:
            end_boundary = min(end_boundary, start_idx + 150)
        
        next_fetch = js_content.find("fetch", start_idx)
        if next_fetch != -1:
            end_boundary = min(end_boundary, next_fetch)
            
        lookahead = js_content[start_idx:end_boundary]
        method_match = re.search(r'\bmethod\s*:\s*[\'"`](GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)[\'"`]', lookahead, re.IGNORECASE)
        method = method_match.group(1).upper() if method_match else "GET"
        add_ep(method, path)

    # 4. General API strings like '/api/...' or 'https?://...'
    general_matches = re.finditer(r'[\'"`](/api/[^\s\'"`]+|https?://[^\s\'"`]+)[\'"`]', js_content)
    known_paths = {urlsplit(ep["url"]).path for ep in endpoints}
    for m in general_matches:
        path = m.group(1)
        try:
            full_url = urljoin(base_url, path).split("#")[0]
            parsed_path = urlsplit(full_url).path
            if parsed_path not in known_paths:
                add_ep("GET", path)
                known_paths.add(parsed_path)
        except Exception:
            continue

    return endpoints


def parse_js_files(js_urls: List[str], base_url: str) -> Tuple[List[dict], int]:
    """Downloads JS files concurrently and parses them."""
    js_endpoints = []
    js_files_parsed = 0
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    def fetch_and_parse(js_url: str) -> List[dict]:
        try:
            res = session.get(js_url, timeout=REQUEST_TIMEOUT)
            if res.status_code == 200:
                return extract_endpoints_from_js(res.text, base_url)
        except Exception as e:
            logger.debug("Failed to fetch JS file %s: %s", js_url, e)
        return []

    concurrency = min(len(js_urls), 10)
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        future_to_url = {
            executor.submit(fetch_and_parse, url): url
            for url in js_urls
        }
        for future in as_completed(future_to_url):
            js_files_parsed += 1
            try:
                eps = future.result()
                js_endpoints.extend(eps)
            except Exception as e:
                logger.warning("Error processing JS URL: %s", e)

    return js_endpoints, js_files_parsed


# --- Strategy 5: Playwright Network Capture ---
def discover_playwright(base_url: str, stats: dict) -> List[Dict[str, Any]]:
    """Launches headless Playwright Chromium to capture outgoing API requests dynamically."""
    endpoints = []
    seen = set()

    logger.info("Launching Playwright network capture for %s", base_url)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("playwright library not installed. Skipping Playwright strategy.")
        return []

    try:
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch(headless=True)
            except Exception as launch_err:
                logger.warning("Failed to launch Playwright browser: %s. (Did you run 'playwright install'?)", launch_err)
                return []

            context = browser.new_context(user_agent=USER_AGENT)
            page = context.new_page()

            def handle_request(request):
                method = request.method.upper()
                url = request.url.split("#")[0]
                
                stats["playwright_requests_captured"] += 1

                if url.lower().startswith(("http://", "https://")):
                    if is_same_domain(url, base_url) and method in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
                        norm = normalize_url(url)
                        key = (method, norm)
                        if key not in seen:
                            seen.add(key)
                            endpoints.append({
                                "method": method,
                                "url": url,
                                "name": f"Playwright {method} {urlsplit(url).path or '/'}"
                            })

            page.on("request", handle_request)

            try:
                page.goto(base_url, timeout=PLAYWRIGHT_TIMEOUT)
                page.wait_for_load_state("networkidle", timeout=5000)
            except Exception as nav_err:
                logger.warning("Playwright navigation or networkidle timed out/failed: %s", nav_err)

            browser.close()
    except Exception as e:
        logger.warning("Unexpected error in Playwright strategy: %s", e)

    return endpoints


# --- Main Entry Point ---
def discover_endpoints(payload: CreateTestRequest) -> Tuple[List[Dict[str, Any]], str]:
    """Tries five discovery strategies sequentially to automatically extract reachable endpoints."""
    start_time = time.time()
    target_url = str(payload.baseUrl or payload.url)

    stats = {
        "strategy": "none",
        "pages_crawled": 0,
        "endpoints_found": 0,
        "crawler_depth": 0,
        "skipped_external_urls": 0,
        "js_files_parsed": 0,
        "playwright_requests_captured": 0
    }

    # Strategy 1: OpenAPI/Swagger
    try:
        openapi_endpoints = discover_openapi(target_url)
        if openapi_endpoints:
            unique_endpoints = deduplicate_endpoints(openapi_endpoints)
            duration = time.time() - start_time
            logger.info(
                "\nDiscovery Mode: swagger\n\nPages Crawled: 0\n\nEndpoints Found: %d\n\nJS APIs Found: 0\n\nTime Taken: %.1f sec",
                len(unique_endpoints), duration
            )
            return unique_endpoints, "swagger"
    except Exception as e:
        logger.warning("Swagger/OpenAPI strategy failed: %s. Trying next strategy.", e)

    # Strategy 2: Sitemap
    try:
        sitemap_endpoints = discover_sitemap(target_url)
        if sitemap_endpoints:
            unique_endpoints = deduplicate_endpoints(sitemap_endpoints)
            duration = time.time() - start_time
            logger.info(
                "\nDiscovery Mode: sitemap\n\nPages Crawled: 0\n\nEndpoints Found: %d\n\nJS APIs Found: 0\n\nTime Taken: %.1f sec",
                len(unique_endpoints), duration
            )
            return unique_endpoints, "sitemap"
    except Exception as e:
        logger.warning("Sitemap strategy failed: %s. Trying next strategy.", e)

    # Strategy 3, 4, 5: Crawler + JS API Discovery + Playwright Capture
    crawler_endpoints = []
    js_endpoints = []
    playwright_endpoints = []

    js_files_found = set()
    is_js_heavy = False
    base_html = None

    with requests.Session() as session:
        session.headers.update({"User-Agent": USER_AGENT})
        try:
            res = session.get(target_url, timeout=REQUEST_TIMEOUT)
            if res.status_code == 200:
                base_html = res.text
                is_js_heavy = is_javascript_heavy(base_html)
        except Exception as e:
            logger.warning("Failed to fetch base URL %s for crawler setup: %s", target_url, e)

    # Strategy 5: Playwright (if JS-heavy)
    if is_js_heavy:
        try:
            playwright_endpoints = discover_playwright(target_url, stats)
        except Exception as e:
            logger.warning("Playwright strategy failed: %s", e)

    # Strategy 3: HTML Crawler
    try:
        crawled_endpoints, pages_crawled, js_files, max_depth, _ = crawl_website(
            target_url, base_html, stats
        )
        crawler_endpoints.extend(crawled_endpoints)
        stats["pages_crawled"] = pages_crawled
        stats["crawler_depth"] = max_depth
        js_files_found.update(js_files)
    except Exception as e:
        logger.warning("HTML Crawler strategy failed: %s", e)

    # Strategy 4: JS API Discovery
    if js_files_found:
        try:
            parsed_js_endpoints, js_parsed_count = parse_js_files(list(js_files_found), target_url)
            js_endpoints.extend(parsed_js_endpoints)
            stats["js_files_parsed"] = js_parsed_count
        except Exception as e:
            logger.warning("JS API Discovery strategy failed: %s", e)

    # Combine results
    all_endpoints = crawler_endpoints + js_endpoints + playwright_endpoints
    unique_endpoints = deduplicate_endpoints(all_endpoints)

    # Determine mode used
    mode = "playwright" if (is_js_heavy and playwright_endpoints) else "crawler"
    stats["strategy"] = mode
    stats["endpoints_found"] = len(unique_endpoints)
    duration = time.time() - start_time

    # Log metrics according to instructions
    logger.info(
        "\nDiscovery Mode: %s\n\nPages Crawled: %d\n\nEndpoints Found: %d\n\nJS APIs Found: %d\n\nTime Taken: %.1f sec",
        mode, stats["pages_crawled"], len(unique_endpoints), len(js_endpoints), duration
    )
    logger.info(
        "Crawler depth: %d, Skipped external URLs: %d, JS files parsed: %d, Playwright requests captured: %d",
        stats["crawler_depth"], stats["skipped_external_urls"], stats["js_files_parsed"], stats["playwright_requests_captured"]
    )

    # Fallback condition: if no endpoints or we only have the base URL and failed to crawl anything
    is_fallback = False
    if not unique_endpoints:
        is_fallback = True
    elif len(unique_endpoints) == 1:
        single_ep = unique_endpoints[0]
        if single_ep["method"] == "GET" and normalize_url(single_ep["url"]) == normalize_url(target_url) and stats["pages_crawled"] == 0:
            is_fallback = True

    if unique_endpoints and not is_fallback:
        return unique_endpoints, mode

    # Fallback to single GET URL
    logger.warning("No endpoints discovered via any strategy. Falling back to single GET URL.")
    parsed = urlsplit(target_url)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"

    fallback_req = {
        "method": (payload.method or "GET").upper(),
        "url": target_url,
        "headers": payload.headers,
        "body": payload.body,
        "name": f"{(payload.method or 'GET').upper()} {path}"
    }

    duration = time.time() - start_time
    logger.info(
        "\nDiscovery Mode: single\n\nPages Crawled: 0\n\nEndpoints Found: 1\n\nJS APIs Found: 0\n\nTime Taken: %.1f sec",
        duration
    )
    return [fallback_req], "single"
