"""The May 2026 policyengine-us-data Montana file, for comparison runs.

The dashboard used hf://policyengine/policyengine-us-data/states/MT.h5 until
November 24, 2026, when it moved to the Populace ACS local-area release.
pin_check.py can still run on the old file through load_legacy_dataset(),
which makes the changes current policyengine-us needs to read it.
"""
import os

import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
LEGACY_MT_DATASET = "hf://policyengine/policyengine-us-data/states/MT.h5"

# The Montana files were built in May 2026. policyengine-us has since
# renamed or removed three of their columns, and an unknown column is
# skipped with a warning, so load_legacy_dataset() maps them to current names. It
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

CACHE_DIR = os.path.join(ROOT, ".cache", "datasets", "legacy")


def load_legacy_dataset(url=LEGACY_MT_DATASET):
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
