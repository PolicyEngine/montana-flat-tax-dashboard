"""Baseline totals on the Montana dataset, for checking a policyengine-us pin.

Run under the old and the new environment and compare the two JSON files.
Every dataset column is summed with its entity weight, together with the
derived totals the dashboard depends on and the reform's headline effects.
A column a release no longer reads shows up as a total that falls to zero
or changes sharply.

With mapped=True the dataset is loaded through reform_def.load_dataset(),
which renames the columns policyengine-us has renamed since the dataset
was built.

    modal run --detach scripts/diagnostics/modal_pin_check.py
"""
import importlib.metadata as md
import json

import h5py
import numpy as np
from huggingface_hub import hf_hub_download
from policyengine_us import Microsimulation

from reform_def import LEGACY_RENAMES, MT_DATASET, YEARS, load_dataset, make_reform

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
        try:
            values = sim.calculate(name, year)
        except Exception as error:  # noqa: BLE001 - recorded, not raised
            out[name] = f"error: {type(error).__name__}"
            continue
        if np.asarray(values).dtype.kind in "biuf":
            out[name] = float(values.sum())
    return out


def main(out_path, mapped=False, log=print):
    with h5py.File(hf_hub_download(
        "policyengine/policyengine-us-data", MT_DATASET.split("/", 4)[-1]
    )) as f:
        columns = sorted(f.keys())
    dataset = load_dataset(MT_DATASET) if mapped else MT_DATASET
    names = columns + [n for n in DERIVED if n not in columns]
    if mapped:
        names += [n for n in LEGACY_RENAMES.values() if n not in names]

    result = {
        "policyengine_us": md.version("policyengine-us"),
        "mapped": mapped,
        "dataset": MT_DATASET,
        "years": {},
    }
    for year in YEARS:
        base = Microsimulation(dataset=dataset)
        totals = weighted_totals(base, names, year)
        ref = Microsimulation(dataset=dataset, reform=make_reform())

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
