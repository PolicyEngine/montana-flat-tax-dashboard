"""Run pin_check.py on Modal.

From the repository root, for the pinned environment:
    modal run --detach scripts/diagnostics/modal_pin_check.py \
        --which populace,legacy-mapped
For another environment, point PIN_CHECK_LOCK at its lock file:
    PIN_CHECK_LOCK=/path/to/old.lock.txt modal run --detach \
        scripts/diagnostics/modal_pin_check.py --which legacy-raw
Results land on the mt-flat-tax-losers volume as
pin_check_<version>_<dataset>.json (see pin_check.py for the datasets).
"""
import os
import pathlib
import sys

import modal

ROOT = (
    pathlib.Path(__file__).resolve().parents[2]
    if modal.is_local()
    else pathlib.Path("/repo")
)
LOCK = os.environ.get("PIN_CHECK_LOCK", str(ROOT / "requirements.lock.txt"))

sys.path.insert(0, str(ROOT / "scripts"))
from dataset_config import POPULACE_TAG  # noqa: E402

image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install_from_requirements(LOCK)
    .env({"MT_DATASET_DIR": f"/data/populace/{POPULACE_TAG}"})
    .add_local_dir(str(ROOT / "scripts"), "/repo/scripts")
    .add_local_file(str(ROOT / "reform.json"), "/repo/reform.json")
)
app = modal.App("mt-flat-tax-pin-check")
vol = modal.Volume.from_name("mt-flat-tax-losers", create_if_missing=True)
data = modal.Volume.from_name("mt-flat-tax-data")


@app.function(image=image, volumes={"/out": vol, "/data": data}, cpu=4, memory=16384, timeout=3600)
def run_check(which: str):
    import importlib.metadata as md
    import sys

    sys.path.insert(0, "/repo/scripts")
    sys.path.insert(0, "/repo/scripts/diagnostics")
    import pin_check

    out = f"/out/pin_check_{md.version('policyengine-us')}_{which}.json"

    def log(msg):
        print(msg, flush=True)

    pin_check.main(out, which=which, log=log)
    vol.commit()
    return out


@app.local_entrypoint()
def go(which: str = "populace"):
    for name in which.split(","):
        call = run_check.spawn(name)
        print(f"spawned {name} {call.object_id}")
