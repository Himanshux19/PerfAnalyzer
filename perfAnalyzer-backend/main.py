from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
from pathlib import Path
import yaml
import subprocess
import hashlib
import json
import jwt
import datetime
import tempfile
import psycopg2
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

def get_db_connection(dbname=DB_NAME):
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=dbname,
        user=DB_USER,
        password=DB_PASS
    )

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
        conn.commit()
        cur.close()
        conn.close()
        print("PostgreSQL Database initialized successfully.")
    except Exception as e:
        print(f"Warning: PostgreSQL Database initialization failed: {str(e)}")

@app.on_event("startup")
def startup_event():
    init_db()

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
            conn.close()
            raise HTTPException(status_code=400, detail="Gmail address already registered.")
        
        # Insert user
        pwd_hash = hash_password(password)
        cur.execute(
            "INSERT INTO users (username, password_hash, full_name) VALUES (%s, %s, %s);",
            (username, pwd_hash, full_name)
        )
        conn.commit()
        cur.close()
        conn.close()
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
            conn.close()
            raise HTTPException(status_code=401, detail="Invalid Gmail address or password.")
            
        pwd_hash, full_name = row
        cur.close()
        conn.close()
        
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
                test_status_db[test_name] = {
                    "status": "error",
                    "error": f"Taurus completed successfully, but JMeter report generation failed: {jmeter_process.stderr}"
                }
                return
                
        test_status_db[test_name] = {"status": "success", "error": ""}
    except Exception as e:
        test_status_db[test_name] = {"status": "error", "error": str(e)}

@app.post("/run-test")
def run_test(
    jmx_filename: str = Form(...),
    threads: int = Form(...),
    ramp_up: int = Form(...),
    duration: int = Form(...)
):
    try:
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
                    else:
                        test_status_db[test_name] = {"status": "success", "error": "", "type": "csv_report"}
                except Exception as e:
                    test_status_db[test_name] = {"status": "error", "error": str(e), "type": "csv_report"}
            
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