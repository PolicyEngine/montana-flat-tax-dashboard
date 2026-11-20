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

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "frontend", "public", "data")

# Tax years the dashboard reports: the 5.0% step year and the first year
# of the flat 4.7% rate.
YEARS = [2028, 2029]

MT_DATASET = "hf://policyengine/policyengine-us-data/states/MT.h5"
DISTRICT_DATASET = "hf://policyengine/policyengine-us-data/districts/{district}.h5"
DISTRICTS = ["MT-01", "MT-02"]

EITC_KEY = "gov.states.mt.tax.income.credits.eitc.match"

with open(os.path.join(ROOT, "reform.json")) as f:
    REFORM_DICT = json.load(f)

RATE_REFORM_DICT = {k: v for k, v in REFORM_DICT.items() if k != EITC_KEY}
EITC_REFORM_DICT = {EITC_KEY: REFORM_DICT[EITC_KEY]}


def make_reform(reform_dict=None):
    """Build a policyengine-core Reform from a parameter-change dict."""
    return Reform.from_dict(reform_dict or REFORM_DICT, country_id="us")
