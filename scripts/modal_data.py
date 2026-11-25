"""Run the three data pipelines (`make data`) on Modal.

From the repository root:
    modal run --detach scripts/modal_data.py
    modal volume get mt-flat-tax-losers data frontend/public --force

Each pipeline runs in its own container with the pinned environment
(requirements.lock.txt), reads the Montana slices from the mt-flat-tax-data
volume (scripts/build_dataset.py) and writes its files to data/ on the
mt-flat-tax-losers volume.
"""
import pathlib
import sys

import modal

# Inside the container this module sits at /root, so the repository path
# only means something on the local side.
ROOT = (
    pathlib.Path(__file__).resolve().parents[1]
    if modal.is_local()
    else pathlib.Path("/repo")
)

sys.path.insert(0, str(ROOT / "scripts"))
from dataset_config import POPULACE_TAG  # noqa: E402

image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install_from_requirements(str(ROOT / "requirements.lock.txt"))
    .env({"MT_DATASET_DIR": f"/data/populace/{POPULACE_TAG}"})
    .add_local_dir(str(ROOT / "scripts"), "/repo/scripts")
    .add_local_file(str(ROOT / "reform.json"), "/repo/reform.json")
)
app = modal.App("mt-flat-tax-data")
vol = modal.Volume.from_name("mt-flat-tax-losers", create_if_missing=True)
# Montana slices from scripts/build_dataset.py.
data = modal.Volume.from_name("mt-flat-tax-data")

PIPELINES = ["pipeline.py", "district_pipeline.py", "compute_example_households.py"]


@app.function(image=image, volumes={"/out": vol, "/data": data}, cpu=4, memory=32768, timeout=3600)
def run_pipeline(script: str):
    import shutil
    import subprocess

    data_dir = pathlib.Path("/repo/frontend/public/data")
    # Only pipeline.py creates the folder; the other two expect it.
    data_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(["python", script], cwd="/repo/scripts", check=True)
    out = pathlib.Path("/out/data")
    out.mkdir(exist_ok=True)
    written = []
    for path in sorted(data_dir.iterdir()):
        if path.is_file():
            shutil.copy(path, out / path.name)
            written.append(path.name)
    vol.commit()
    return written


@app.local_entrypoint()
def go(only: str = ""):
    for script in [s for s in PIPELINES if not only or s in only.split(",")]:
        call = run_pipeline.spawn(script)
        print(f"spawned {script} {call.object_id}")
