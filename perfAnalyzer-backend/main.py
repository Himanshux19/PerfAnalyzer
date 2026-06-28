from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
import yaml
import subprocess

app = FastAPI()

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
        "filename": file.filename,
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
        "filename": file.filename,
        "path": str(file_path)
    })

@app.post("/run-test")
async def run_test(
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

        # Execute Taurus
        process = subprocess.run(
            [BZT_CMD, str(GENERATED_YAML)],
            capture_output=True,
            text=True
        )

        if process.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=process.stderr
            )

        return JSONResponse({
            "message": "Test executed successfully."
        })

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

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