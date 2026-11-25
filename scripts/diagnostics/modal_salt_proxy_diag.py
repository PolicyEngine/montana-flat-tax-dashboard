"""Run salt_proxy_diag.py on Modal with the repository's pinned environment.

From the repository root:
    modal run --detach scripts/diagnostics/modal_salt_proxy_diag.py
    modal run --detach scripts/diagnostics/modal_salt_proxy_diag.py --what order_credits
    modal volume get mt-flat-tax-losers salt_proxy_diag_<policyengine-us version>_populace.json .
"""

import pathlib
import sys

import modal

# Inside the container this module sits at /root, so the repository path
# only means something on the local side.
ROOT = (
    pathlib.Path(__file__).resolve().parents[2]
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
app = modal.App("mt-flat-tax-salt-proxy-diag")
vol = modal.Volume.from_name("mt-flat-tax-losers", create_if_missing=True)
data = modal.Volume.from_name("mt-flat-tax-data")


@app.function(image=image, volumes={"/out": vol, "/data": data}, cpu=4, memory=16384, timeout=3600)
def run_diag():
    import sys

    sys.path.insert(0, "/repo/scripts")
    sys.path.insert(0, "/repo/scripts/diagnostics")
    import salt_proxy_diag

    def log(msg):
        print(msg, flush=True)
        vol.commit()

    import importlib.metadata as md

    out = f"/out/salt_proxy_diag_{md.version('policyengine-us')}_populace.json"
    salt_proxy_diag.main(out, log=log)
    vol.commit()


@app.function(image=image, volumes={"/out": vol, "/data": data}, cpu=4, memory=16384, timeout=3600)
def run_order_credits():
    import json
    import sys

    sys.path.insert(0, "/repo/scripts/diagnostics")
    import salt_proxy_diag

    result = salt_proxy_diag.order_credits(2029)
    with open("/out/order_credits.json", "w") as f:
        json.dump(result, f, indent=2)
    vol.commit()


@app.local_entrypoint()
def go(what: str = "diag"):
    fn = run_order_credits if what == "order_credits" else run_diag
    call = fn.spawn()
    print(f"spawned {call.object_id}")
