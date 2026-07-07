from fastapi import FastAPI, UploadFile, File, HTTPException, Form, status
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
import uuid
from jmx_builder import build_jmx
from models import CreateTestRequest, CreateTestResponse
from yaml_builder import build_taurus_yaml
import shutil
from pathlib import Path
import yaml
import subprocess
import hashlib
import json
import jwt
import datetime
import tempfile
from typing import Optional
import psycopg2
from psycopg2 import pool as pg_pool
import os

app = FastAPI()

def load_env_file():
    env_path = Path(".env")
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env_file()

# PostgreSQL Configurations
DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = os.getenv("DB_PORT", "")
DB_NAME = os.getenv("DB_NAME", "")
DB_USER = os.getenv("DB_USER", "")
DB_PASS = os.getenv("DB_PASS", "")

# JWT configurations loaded from environment
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "")

logger = logging.getLogger("perfanalyzer")
logging.basicConfig(level=logging.INFO)
 
# Directory where generated .jmx / .yml files are stored.
TESTS_DIR = Path(__file__).parent / "generated_tests"
TESTS_DIR.mkdir(parents=True, exist_ok=True)
 
 
def _slugify(value: str) -> str:
    safe = "".join(c if c.isalnum() else "_" for c in value.strip().lower())
    while "__" in safe:
        safe = safe.replace("__", "_")
    return safe.strip("_") or "test"

# ── Connection Pool ─────────────────────────────────────────────────────────
# Pre-warmed pool so every request reuses an existing connection instead of
# paying a full TCP + auth handshake on each call.
_db_pool: "pg_pool.ThreadedConnectionPool | None" = None

def _make_dsn(dbname: str = "") -> dict:
    name = dbname if dbname else DB_NAME
    return dict(host=DB_HOST, port=DB_PORT, database=name, user=DB_USER, password=DB_PASS)

def _init_pool():
    """Create the shared connection pool (called once at startup)."""
    global _db_pool
    if _db_pool is None:
        _db_pool = pg_pool.ThreadedConnectionPool(minconn=2, maxconn=10, **_make_dsn())
        logger.info("DB connection pool initialised (min=2, max=10).")

def get_db_connection(dbname: str = ""):
    """Return a pooled connection (or a fresh bootstrap connection if pool isn't ready)."""
    target = dbname if dbname else DB_NAME
    if target != DB_NAME or _db_pool is None:
        return psycopg2.connect(**_make_dsn(target))
    return _db_pool.getconn()

def release_db_connection(conn):
    """Return a connection to the pool (no-op-safe if pool not ready)."""
    if _db_pool is not None:
        try:
            _db_pool.putconn(conn)
            return
        except Exception:
            pass
    try:
        conn.close()
    except Exception:
        pass

def init_db():
    try:
        try:
            conn = get_db_connection(DB_NAME)
        except psycopg2.OperationalError as oe:
            if "does not exist" in str(oe).lower():
                print(f"Database '{DB_NAME}' does not exist. Attempting auto-creation...")
                conn_default = get_db_connection("postgres")
                conn_default.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
                cur_default = conn_default.cursor()
                cur_default.execute(f'CREATE DATABASE "{DB_NAME}";')
                cur_default.close()
                conn_default.close()
                print(f"Database '{DB_NAME}' created successfully.")
                conn = get_db_connection(DB_NAME)
            else:
                raise oe

        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255) DEFAULT '';")

        # Create test_results table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS test_results (
                id SERIAL PRIMARY KEY,
                test_name VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(255) NOT NULL,
                concurrency INTEGER DEFAULT 0,
                ramp_up INTEGER DEFAULT 0,
                duration INTEGER DEFAULT 0,
                throughput DOUBLE PRECISION DEFAULT 0.0,
                avg_rt DOUBLE PRECISION DEFAULT 0.0,
                error_rate DOUBLE PRECISION DEFAULT 0.0,
                status VARCHAR(50) DEFAULT 'running',
                error_message TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        cur.close()
        conn.close()

        # ── Project Workspace tables ──────────────────────────────────────────
        conn2 = psycopg2.connect(**_make_dsn())
        cur2 = conn2.cursor()
        cur2.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT DEFAULT '',
                tags TEXT DEFAULT '',
                owner VARCHAR(255) NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur2.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';")
        cur2.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';")
        cur2.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner VARCHAR(255) DEFAULT '';")
        cur2.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
        cur2.execute("""
            CREATE TABLE IF NOT EXISTS project_files (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                file_type VARCHAR(50) DEFAULT 'other',
                file_size BIGINT DEFAULT 0,
                stored_path TEXT NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn2.commit()
        cur2.close()
        conn2.close()

        conn3 = get_db_connection(DB_NAME)
        ensure_project_files_schema(conn3)
        conn3.close()
        print("PostgreSQL Database initialized successfully.")
    except Exception as e:
        print(f"Warning: PostgreSQL Database initialization failed: {str(e)}")

@app.on_event("startup")
def startup_event():
    init_db()
    try:
        _init_pool()
    except Exception as exc:
        logger.warning(f"Connection pool init failed (falling back to per-request connections): {exc}")

@app.on_event("shutdown")
def shutdown_event():
    global _db_pool
    if _db_pool is not None:
        _db_pool.closeall()
        logger.info("DB connection pool closed.")

# ── Project file storage ─────────────────────────────────────────────────────
PROJECT_FILES_DIR = Path(__file__).parent / "project_files"
PROJECT_FILES_DIR.mkdir(parents=True, exist_ok=True)


def ensure_project_files_schema(conn) -> None:
    """Make project_files compatible with older and newer schema variants."""
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'project_files';
        """)
        existing_columns = {row[0] for row in cur.fetchall()}

        if "stored_path" not in existing_columns:
            cur.execute("ALTER TABLE project_files ADD COLUMN stored_path TEXT DEFAULT '';")
        if "file_path" not in existing_columns:
            cur.execute("ALTER TABLE project_files ADD COLUMN file_path TEXT DEFAULT '';")
        if "file_size" not in existing_columns:
            cur.execute("ALTER TABLE project_files ADD COLUMN file_size BIGINT DEFAULT 0;")
        if "uploaded_at" not in existing_columns:
            cur.execute("ALTER TABLE project_files ADD COLUMN uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
        if "file_type" not in existing_columns:
            cur.execute("ALTER TABLE project_files ADD COLUMN file_type VARCHAR(50) DEFAULT 'other';")
        else:
            cur.execute("ALTER TABLE project_files ALTER COLUMN file_type SET DEFAULT 'other';")

        if "file_path" in existing_columns or "file_path" in {row[0] for row in cur.fetchall()}:
            cur.execute("ALTER TABLE project_files ALTER COLUMN file_path DROP NOT NULL;")
        if "stored_path" in existing_columns or "stored_path" in {row[0] for row in cur.fetchall()}:
            cur.execute("ALTER TABLE project_files ALTER COLUMN stored_path DROP NOT NULL;")

        cur.execute("""
            UPDATE project_files
            SET stored_path = COALESCE(NULLIF(stored_path, ''), file_path)
            WHERE (stored_path IS NULL OR stored_path = '')
              AND file_path IS NOT NULL AND file_path != '';
        """)
        conn.commit()
        cur.close()
    except Exception as exc:
        conn.rollback()
        logger.warning(f"Project files schema migration skipped: {exc}")


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def validate_gmail(email: str):
    email_str = email.strip().lower()
    if not email_str.endswith("@gmail.com") or len(email_str) <= 10:
        raise HTTPException(
            status_code=400,
            detail="Only valid Gmail addresses (@gmail.com) are allowed."
        )

@app.post("/register")
def register(username: str = Form(...), password: str = Form(...), full_name: str = Form("")):
    validate_gmail(username)
    username = username.strip().lower()
    full_name = full_name.strip()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if username exists
        cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
        user = cur.fetchone()
        if user:
            cur.close()
            release_db_connection(conn)
            raise HTTPException(status_code=400, detail="Gmail address already registered.")
        
        # Insert user
        pwd_hash = hash_password(password)
        cur.execute(
            "INSERT INTO users (username, password_hash, full_name) VALUES (%s, %s, %s);",
            (username, pwd_hash, full_name)
        )
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return JSONResponse({"message": "User registered successfully."})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error during registration: {str(e)}")

@app.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    validate_gmail(username)
    username = username.strip().lower()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Retrieve user hash and full name
        cur.execute("SELECT password_hash, full_name FROM users WHERE username = %s;", (username,))
        row = cur.fetchone()
        
        if not row or row[0] != hash_password(password):
            cur.close()
            release_db_connection(conn)
            raise HTTPException(status_code=401, detail="Invalid Gmail address or password.")
            
        pwd_hash, full_name = row
        cur.close()
        release_db_connection(conn)
        
        payload = {
            "username": username,
            "full_name": full_name,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        return JSONResponse({
            "message": "Login successful.",
            "token": token,
            "username": username,
            "full_name": full_name
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error during login: {str(e)}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/reports", StaticFiles(directory="../Test Result"), name="reports")

JMETER_CMD = shutil.which("jmeter") or shutil.which("jmeter.bat")
BZT_CMD = shutil.which("bzt")

TEST_RESULT_DIR = Path("../Test Result")
TEST_RESULT_DIR.mkdir(parents=True, exist_ok=True)

# No legacy Uploads folders needed. Files upload directly into the target Test Result subfolder.

TEMPLATE_YAML = Path("template.yml")
GENERATED_YAML = Path("generated.yml")

# Sequential filename resolution is deprecated in favor of dynamic timestamped directories.

# Upload JMX File
@app.post("/upload/jmx")
async def upload_jmx(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".jmx"):
        raise HTTPException(
            status_code=400,
            detail="Only JMX files are allowed."
        )

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    stem_name = Path(file.filename).stem
    test_name = f"{stem_name}_{timestamp}"
    
    test_folder = TEST_RESULT_DIR / test_name
    test_folder.mkdir(parents=True, exist_ok=True)
    target_jmx_path = test_folder / f"{test_name}.jmx"

    with open(target_jmx_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return JSONResponse({
        "message": "JMX uploaded successfully.",
        "filename": f"{test_name}.jmx",
        "path": str(target_jmx_path)
    })

# Upload CSV/JTL File
@app.post("/upload/csv")
async def upload_csv(file: UploadFile = File(...)):
    allowed = (".csv", ".jtl")
    if not file.filename.lower().endswith(allowed):
        raise HTTPException(
            status_code=400,
            detail="Only CSV or JTL files are allowed."
        )

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    stem_name = Path(file.filename).stem
    test_name = f"{stem_name}_{timestamp}"
    ext = Path(file.filename).suffix

    temp_file_fd, temp_file_path_str = tempfile.mkstemp(suffix=ext)
    temp_file_path = Path(temp_file_path_str)
    
    try:
        with os.fdopen(temp_file_fd, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        try:
            validate_jmeter_results(temp_file_path)
        except ValueError as ve:
            raise HTTPException(
                status_code=400,
                detail=str(ve)
            )
        
        test_folder = TEST_RESULT_DIR / test_name
        test_folder.mkdir(parents=True, exist_ok=True)
        target_csv_path = test_folder / f"{test_name}{ext}"
        shutil.copy(temp_file_path, target_csv_path)
    finally:
        if temp_file_path.exists():
            temp_file_path.unlink()

    return JSONResponse({
        "message": "CSV/JTL file uploaded successfully.",
        "filename": f"{test_name}{ext}",
        "path": str(target_csv_path)
    })

def parse_test_metrics(test_name: str) -> dict:
    throughput = 0.0
    avg_rt = 0.0
    error_rate = 0.0
    active_users = 0

    target_csv_path = TEST_RESULT_DIR / test_name / "kpi.jtl"
    if not target_csv_path.exists():
        fallback_csv = TEST_RESULT_DIR / test_name / f"{test_name}.csv"
        if fallback_csv.exists():
            target_csv_path = fallback_csv
        else:
            fallback_jtl = TEST_RESULT_DIR / test_name / f"{test_name}.jtl"
            if fallback_jtl.exists():
                target_csv_path = fallback_jtl

    if target_csv_path.exists():
        try:
            with open(target_csv_path, "r", encoding="utf-8", errors="ignore") as f:
                header_line = f.readline()
                if header_line:
                    header = header_line.strip().split(',')
                    delim = ','
                    if len(header) <= 1:
                        header = header_line.strip().split('\t')
                        delim = '\t'

                    try:
                        ts_idx = header.index("timeStamp")
                        el_idx = header.index("elapsed")
                        succ_idx = header.index("success")
                        threads_idx = header.index("allThreads")
                    except ValueError:
                        ts_idx, el_idx, succ_idx, threads_idx = 0, 1, 7, 9

                    min_ts = None
                    max_ts_end = None
                    total_elapsed = 0
                    failures = 0
                    total_reqs = 0
                    last_threads = 0
                    max_idx = max(ts_idx, el_idx, succ_idx, threads_idx)

                    for line in f:
                        parts = line.strip().split(delim)
                        if len(parts) > max_idx:
                            try:
                                ts = int(parts[ts_idx])
                                el = int(parts[el_idx])
                                succ = parts[succ_idx].strip().lower()
                                threads = int(parts[threads_idx])

                                total_reqs += 1
                                total_elapsed += el
                                last_threads = threads
                                if succ in ("false", "0"):
                                    failures += 1

                                if min_ts is None or ts < min_ts:
                                    min_ts = ts
                                end_ts = ts + el
                                if max_ts_end is None or end_ts > max_ts_end:
                                    max_ts_end = end_ts
                            except:
                                pass

                    if total_reqs > 0 and min_ts is not None and max_ts_end is not None:
                        duration_ms = max_ts_end - min_ts
                        duration_sec = duration_ms / 1000.0

                        if duration_sec > 0:
                            throughput = total_reqs / duration_sec
                        else:
                            throughput = float(total_reqs)

                        avg_rt = total_elapsed / total_reqs
                        error_rate = (failures / total_reqs) * 100.0
                        active_users = last_threads
        except Exception as e:
            print("Error parsing JTL metrics in helper:", e)

    return {
        "throughput": round(throughput, 2),
        "avg_rt": round(avg_rt, 0),
        "error_rate": round(error_rate, 2),
        "active_users": active_users
    }

def update_db_test_result(test_name: str, status: str, error_message: str = ""):
    metrics = parse_test_metrics(test_name)
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE test_results
            SET status = %s,
                throughput = %s,
                avg_rt = %s,
                error_rate = %s,
                error_message = %s
            WHERE test_name = %s;
        """, (status, metrics["throughput"], metrics["avg_rt"], metrics["error_rate"], error_message, test_name))
        conn.commit()
        cur.close()
        release_db_connection(conn)
    except Exception as e:
        print(f"Warning: Failed to update test result in database: {str(e)}")

import threading

test_status_db = {}  # Global dict to store test execution status

def validate_jmeter_results(file_path: Path):
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            first_line = f.readline().strip()
            
        delim = ',' if ',' in first_line else '\t'
        columns = [col.strip().lower() for col in first_line.split(delim)]
        
        required_cols = {"timestamp", "elapsed", "success"}
        if not required_cols.issubset(set(columns)):
            parts = first_line.split(delim)
            if len(parts) >= 8 and parts[0].isdigit() and parts[1].isdigit() and parts[7].lower() in ('true', 'false', '0', '1'):
                return True
            
            raise ValueError(
                "Invalid JMeter results format. Header must contain 'timeStamp', 'elapsed', and 'success' columns."
            )
        return True
    except Exception as e:
        raise ValueError(f"JMeter JTL/CSV format verification failed: {str(e)}")

def run_taurus_in_background(test_name: str, cmd: list):
    try:
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        if process.returncode != 0:
            test_status_db[test_name] = {"status": "error", "error": process.stderr}
            update_db_test_result(test_name, "error", process.stderr)
            return
        
        # Automated HTML report generation inside consolidated directory
        test_folder = TEST_RESULT_DIR / test_name
        kpi_path = test_folder / "kpi.jtl"
        html_report_folder = test_folder / "HTML_Report"
        
        if kpi_path.exists():
            if html_report_folder.exists():
                shutil.rmtree(html_report_folder)
            html_report_folder.mkdir(parents=True, exist_ok=True)
            
            jmeter_process = subprocess.run([
                JMETER_CMD,
                "-g",
                str(kpi_path),
                "-o",
                str(html_report_folder)
            ], capture_output=True, text=True)
            
            if jmeter_process.returncode != 0:
                err_msg = f"Taurus completed successfully, but JMeter report generation failed: {jmeter_process.stderr}"
                test_status_db[test_name] = {
                    "status": "error",
                    "error": err_msg
                }
                update_db_test_result(test_name, "error", err_msg)
                return
            
            try:
                generate_custom_html_report(test_name)
            except Exception as report_err:
                print("Error generating custom HTML report:", report_err)
                
        test_status_db[test_name] = {"status": "success", "error": ""}
        update_db_test_result(test_name, "success")
    except Exception as e:
        test_status_db[test_name] = {"status": "error", "error": str(e)}
        update_db_test_result(test_name, "error", str(e))

@app.post("/run-test")
def run_test(
    jmx_filename: str = Form(...),
    threads: int = Form(...),
    ramp_up: int = Form(...),
    duration: int = Form(...),
    username: str = Form("Guest"),
    project_id: Optional[int] = Form(None),
    project_file_id: Optional[int] = Form(None),
):
    try:
        # If a workspace file is specified, copy it to the execution folder
        if project_id is not None and project_file_id is not None:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "SELECT stored_path, filename FROM project_files WHERE id = %s AND project_id = %s;",
                (project_file_id, project_id)
            )
            row = cur.fetchone()
            cur.close()
            release_db_connection(conn)
            if not row:
                raise HTTPException(status_code=404, detail="Workspace file not found.")
            stored_path, filename = row
            test_name = Path(filename).stem
            test_folder = TEST_RESULT_DIR / test_name
            test_folder.mkdir(parents=True, exist_ok=True)
            shutil.copy2(stored_path, test_folder / filename)
            jmx_filename = filename

        # Check if user uploaded a CSV/JTL directly instead of JMX
        if jmx_filename.endswith(".csv") or jmx_filename.endswith(".jtl"):
            test_name = Path(jmx_filename).stem
            test_folder = TEST_RESULT_DIR / test_name
            target_csv_path = test_folder / jmx_filename

            if not target_csv_path.exists():
                raise HTTPException(
                    status_code=404,
                    detail="Uploaded CSV/JTL results file not found in execution directory."
                )

            html_report_folder = test_folder / "HTML_Report"
            html_report_folder.mkdir(parents=True, exist_ok=True)
            
            # Insert into database
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO test_results (test_name, username, concurrency, ramp_up, duration, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (test_name) DO UPDATE 
                    SET status = 'running', created_at = CURRENT_TIMESTAMP;
                """, (test_name, username, 0, 0, 0, 'running'))
                conn.commit()
                cur.close()
                release_db_connection(conn)
            except Exception as e:
                print(f"Warning: Failed to insert test execution to database: {str(e)}")
            
            test_status_db[test_name] = {"status": "running", "error": "", "type": "csv_report"}
            
            def run_jmeter_report_only():
                try:
                    process = subprocess.run([
                        JMETER_CMD,
                        "-g",
                        str(target_csv_path),
                        "-o",
                        str(html_report_folder)
                    ], capture_output=True, text=True)
                    
                    if process.returncode != 0:
                        test_status_db[test_name] = {"status": "error", "error": process.stderr, "type": "csv_report"}
                        update_db_test_result(test_name, "error", process.stderr)
                    else:
                        try:
                            generate_custom_html_report(test_name)
                        except Exception as report_err:
                            print("Error generating custom HTML report:", report_err)
                        test_status_db[test_name] = {"status": "success", "error": "", "type": "csv_report"}
                        update_db_test_result(test_name, "success")
                except Exception as e:
                    test_status_db[test_name] = {"status": "error", "error": str(e), "type": "csv_report"}
                    update_db_test_result(test_name, "error", str(e))
            
            thread = threading.Thread(target=run_jmeter_report_only)
            thread.start()
            
            return JSONResponse({
                "message": "Report generation started in the background.",
                "test_name": test_name
            })

        # Standard JMX execution
        test_name = Path(jmx_filename).stem
        test_folder = TEST_RESULT_DIR / test_name
        target_jmx_path = test_folder / jmx_filename

        if not target_jmx_path.exists():
            raise HTTPException(
                status_code=404,
                detail="Uploaded JMX script file not found in execution directory."
            )

        # Read template YAML
        with open(TEMPLATE_YAML, "r") as file:
            config = yaml.safe_load(file)

        # Update execution configuration
        execution = config["execution"][0]
        execution["concurrency"] = threads
        execution["ramp-up"] = f"{ramp_up}s"
        execution["hold-for"] = f"{duration}s"

        # Update script path pointing to copied file and output dir pointing to Test Result subfolder
        config["scenarios"]["demo"]["script"] = str(target_jmx_path)
        config["settings"]["artifacts-dir"] = str(test_folder)

        # Save generated YAML
        with open(GENERATED_YAML, "w") as file:
            yaml.dump(config, file, sort_keys=False)

        # Insert into database
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO test_results (test_name, username, concurrency, ramp_up, duration, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (test_name) DO UPDATE 
                SET status = 'running', concurrency = %s, ramp_up = %s, duration = %s, created_at = CURRENT_TIMESTAMP;
            """, (test_name, username, threads, ramp_up, duration, 'running', threads, ramp_up, duration))
            conn.commit()
            cur.close()
            release_db_connection(conn)
        except Exception as e:
            print(f"Warning: Failed to insert test execution to database: {str(e)}")

        # Start thread
        test_status_db[test_name] = {"status": "running", "error": ""}
        
        thread = threading.Thread(
            target=run_taurus_in_background,
            args=(test_name, [BZT_CMD, str(GENERATED_YAML)])
        )
        thread.start()

        return JSONResponse({
            "message": "Test started successfully in the background.",
            "test_name": test_name
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@app.get("/test-status/{test_name}")
def get_test_status(test_name: str):
    status_info = test_status_db.get(test_name, {"status": "idle", "error": ""})

    jmeter_content = ""
    bzt_content = ""

    # Check if this is a CSV report conversion run
    if status_info.get("type") == "csv_report":
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S,%f")[:-3]
        lines = [
            f"{now_str} INFO o.a.j.g.ReportGenerator: Starting JMeter report generation from CSV dataset: {test_name}.csv",
            f"{now_str} INFO o.a.j.g.ReportGenerator: Reading CSV sample records..."
        ]
        if status_info["status"] == "running":
            lines.append(f"{now_str} INFO o.a.j.g.ReportGenerator: Aggregating statistics & drawing dashboard files...")
        elif status_info["status"] == "success":
            lines.append(f"{now_str} INFO o.a.j.g.ReportGenerator: Report compilation finished successfully!")
            lines.append(f"{now_str} INFO o.a.j.g.ReportGenerator: HTML dashboard is ready inside HTML_Report/")
        elif status_info["status"] == "error":
            lines.append(f"{now_str} ERROR o.a.j.g.ReportGenerator: Failed compiling report! Details: {status_info.get('error', 'Unknown error')}")
        jmeter_content = "\n".join(lines)
    else:
        test_folder = TEST_RESULT_DIR / test_name
        jmeter_log_path = test_folder / "jmeter.log"
        bzt_log_path = test_folder / "bzt.log"

        # Fallback to backend root jmeter.log if it hasn't copied to artifacts yet
        if not jmeter_log_path.exists() and Path("jmeter.log").exists():
            jmeter_log_path = Path("jmeter.log")

        if jmeter_log_path.exists():
            try:
                with open(jmeter_log_path, "r", encoding="utf-8", errors="ignore") as f:
                    jmeter_content = f.read()
            except:
                pass

        if bzt_log_path.exists():
            try:
                with open(bzt_log_path, "r", encoding="utf-8", errors="ignore") as f:
                    bzt_content = f.read()
            except:
                pass

    # Parse kpi.jtl or fallback CSV for exact throughput, response times, error rates and thread counts
    throughput = 0.0
    windowed_rps = 0.0
    avg_rt = 0.0
    error_rate = 0.0
    active_users = 0

    # Look inside unified Test Result folder
    target_csv_path = TEST_RESULT_DIR / test_name / "kpi.jtl"
    if not target_csv_path.exists():
        fallback_csv = TEST_RESULT_DIR / test_name / f"{test_name}.csv"
        if fallback_csv.exists():
            target_csv_path = fallback_csv
        else:
            fallback_jtl = TEST_RESULT_DIR / test_name / f"{test_name}.jtl"
            if fallback_jtl.exists():
                target_csv_path = fallback_jtl

    if target_csv_path.exists():
        try:
            with open(target_csv_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            if len(lines) > 1:
                header = lines[0].strip().split(',')
                delim = ','
                if len(header) <= 1:
                    header = lines[0].strip().split('\t')
                    delim = '\t'

                try:
                    ts_idx = header.index("timeStamp")
                    el_idx = header.index("elapsed")
                    succ_idx = header.index("success")
                    threads_idx = header.index("allThreads")
                except ValueError:
                    ts_idx, el_idx, succ_idx, threads_idx = 0, 1, 7, 9

                timestamps = []
                elapseds = []
                failures = 0
                threads_list = []

                for line in lines[1:]:
                    parts = line.strip().split(delim)
                    if len(parts) > max(ts_idx, el_idx, succ_idx, threads_idx):
                        try:
                            ts = int(parts[ts_idx])
                            el = int(parts[el_idx])
                            succ = parts[succ_idx].strip().lower()
                            threads = int(parts[threads_idx])

                            timestamps.append(ts)
                            elapseds.append(el)
                            threads_list.append(threads)
                            if succ in ("false", "0"):
                                failures += 1
                        except:
                            pass

                if timestamps:
                    min_ts = min(timestamps)
                    # JMeter Transactions/s formula:
                    # duration = (last_request_start + last_elapsed) - first_request_start
                    # This matches what the HTML report shows in the Statistics table.
                    paired = list(zip(timestamps, elapseds))
                    last_ts, last_el = max(paired, key=lambda x: x[0] + x[1])
                    duration_ms = (last_ts + last_el) - min_ts
                    duration_sec = duration_ms / 1000.0

                    total_reqs = len(timestamps)
                    if duration_sec > 0:
                        throughput = total_reqs / duration_sec
                    else:
                        throughput = float(total_reqs)

                    if total_reqs > 0:
                        avg_rt = sum(elapseds) / total_reqs
                        error_rate = (failures / total_reqs) * 100.0
                        active_users = threads_list[-1] if threads_list else 0
                        
                        # Windowed RPS (last 5 seconds)
                        now_ts = max(timestamps)
                        recent_reqs = [ts for ts in timestamps if ts > (now_ts - 5000)]
                        windowed_rps = len(recent_reqs) / 5.0

        except Exception as e:
            print("Error parsing JTL metrics:", e)

    return JSONResponse({
        "status": status_info["status"],
        "error": status_info["error"],
        "jmeter_log": jmeter_content,
        "bzt_log": bzt_content,
        "throughput": round(throughput, 2),
        "windowed_rps": round(windowed_rps, 2),
        "avg_rt": round(avg_rt, 0),
        "error_rate": round(error_rate, 2),
        "active_users": active_users
    })

@app.get("/download-results/{test_name}")
def download_results(test_name: str):
    html_report_folder = TEST_RESULT_DIR / test_name / "HTML_Report"
    if not html_report_folder.exists():
        raise HTTPException(
            status_code=404,
            detail="HTML report dashboard not found for this test run."
        )
    
    # Create temporary zip archive of the HTML_Report subfolder
    temp_dir = Path(tempfile.gettempdir())
    zip_base_path = temp_dir / f"{test_name}_report"
    
    try:
        archive_path = shutil.make_archive(
            str(zip_base_path),
            'zip',
            root_dir=str(html_report_folder)
        )
        return FileResponse(
            archive_path,
            media_type="application/zip",
            filename=f"{test_name}_report.zip"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create download package: {str(e)}"
        )
    
def extract_balanced_json(text: str, start_pos: int):
    brace_count = 0
    in_string = False
    escape = False
    json_chars = []
    
    for i in range(start_pos, len(text)):
        char = text[i]
        
        if escape:
            json_chars.append(char)
            escape = False
            continue
            
        if char == '\\':
            json_chars.append(char)
            escape = True
            continue
            
        if char == '"':
            in_string = not in_string
            
        if not in_string:
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                
        json_chars.append(char)
        
        if brace_count == 0:
            return "".join(json_chars), i
            
    return None, -1

def generate_custom_html_report(test_name: str):
    html_report_folder = TEST_RESULT_DIR / test_name / "HTML_Report"
    stats_path = html_report_folder / "statistics.json"
    js_path = html_report_folder / "content" / "js" / "dashboard.js"
    output_path = html_report_folder / "index.html"
    
    if not html_report_folder.exists():
        return
        
    stats_data = {}
    if stats_path.exists():
        try:
            with open(stats_path, "r", encoding="utf-8") as f:
                stats_data = json.load(f)
        except Exception as e:
            print("Error loading statistics.json:", e)
            
    errors_data = []
    if js_path.exists():
        try:
            with open(js_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Find the errorsTable definition
            start_idx = content.find('createTable($("#errorsTable"),')
            if start_idx != -1:
                json_start = content.find('{', start_idx)
                if json_start != -1:
                    json_str, _ = extract_balanced_json(content, json_start)
                    if json_str:
                        parsed = json.loads(json_str)
                        errors_data = parsed.get("items", [])
        except Exception as e:
            print("Error parsing dashboard.js errors table:", e)

    # Format KPIs
    total_stats = stats_data.get("Total", {})
    total_samples = total_stats.get("sampleCount", 0)
    total_error_pct = total_stats.get("errorPct", 0.0)
    mean_rt = total_stats.get("meanResTime", 0.0)
    throughput = total_stats.get("throughput", 0.0)
    
    # Format Statistics rows
    statistics_rows = []
    # Sort keys: Total goes at the bottom
    sorted_keys = sorted(stats_data.keys(), key=lambda x: x == 'Total')
    for name in sorted_keys:
        data = stats_data[name]
        is_total = name == 'Total'
        row_class = 'class="total-row"' if is_total else ''
        
        statistics_rows.append(f"""
        <tr {row_class}>
            <td class="font-semibold text-primary">{name}</td>
            <td class="text-end">{data.get("sampleCount", 0):,}</td>
            <td class="text-end {'text-danger font-semibold' if data.get("errorCount", 0) > 0 else ''}">{data.get("errorCount", 0):,}</td>
            <td class="text-end {'text-danger font-semibold' if data.get("errorPct", 0.0) > 0 else ''}">{data.get("errorPct", 0.0):.2f}%</td>
            <td class="text-end font-semibold">{round(data.get("meanResTime", 0.0)):,}</td>
            <td class="text-end text-muted">{round(data.get("minResTime", 0.0)):,}</td>
            <td class="text-end text-muted">{round(data.get("maxResTime", 0.0)):,}</td>
            <td class="text-end">{round(data.get("medianResTime", 0.0)):,}</td>
            <td class="text-end">{round(data.get("pct1ResTime", 0.0)):,}</td>
            <td class="text-end">{round(data.get("pct2ResTime", 0.0)):,}</td>
            <td class="text-end">{round(data.get("pct3ResTime", 0.0)):,}</td>
            <td class="text-end font-bold" style="color: var(--color-blue);">{data.get("throughput", 0.0):.2f} RPS</td>
            <td class="text-end">{data.get("receivedKBytesPerSec", 0.0):.2f}</td>
            <td class="text-end">{data.get("sentKBytesPerSec", 0.0):.2f}</td>
        </tr>
        """)

    # Format Errors rows
    if not errors_data:
        errors_html = """
        <div class="success-illustration">
            <i class="bi bi-shield-check"></i>
            <div class="success-title">Zero Errors Encountered</div>
            <div class="success-desc">All requests in this performance test run completed successfully without failures.</div>
        </div>
        """
    else:
        error_rows = []
        for item in errors_data:
            data_list = item.get("data", ["Unknown", 0, 0.0, 0.0])
            err_msg = data_list[0] if len(data_list) > 0 else "Unknown"
            err_count = data_list[1] if len(data_list) > 1 else 0
            pct_in_errors = data_list[2] if len(data_list) > 2 else 0.0
            pct_in_all = data_list[3] if len(data_list) > 3 else 0.0
            
            error_rows.append(f"""
            <tr>
                <td class="text-danger font-semibold error-message">{err_msg}</td>
                <td class="text-end font-bold">{err_count:,}</td>
                <td class="text-end">{pct_in_errors:.2f}%</td>
                <td class="text-end">{pct_in_all:.2f}%</td>
            </tr>
            """)
            
        errors_html = f"""
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Type / Message of Error</th>
                        <th class="text-end">Number of Errors</th>
                        <th class="text-end">% in Errors</th>
                        <th class="text-end">% in All Samples</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join(error_rows)}
                </tbody>
            </table>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Analyzer - Report: {test_name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        :root {{
            --bg-primary: #f8fafc;
            --bg-secondary: #ffffff;
            --text-primary: #0f172a;
            --text-secondary: #475569;
            --text-muted: #94a3b8;
            --border-color: #e2e8f0;
            --color-blue: #2563eb;
            --color-blue-soft: rgba(37, 99, 235, 0.08);
            --color-green: #10b981;
            --color-green-soft: rgba(16, 185, 129, 0.08);
            --color-red: #ef4444;
            --color-red-soft: rgba(239, 68, 68, 0.08);
            --color-info: #06b6d4;
            --color-info-soft: rgba(6, 182, 212, 0.08);
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            padding: 2.5rem 1.5rem;
            line-height: 1.5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        .header {{
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
        }}
        .header h1 {{
            font-size: 1.75rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 0.25rem;
        }}
        .header p {{
            font-size: 0.875rem;
            color: var(--text-secondary);
        }}
        .test-name-badge {{
            font-weight: 600;
            color: #1e293b;
            background: #f1f5f9;
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
        }}
        .kpi-row {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }}
        .kpi-card {{
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: var(--shadow-sm);
            display: flex;
            align-items: center;
            gap: 1rem;
            transition: var(--transition);
        }}
        .kpi-card:hover {{
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
        }}
        .kpi-icon {{
            width: 48px;
            height: 48px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
        }}
        .kpi-icon.blue {{ background: var(--color-blue-soft); color: var(--color-blue); }}
        .kpi-icon.red {{ background: var(--color-red-soft); color: var(--color-red); }}
        .kpi-icon.green {{ background: var(--color-green-soft); color: var(--color-green); }}
        .kpi-icon.info {{ background: var(--color-info-soft); color: var(--color-info); }}
        .kpi-label {{
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.25rem;
        }}
        .kpi-value {{
            font-size: 1.5rem;
            font-weight: 700;
            color: #0f172a;
        }}
        .panel {{
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: var(--shadow-sm);
            margin-bottom: 2rem;
        }}
        .panel-title {{
            font-size: 1.125rem;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 1.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }}
        .table-responsive {{
            width: 100%;
            overflow-x: auto;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            text-align: left;
        }}
        th {{
            background: #f8fafc;
            color: var(--text-secondary);
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.75rem;
            letter-spacing: 0.05em;
            padding: 12px 16px;
            border-bottom: 2px solid var(--border-color);
        }}
        td {{
            padding: 14px 16px;
            border-bottom: 1px solid var(--border-color);
            color: var(--text-secondary);
            vertical-align: middle;
        }}
        tr:hover td {{
            background-color: #f8fafc;
        }}
        .text-end {{ text-align: right; }}
        .text-danger {{ color: var(--color-red); }}
        .font-semibold {{ font-weight: 600; }}
        .font-bold {{ font-weight: 700; }}
        .total-row td {{
            background: #f8fafc;
            font-weight: 700;
            color: var(--text-primary);
            border-top: 2px solid var(--border-color);
            border-bottom: 2px solid var(--border-color);
        }}
        .total-row:hover td {{
            background: #f1f5f9;
        }}
        .error-message {{
            font-family: Consolas, Monaco, monospace;
            font-size: 0.8rem;
            word-break: break-all;
            white-space: pre-wrap;
        }}
        .success-illustration {{
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            text-align: center;
        }}
        .success-illustration i {{
            font-size: 3.5rem;
            color: var(--color-green);
            margin-bottom: 1rem;
            animation: shield-pulse 2s infinite ease-in-out;
        }}
        @keyframes shield-pulse {{
            0% {{ transform: scale(1); filter: drop-shadow(0 0 0 rgba(16, 185, 129, 0)); }}
            50% {{ transform: scale(1.05); filter: drop-shadow(0 4px 12px rgba(16, 185, 129, 0.25)); }}
            100% {{ transform: scale(1); filter: drop-shadow(0 0 0 rgba(16, 185, 129, 0)); }}
        }}
        .success-title {{
            font-size: 1.125rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 0.25rem;
        }}
        .success-desc {{
            font-size: 0.875rem;
            color: var(--text-secondary);
            max-width: 320px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>Performance Report</h1>
            <p>Detailed execution metrics for: <span class="test-name-badge">{test_name}</span></p>
        </div>

        <!-- KPI Summary Cards -->
        <div class="kpi-row">
            <!-- Total Samples -->
            <div class="kpi-card">
                <div class="kpi-icon blue">
                    <i class="bi bi-bar-chart-fill"></i>
                </div>
                <div>
                    <div class="kpi-label">Total Samples</div>
                    <div class="kpi-value">{total_samples:,}</div>
                </div>
            </div>
            <!-- Error Rate -->
            <div class="kpi-card">
                <div class="kpi-icon red">
                    <i class="bi bi-exclamation-circle-fill"></i>
                </div>
                <div>
                    <div class="kpi-label">Error Rate</div>
                    <div class="kpi-value" style="color: {'var(--color-red)' if total_error_pct > 0 else 'inherit'}">{total_error_pct:.2f}%</div>
                </div>
            </div>
            <!-- Avg Response Time -->
            <div class="kpi-card">
                <div class="kpi-icon green">
                    <i class="bi bi-clock-fill"></i>
                </div>
                <div>
                    <div class="kpi-label">Avg Response Time</div>
                    <div class="kpi-value">{round(mean_rt):,} ms</div>
                </div>
            </div>
            <!-- Throughput -->
            <div class="kpi-card">
                <div class="kpi-icon info">
                    <i class="bi bi-speedometer2"></i>
                </div>
                <div>
                    <div class="kpi-label">Throughput</div>
                    <div class="kpi-value">{throughput:.2f} RPS</div>
                </div>
            </div>
        </div>

        <!-- Request Statistics Panel -->
        <div class="panel">
            <div class="panel-title">
                <i class="bi bi-table" style="color: var(--color-blue);"></i> Request Statistics
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Transaction / Label</th>
                            <th class="text-end">Samples</th>
                            <th class="text-end">FAIL</th>
                            <th class="text-end">Error %</th>
                            <th class="text-end">Avg (ms)</th>
                            <th class="text-end">Min (ms)</th>
                            <th class="text-end">Max (ms)</th>
                            <th class="text-end">Median (ms)</th>
                            <th class="text-end">90% (ms)</th>
                            <th class="text-end">95% (ms)</th>
                            <th class="text-end">99% (ms)</th>
                            <th class="text-end">Throughput</th>
                            <th class="text-end">Received (KB/s)</th>
                            <th class="text-end">Sent (KB/s)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {"".join(statistics_rows)}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Errors Summary Panel -->
        <div class="panel">
            <div class="panel-title">
                <i class="bi bi-exclamation-triangle" style="color: var(--color-red);"></i> Errors Summary
            </div>
            {errors_html}
        </div>
    </div>
</body>
</html>
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)

@app.post("/create-test")
def create_test(payload: CreateTestRequest) -> JSONResponse:
    try:
        test_id = uuid.uuid4().hex[:8]
        base_name = f"{_slugify(payload.testName)}_{test_id}"
        jmx_filename = f"{base_name}.jmx"
        yaml_filename = f"{base_name}.yml"
 
        jmx_path = TESTS_DIR / jmx_filename
        yaml_path = TESTS_DIR / yaml_filename
 
        # --- Generate JMX ---
        jmx_content = build_jmx(payload)
        jmx_path.write_text(jmx_content, encoding="utf-8")
 
        # --- Generate Taurus YAML (references the JMX by filename) ---
        yaml_content = build_taurus_yaml(payload, jmx_filename)
        yaml_path.write_text(yaml_content, encoding="utf-8")
 
        logger.info("Generated test artifacts: %s, %s", jmx_filename, yaml_filename)
 
        response = CreateTestResponse(
            success=True,
            message="Test created successfully.",
            testId=test_id,
            testName=payload.testName,
            jmxFile=jmx_filename,
            yamlFile=yaml_filename,
            directory=str(TESTS_DIR.resolve()),
        )
        return JSONResponse(status_code=status.HTTP_201_CREATED, content=response.model_dump())
 
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to create test")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate test artifacts: {exc}",
        ) from exc
    
def sync_filesystem_reports_to_db(requesting_user: str = "Guest"):
    if not TEST_RESULT_DIR.exists():
        return
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get all existing test names in the DB to avoid duplicates
        cur.execute("SELECT test_name FROM test_results;")
        db_test_names = {row[0] for row in cur.fetchall()}
        
        for item in TEST_RESULT_DIR.iterdir():
            if item.is_dir():
                test_name = item.name
                if test_name not in db_test_names:
                    try:
                        # Parse metrics from files
                        metrics = parse_test_metrics(test_name)
                        
                        html_report_path = item / "HTML_Report" / "index.html"
                        status = "success" if html_report_path.exists() else "failed"
                        
                        # Parse timestamp from name
                        created_at = datetime.datetime.now()
                        parts = test_name.split("_")
                        if len(parts) >= 2:
                            date_part = parts[-2]
                            time_part = parts[-1]
                            if len(date_part) == 8 and len(time_part) == 6 and date_part.isdigit() and time_part.isdigit():
                                try:
                                    created_at = datetime.datetime.strptime(f"{date_part}_{time_part}", "%Y%m%d_%H%M%S")
                                except:
                                    pass
                                    
                        # Insert into DB
                        cur.execute("""
                            INSERT INTO test_results (test_name, username, concurrency, ramp_up, duration, throughput, avg_rt, error_rate, status, created_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """, (test_name, requesting_user or "Guest", metrics["active_users"], 0, 0, metrics["throughput"], metrics["avg_rt"], metrics["error_rate"], status, created_at))
                        conn.commit()
                        db_test_names.add(test_name) # track in memory as successfully synced
                    except Exception as folder_err:
                        print(f"Error syncing folder {test_name} to DB: {folder_err}")
                        try:
                            conn.rollback()
                        except:
                            pass
        
        cur.close()
        release_db_connection(conn)
    except Exception as e:
        print("Error syncing filesystem reports to DB:", e)

@app.get("/list-reports")
def list_reports(username: str = None, sync: bool = False):
    # Auto-sync filesystem folders to DB so old runs show up ONLY on demand
    if sync:
        sync_filesystem_reports_to_db(username)

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        if username and username.strip() != "":
            cur.execute("""
                SELECT test_name, created_at, status, throughput, avg_rt, error_rate
                FROM test_results
                WHERE username = %s
                ORDER BY created_at DESC;
            """, (username.strip(),))
        else:
            cur.execute("""
                SELECT test_name, created_at, status, throughput, avg_rt, error_rate
                FROM test_results
                ORDER BY created_at DESC;
            """)
        rows = cur.fetchall()
        cur.close()
        release_db_connection(conn)

        reports = []
        for row in rows:
            test_name, created_at, status, throughput, avg_rt, error_rate = row
            
            # Check if it has HTML report dynamically
            html_report_path = TEST_RESULT_DIR / test_name / "HTML_Report" / "index.html"
            has_report = html_report_path.exists()
            
            reports.append({
                "test_name": test_name,
                "timestamp": created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else "Unknown",
                "status": status,
                "throughput": throughput,
                "avg_rt": avg_rt,
                "error_rate": error_rate,
                "has_report": has_report
            })
        return JSONResponse(reports)
    except Exception as e:
        print(f"Warning: Database list reports failed: {str(e)}. Falling back to file system list.")
        reports = []
        if TEST_RESULT_DIR.exists():
            for item in TEST_RESULT_DIR.iterdir():
                if item.is_dir():
                    test_name = item.name
                    html_report_path = item / "HTML_Report" / "index.html"
                    has_report = html_report_path.exists()
                    
                    status = "success" if has_report else "failed"
                    mtime = item.stat().st_mtime
                    dt = datetime.datetime.fromtimestamp(mtime)
                    timestamp_str = dt.strftime("%Y-%m-%d %H:%M:%S")

                    reports.append({
                        "test_name": test_name,
                        "timestamp": timestamp_str,
                        "status": status,
                        "throughput": 0.0,
                        "avg_rt": 0.0,
                        "error_rate": 0.0,
                        "has_report": has_report
                    })
        reports.sort(key=lambda x: x["timestamp"], reverse=True)
        return JSONResponse(reports)

@app.delete("/delete-report/{test_name}")
def delete_report(test_name: str):
    test_folder = TEST_RESULT_DIR / test_name
    
    # Delete folder if exists
    if test_folder.exists():
        try:
            shutil.rmtree(test_folder)
        except Exception as e:
            print(f"Warning: Failed to delete directory {test_folder}: {str(e)}")
            
    # Delete from memory status db
    if test_name in test_status_db:
        del test_status_db[test_name]
        
    # Delete from PostgreSQL database
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM test_results WHERE test_name = %s;", (test_name,))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return JSONResponse({"message": "Report deleted successfully"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete report from database: {str(e)}")


# ════════════════════════════════════════════════════════════════════════════
#  PROJECT WORKSPACE  –  CRUD & FILE MANAGEMENT
# ════════════════════════════════════════════════════════════════════════════

@app.get("/projects")
def list_projects(username: str = ""):
    """Return all projects belonging to the given user."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        if username:
            cur.execute("""
                SELECT p.id, p.name, p.description, p.tags, p.owner,
                       p.created_at, p.updated_at,
                       COUNT(pf.id) AS file_count
                FROM projects p
                LEFT JOIN project_files pf ON pf.project_id = p.id
                WHERE p.owner = %s
                GROUP BY p.id
                ORDER BY p.updated_at DESC;
            """, (username,))
        else:
            cur.execute("""
                SELECT p.id, p.name, p.description, p.tags, p.owner,
                       p.created_at, p.updated_at,
                       COUNT(pf.id) AS file_count
                FROM projects p
                LEFT JOIN project_files pf ON pf.project_id = p.id
                GROUP BY p.id
                ORDER BY p.updated_at DESC;
            """)
        rows = cur.fetchall()
        cur.close()
        release_db_connection(conn)
        projects = []
        for row in rows:
            projects.append({
                "id": row[0],
                "name": row[1],
                "description": row[2],
                "tags": row[3],
                "owner": row[4],
                "created_at": row[5].strftime("%Y-%m-%d %H:%M:%S") if row[5] else "",
                "updated_at": row[6].strftime("%Y-%m-%d %H:%M:%S") if row[6] else "",
                "file_count": row[7],
            })
        return JSONResponse(projects)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")


@app.post("/projects")
def create_project(
    name: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
    username: str = Form(""),
):
    """Create a new project workspace."""
    if not name.strip():
        raise HTTPException(status_code=400, detail="Project name must not be empty.")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO projects (name, description, tags, owner)
            VALUES (%s, %s, %s, %s)
            RETURNING id, name, description, tags, owner, created_at, updated_at;
        """, (name.strip(), description.strip(), tags.strip(), username))
        row = cur.fetchone()
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return JSONResponse({
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "tags": row[3],
            "owner": row[4],
            "created_at": row[5].strftime("%Y-%m-%d %H:%M:%S") if row[5] else "",
            "updated_at": row[6].strftime("%Y-%m-%d %H:%M:%S") if row[6] else "",
            "file_count": 0,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@app.put("/projects/{project_id}")
def update_project(
    project_id: int,
    name: str = Form(...),
    description: str = Form(""),
    tags: str = Form(""),
):
    """Update a project's metadata."""
    if not name.strip():
        raise HTTPException(status_code=400, detail="Project name must not be empty.")
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE projects
            SET name = %s, description = %s, tags = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id;
        """, (name.strip(), description.strip(), tags.strip(), project_id))
        if cur.rowcount == 0:
            cur.close()
            release_db_connection(conn)
            raise HTTPException(status_code=404, detail="Project not found.")
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return JSONResponse({"message": "Project updated successfully."})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")


@app.delete("/projects/{project_id}")
def delete_project(project_id: int):
    """Delete a project and cascade-delete its files from disk and DB."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT stored_path FROM project_files WHERE project_id = %s;", (project_id,))
        file_rows = cur.fetchall()
        cur.execute("DELETE FROM projects WHERE id = %s;", (project_id,))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        for fr in file_rows:
            p = Path(fr[0])
            if p.exists():
                p.unlink(missing_ok=True)
        proj_dir = PROJECT_FILES_DIR / str(project_id)
        if proj_dir.exists():
            shutil.rmtree(proj_dir, ignore_errors=True)
        return JSONResponse({"message": "Project deleted successfully."})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


@app.post("/projects/{project_id}/upload")
async def upload_project_file(project_id: int, file: UploadFile = File(...)):
    """Upload any file (JMX, CSV, JTL, YAML, JSON …) into a project workspace."""
    allowed_extensions = {".jmx", ".csv", ".jtl", ".yaml", ".yml", ".json", ".txt", ".xml"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' is not supported. Allowed: {', '.join(sorted(allowed_extensions))}"
        )
    if ext == ".jmx":
        file_type = "jmx"
    elif ext in (".csv", ".jtl"):
        file_type = "csv/jtl"
    elif ext in (".yaml", ".yml"):
        file_type = "yaml"
    elif ext == ".json":
        file_type = "json"
    elif ext == ".xml":
        file_type = "xml"
    else:
        file_type = "other"

    # Verify project exists
    conn = get_db_connection()
    ensure_project_files_schema(conn)
    cur = conn.cursor()
    cur.execute("SELECT id FROM projects WHERE id = %s;", (project_id,))
    if not cur.fetchone():
        cur.close()
        release_db_connection(conn)
        raise HTTPException(status_code=404, detail="Project not found.")
    cur.close()
    release_db_connection(conn)

    # Save file to disk
    proj_dir = PROJECT_FILES_DIR / str(project_id)
    proj_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{Path(file.filename).stem}_{timestamp}{ext}"
    dest = proj_dir / safe_name
    content = await file.read()
    with open(dest, "wb") as f_out:
        f_out.write(content)
    file_size = len(content)

    # Register in DB
    try:
        conn = get_db_connection()
        ensure_project_files_schema(conn)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO project_files (project_id, filename, file_type, file_size, stored_path, file_path)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, filename, file_type, file_size, uploaded_at;
        """, (project_id, file.filename, file_type, file_size, str(dest), str(dest)))
        row = cur.fetchone()
        cur.execute("UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (project_id,))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        return JSONResponse({
            "id": row[0],
            "filename": row[1],
            "file_type": row[2],
            "file_size": row[3],
            "uploaded_at": row[4].strftime("%Y-%m-%d %H:%M:%S") if row[4] else "",
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to register file in DB: {str(e)}")


@app.get("/projects/{project_id}/files")
def list_project_files(project_id: int):
    """List all files belonging to a project."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, filename, file_type, file_size, uploaded_at
            FROM project_files
            WHERE project_id = %s
            ORDER BY uploaded_at DESC;
        """, (project_id,))
        rows = cur.fetchall()
        cur.close()
        release_db_connection(conn)
        files = []
        for row in rows:
            files.append({
                "id": row[0],
                "filename": row[1],
                "file_type": row[2],
                "file_size": row[3],
                "uploaded_at": row[4].strftime("%Y-%m-%d %H:%M:%S") if row[4] else "",
            })
        return JSONResponse(files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list project files: {str(e)}")


@app.delete("/projects/{project_id}/files/{file_id}")
def delete_project_file(project_id: int, file_id: int):
    """Remove a file from a project (DB + disk)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT stored_path FROM project_files WHERE id = %s AND project_id = %s;",
            (file_id, project_id)
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            release_db_connection(conn)
            raise HTTPException(status_code=404, detail="File not found.")
        stored_path = row[0]
        cur.execute("DELETE FROM project_files WHERE id = %s;", (file_id,))
        conn.commit()
        cur.close()
        release_db_connection(conn)
        p = Path(stored_path)
        if p.exists():
            p.unlink(missing_ok=True)
        return JSONResponse({"message": "File deleted successfully."})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@app.get("/projects/{project_id}/files/{file_id}/download")
def download_project_file(project_id: int, file_id: int):
    """Download a project file."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT stored_path, filename FROM project_files WHERE id = %s AND project_id = %s;",
            (file_id, project_id)
        )
        row = cur.fetchone()
        cur.close()
        release_db_connection(conn)
        if not row:
            raise HTTPException(status_code=404, detail="File not found.")
        stored_path, filename = row
        p = Path(stored_path)
        if not p.exists():
            raise HTTPException(status_code=404, detail="File missing from disk.")
        return FileResponse(path=str(p), filename=filename, media_type="application/octet-stream")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download file: {str(e)}")
