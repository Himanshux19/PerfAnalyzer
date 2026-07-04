import yaml

from models import CreateTestRequest


def build_taurus_yaml(request: CreateTestRequest, jmx_filename: str) -> str:
    scenario_name = _slugify(request.testName) or "test_scenario"

    execution_entry = {
        "executor": "jmeter",
        "scenario": scenario_name,
        "concurrency": request.threads,
        "ramp-up": f"{request.rampUp}s",
        "hold-for": f"{request.duration}s",
    }
    if request.loopCount and request.loopCount > 0:
        execution_entry["iterations"] = request.loopCount

    config = {
        "execution": [execution_entry],
        "scenarios": {
            scenario_name: {
                "script": jmx_filename,
            }
        },
        "reporting": [
            {"module": "console"},
        ],
    }

    return yaml.dump(config, sort_keys=False, default_flow_style=False)


def _slugify(value: str) -> str:
    safe = "".join(c if c.isalnum() else "_" for c in value.strip().lower())
    while "__" in safe:
        safe = safe.replace("__", "_")
    return safe.strip("_")