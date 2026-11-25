"""Shared reform definition for the Montana flat income tax dashboard.

The reform is Gov. Gianforte's 2029 biennium executive budget proposal
(Section R, pages REF-7 and REF-8, released November 16, 2026):

* Top marginal income tax rate 5.4% -> 5.0% in tax year 2028, then 4.7%
  in tax year 2029 and after, which leaves one flat 4.7% rate.
* Montana earned income tax credit 20% -> 30% of the federal credit. The
  budget books the cost from fiscal year 2029, so the pipeline starts the
  30% match in tax year 2028 (returns filed in early 2029).

reform.json at the repository root is the canonical parameter set; this
module only loads it and splits it by provision.
"""
import json
import os

from policyengine_core.reforms import Reform

from dataset_config import (
    DISTRICT_GEOIDS,
    MT_STATE_FIPS,
    POPULACE_BUILD,
    POPULACE_FILE,
    POPULACE_REPO,
    POPULACE_TAG,
)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "frontend", "public", "data")

# Tax years the dashboard reports: the 5.0% step year and the first year
# of the flat 4.7% rate.
YEARS = [2028, 2029]

# Montana households from the Populace ACS local-area release, sliced by
# scripts/build_dataset.py (see dataset_config.py). The slices live on the
# mt-flat-tax-data Modal volume; MT_DATASET_DIR points at a local copy.
DATASET_DIR = os.environ.get(
    "MT_DATASET_DIR",
    os.path.join(ROOT, ".cache", "datasets", "populace", POPULACE_TAG),
)
DISTRICTS = list(DISTRICT_GEOIDS)
# Recorded with the results (validation.json provenance).
DATASET_SOURCE = (
    f"hf://{POPULACE_REPO}/{POPULACE_FILE}@{POPULACE_BUILD}, "
    f"Montana households (state_fips {MT_STATE_FIPS})"
)

EITC_KEY = "gov.states.mt.tax.income.credits.eitc.match"

with open(os.path.join(ROOT, "reform.json")) as f:
    REFORM_DICT = json.load(f)

RATE_REFORM_DICT = {k: v for k, v in REFORM_DICT.items() if k != EITC_KEY}
EITC_REFORM_DICT = {EITC_KEY: REFORM_DICT[EITC_KEY]}


def make_reform(reform_dict=None):
    """Build a policyengine-core Reform from a parameter-change dict."""
    return Reform.from_dict(reform_dict or REFORM_DICT, country_id="us")


def load_dataset(name="MT"):
    """Load a Montana slice: "MT" for the state, or "MT-01" / "MT-02"."""
    from policyengine_us.data import USSingleYearDataset

    path = os.path.join(DATASET_DIR, f"{name}.h5")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"{path} is missing. Build the slices with `modal run "
            "scripts/build_dataset.py`, then `modal volume get mt-flat-tax-data "
            "populace .cache/datasets --force`."
        )
    return USSingleYearDataset(file_path=path)
