"""Baseline totals on the Montana dataset, for checking a policyengine-us pin.

Run under the old and the new environment and compare the two JSON files.
Every dataset column is summed with its entity weight, together with the
derived totals the dashboard depends on and the reform's headline effects.
A column a release no longer reads shows up as a total that falls to zero
or changes sharply.

The dataset is one of:
  "populace"      the dashboard's dataset (reform_def.load_dataset());
  "legacy-mapped" the May 2026 policyengine-us-data MT.h5, with the column
                  changes in legacy_dataset.load_legacy_dataset();
  "legacy-raw"    the same file as published.

    modal run --detach scripts/diagnostics/modal_pin_check.py
"""
import importlib.metadata as md
import json

import numpy as np
from policyengine_us import Microsimulation

from legacy_dataset import LEGACY_MT_DATASET, load_legacy_dataset
from reform_def import DATASET_SOURCE, DATASET_DIR, YEARS, load_dataset, make_reform

DERIVED = [
    "household_weight", "person_weight", "employment_income",
    "self_employment_income", "partnership_s_corp_income", "partnership_income",
    "s_corp_income", "partnership_self_employment_net_earnings",
    "long_term_capital_gains", "qualified_dividend_income",
    "taxable_pension_income", "social_security", "taxable_social_security",
    "adjusted_gross_income", "taxable_income", "self_employment_tax",
    "qualified_business_income_deduction", "tax_unit_itemizes",
    "itemized_taxable_income_deductions", "salt_deduction",
    "state_withheld_income_tax", "deductible_mortgage_interest", "eitc", "ctc",
    "income_tax", "mt_agi", "mt_taxable_income",
    "mt_income_tax_before_refundable_credits_unit", "mt_eitc", "mt_income_tax",
    "household_net_income", "in_poverty", "in_deep_poverty",
]


def weighted_totals(sim, names, year):
    out = {}
    for name in names:
        if name not in sim.tax_benefit_system.variables:
            continue  # bookkeeping columns the model does not read
        try:
            values = sim.calculate(name, year)
        except Exception as error:  # noqa: BLE001 - recorded, not raised
            out[name] = f"error: {type(error).__name__}"
            continue
        if np.asarray(values).dtype.kind in "biuf":
            out[name] = float(values.sum())
    return out


def dataset_columns(which):
    """Columns the dataset stores, for summing."""
    if which == "populace":
        import pandas as pd

        with pd.HDFStore(f"{DATASET_DIR}/MT.h5", "r") as store:
            keys = [k for k in store.keys() if k != "/_time_period"]
            return sorted({c for k in keys for c in store[k].columns})
    import h5py
    from huggingface_hub import hf_hub_download

    with h5py.File(hf_hub_download(
        "policyengine/policyengine-us-data", LEGACY_MT_DATASET.split("/", 4)[-1]
    )) as f:
        return sorted(f.keys())


def main(out_path, which="populace", log=print):
    datasets = {
        "populace": (load_dataset, DATASET_SOURCE),
        "legacy-mapped": (load_legacy_dataset, LEGACY_MT_DATASET + " (mapped)"),
        "legacy-raw": (lambda: LEGACY_MT_DATASET, LEGACY_MT_DATASET),
    }
    load, source = datasets[which]
    names = dataset_columns(which)
    names += [n for n in DERIVED if n not in names]

    result = {
        "policyengine_us": md.version("policyengine-us"),
        "dataset": source,
        "which": which,
        "years": {},
    }
    for year in YEARS:
        base = Microsimulation(dataset=load())
        totals = weighted_totals(base, names, year)
        ref = Microsimulation(dataset=load(), reform=make_reform())

        def hh(sim, var):
            return np.array(sim.calculate(var, year, map_to="household"))

        w = hh(base, "household_weight")
        change = hh(ref, "household_net_income") - hh(base, "household_net_income")
        result["years"][year] = {
            "totals": totals,
            "reform": {
                "mt_revenue_change": float(
                    ((hh(ref, "mt_income_tax") - hh(base, "mt_income_tax")) * w).sum()
                ),
                "federal_revenue_change": float(
                    ((hh(ref, "income_tax") - hh(base, "income_tax")) * w).sum()
                ),
                "households_gaining": float(w[change > 1].sum()),
                "households_losing": float(w[change < -1].sum()),
                "households": float(w.sum()),
            },
        }
        log(f"{year}: {json.dumps(result['years'][year]['reform'])}")
        del base, ref
        with open(out_path, "w") as f:
            json.dump(result, f, indent=1)
    return result
