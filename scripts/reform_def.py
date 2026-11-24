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

import numpy as np
from policyengine_core.reforms import Reform

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA_DIR = os.path.join(ROOT, "frontend", "public", "data")

# Tax years the dashboard reports: the 5.0% step year and the first year
# of the flat 4.7% rate.
YEARS = [2028, 2029]

MT_DATASET = "hf://policyengine/policyengine-us-data/states/MT.h5"
DISTRICT_DATASET = "hf://policyengine/policyengine-us-data/districts/{district}.h5"
DISTRICTS = ["MT-01", "MT-02"]

# The Montana files were built in May 2026. policyengine-us has since
# renamed or removed three of their columns, and an unknown column is
# skipped with a warning, so load_dataset() maps them to current names. It
# also makes two changes the current SPM threshold calculator needs.
LEGACY_RENAMES = {
    # policyengine-us #8614 (June 2026) renamed partnership_se_income.
    "partnership_se_income": "partnership_self_employment_net_earnings",
    # #8614 also made partnership_s_corp_income the sum of
    # partnership_income and s_corp_income, so the dataset's combined
    # column no longer reaches later years. Every federal and Montana
    # formula reads the sum, so the combined amount goes to
    # partnership_income.
    "partnership_s_corp_income": "partnership_income",
}
# Removed in policyengine-us #9605 (October 2026). The datasets' person-level
# home_mortgage_interest column holds the same amounts.
LEGACY_DROPS = ["first_home_mortgage_interest", "second_home_mortgage_interest"]

CACHE_DIR = os.path.join(ROOT, ".cache", "datasets")

EITC_KEY = "gov.states.mt.tax.income.credits.eitc.match"

with open(os.path.join(ROOT, "reform.json")) as f:
    REFORM_DICT = json.load(f)

RATE_REFORM_DICT = {k: v for k, v in REFORM_DICT.items() if k != EITC_KEY}
EITC_REFORM_DICT = {EITC_KEY: REFORM_DICT[EITC_KEY]}


def make_reform(reform_dict=None):
    """Build a policyengine-core Reform from a parameter-change dict."""
    return Reform.from_dict(reform_dict or REFORM_DICT, country_id="us")


def load_dataset(url):
    """Return a local copy of an hf:// dataset with current column names."""
    import shutil

    import h5py
    from huggingface_hub import hf_hub_download

    owner, repo, filename = url.removeprefix("hf://").split("/", 2)
    source = hf_hub_download(f"{owner}/{repo}", filename)
    path = os.path.join(CACHE_DIR, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    shutil.copyfile(source, path)
    with h5py.File(path, "r+") as f:
        for old, new in LEGACY_RENAMES.items():
            if old in f and new not in f:
                f.move(old, new)
        for name in LEGACY_DROPS:
            if name in f:
                del f[name]
        # The files store county_fips as integers. The SPM threshold
        # calculator in current policyengine-us accepts only five-digit text
        # ("30049"), so poverty measures fail on the integer codes.
        if "county_fips" in f:
            group = f["county_fips"]
            for period in list(group.keys()):
                codes = group[period][:]
                if codes.dtype.kind in "iu":
                    del group[period]
                    group[period] = np.char.zfill(codes.astype(str), 5).astype("S5")
        # Current policyengine-us stops every SPM threshold calculation if
        # any SPM unit has no member it classifies as an adult (18 or older,
        # or 15 or older and a household head or spouse). Ten records in
        # MT.h5 are a 15- or 16-year-old in an SPM unit of their own. The
        # Census Bureau counts unrelated individuals aged 15 and older as
        # one-adult units, so they are flagged as independent. For everyone
        # else the flag equals the model's own formula, because the files
        # carry is_household_head and no is_household_spouse.
        if "is_spm_independent_minor_role" not in f:
            def first(name):
                return f[name][next(iter(f[name].keys()))][:]

            age = first("age")
            head = first("is_household_head").astype(bool)
            _, unit = np.unique(first("person_spm_unit_id"), return_inverse=True)
            has_adult = np.bincount(unit, weights=(age >= 18) | head) > 0
            role = head | (~has_adult[unit] & (age >= 15))
            # Stored like is_household_head, which has no period.
            f["is_spm_independent_minor_role/ETERNITY"] = role
    return path
