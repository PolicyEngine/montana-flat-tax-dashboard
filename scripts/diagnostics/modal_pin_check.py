"""Run pin_check.py on Modal.

From the repository root, for the pinned environment (raw and mapped
dataset):
    modal run --detach scripts/diagnostics/modal_pin_check.py
For another environment, point PIN_CHECK_LOCK at its lock file:
    PIN_CHECK_LOCK=/path/to/old.lock.txt modal run --detach \
        scripts/diagnostics/modal_pin_check.py --raw-only
Results land on the mt-flat-tax-losers volume as pin_check_<version>_<raw|mapped>.json.
"""
import os
import pathlib

import modal

ROOT = (
    pathlib.Path(__file__).resolve().parents[2]
    if modal.is_local()
    else pathlib.Path("/repo")
)
LOCK = os.environ.get("PIN_CHECK_LOCK", str(ROOT / "requirements.lock.txt"))

image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install_from_requirements(LOCK)
    .add_local_dir(str(ROOT / "scripts"), "/repo/scripts")
    .add_local_file(str(ROOT / "reform.json"), "/repo/reform.json")
)
app = modal.App("mt-flat-tax-pin-check")
vol = modal.Volume.from_name("mt-flat-tax-losers", create_if_missing=True)


@app.function(image=image, volumes={"/out": vol}, cpu=4, memory=16384, timeout=3600)
def run_check(mapped: bool):
    import importlib.metadata as md
    import sys

    sys.path.insert(0, "/repo/scripts")
    sys.path.insert(0, "/repo/scripts/diagnostics")
    import pin_check

    label = "mapped" if mapped else "raw"
    out = f"/out/pin_check_{md.version('policyengine-us')}_{label}.json"

    def log(msg):
        print(msg, flush=True)

    pin_check.main(out, mapped=mapped, log=log)
    vol.commit()
    return out


@app.local_entrypoint()
def go(raw_only: bool = False, mapped_only: bool = False):
    choices = [False] if raw_only else [True] if mapped_only else [False, True]
    for mapped in choices:
        call = run_check.spawn(mapped)
        print(f"spawned mapped={mapped} {call.object_id}")
