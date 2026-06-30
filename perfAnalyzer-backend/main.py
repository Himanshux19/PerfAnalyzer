from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
from pathlib import Path
import yaml
import subprocess

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JMETER_CMD = shutil.which("jmeter") or shutil.which("jmeter.bat")
BZT_CMD = shutil.which("bzt")

HTML_REPORTS_DIR = Path("../HTML Reports")
HTML_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

RESULTS_DIR = Path("../TestResults")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_DIR = Path("../Uploads")
JMX_DIR = UPLOAD_DIR / "jmx"
CSV_DIR = UPLOAD_DIR / "csv"

JMX_DIR.mkdir(parents=True, exist_ok=True)
CSV_DIR.mkdir(parents=True, exist_ok=True)

TEMPLATE_YAML = Path("template.yml")
GENERATED_YAML = Path("generated.yml")

def get_next_filename(directory: Path, prefix: str, extension: str) -> Path:
    """
    Returns the next sequential filename.
    Example:
        Test1.jmx
        Test2.jmx
        Result1.csv
        Result2.csv
    """
    numbers = []

    for file in directory.iterdir():
        if file.is_file() and file.suffix.lower() == extension:
            name = file.stem

            if name.startswith(prefix):
                try:
                    number = int(name[len(prefix):])
                    numbers.append(number)
                except ValueError:
                    pass

    next_number = max(numbers, default=0) + 1
    return directory / f"{prefix}{next_number}{extension}"

# Upload JMX File
@app.post("/upload/jmx")
async def upload_jmx(file: UploadFile = File(...)):

    if not file.filename.lower().endswith(".jmx"):
        raise HTTPException(
            status_code=400,
            detail="Only JMX files are allowed."
        )

    file_path = get_next_filename(JMX_DIR, "Test", ".jmx")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return JSONResponse({
        "message": "JMX uploaded successfully.",
        "filename": file_path.name,
        "path": str(file_path)
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

    file_path = get_next_filename(CSV_DIR, "Result", ".csv")

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return JSONResponse({
        "message": "CSV/JTL file uploaded successfully.",
        "filename": file_path.name,
        "path": str(file_path)
    })

import threading

test_status_db = {}  # Global dict to store test execution status

def run_taurus_in_background(test_name: str, cmd: list):
    try:
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        if process.returncode != 0:
            test_status_db[test_name] = {"status": "error", "error": process.stderr}
        else:
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
        jmx_path = JMX_DIR / jmx_filename
        test_name = jmx_path.stem
        result_folder = RESULTS_DIR / test_name
        result_folder.mkdir(parents=True, exist_ok=True)

        if not jmx_path.exists():
            raise HTTPException(
                status_code=404,
                detail="JMX file not found."
            )

        # Read template YAML
        with open(TEMPLATE_YAML, "r") as file:
            config = yaml.safe_load(file)

        # Update execution configuration
        execution = config["execution"][0]
        execution["concurrency"] = threads
        execution["ramp-up"] = f"{ramp_up}s"
        execution["hold-for"] = f"{duration}s"

        # Update script path
        config["scenarios"]["demo"]["script"] = str(jmx_path)
        config["settings"]["artifacts-dir"] = str(result_folder)

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

    result_folder = RESULTS_DIR / test_name
    jmeter_log_path = result_folder / "jmeter.log"
    bzt_log_path = result_folder / "bzt.log"
    kpi_path = result_folder / "kpi.jtl"

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

    # Parse kpi.jtl for exact throughput, response times, error rates and thread counts
    throughput = 0.0
    avg_rt = 0.0
    error_rate = 0.0
    active_users = 0

    if kpi_path.exists():
        try:
            with open(kpi_path, "r", encoding="utf-8", errors="ignore") as f:
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
                    max_ts = max(timestamps)
                    duration_sec = (max_ts - min_ts) / 1000.0

                    total_reqs = len(timestamps)
                    if duration_sec > 0:
                        throughput = total_reqs / duration_sec
                    else:
                        throughput = float(total_reqs)

                    if total_reqs > 0:
                        avg_rt = sum(elapseds) / total_reqs
                        error_rate = (failures / total_reqs) * 100.0
                        active_users = threads_list[-1] if threads_list else 0
        except Exception as e:
            print("Error parsing kpi.jtl:", e)

    return JSONResponse({
        "status": status_info["status"],
        "error": status_info["error"],
        "jmeter_log": jmeter_content,
        "bzt_log": bzt_content,
        "throughput": round(throughput, 2),
        "avg_rt": round(avg_rt, 0),
        "error_rate": round(error_rate, 2),
        "active_users": active_users
    })

@app.post("/generate-html")
async def generate_html(csv_filename: str = Form(...)):
    try:
        csv_path = CSV_DIR / csv_filename

        if not csv_path.exists():
            raise HTTPException(
                status_code=404,
                detail="CSV/JTL file not found."
            )

        report_name = csv_path.stem

        output_folder = HTML_REPORTS_DIR / report_name

        if output_folder.exists():
            shutil.rmtree(output_folder)

        output_folder.mkdir(parents=True, exist_ok=True)

        process = subprocess.run(
        [
            JMETER_CMD,
            "-g",
            str(csv_path),
            "-o",
            str(output_folder)
        ],
        capture_output=True,
        text=True
    )

        if process.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=process.stderr
            )

        return JSONResponse({
            "message": "HTML Report generated successfully.",
            "report_folder": str(output_folder)
        })

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )