from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path

app = FastAPI()

UPLOAD_DIR = Path("../Uploads")
JMX_DIR = UPLOAD_DIR / "jmx"
CSV_DIR = UPLOAD_DIR / "csv"

JMX_DIR.mkdir(parents=True, exist_ok=True)
CSV_DIR.mkdir(parents=True, exist_ok=True)

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