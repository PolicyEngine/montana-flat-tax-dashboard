"""Precompute example Montana households for the Household impact tab.

Builds synthetic Montana households, sweeps the head's employment income,
and compares current law with the governor's proposal for each tax year
in YEARS. Writes frontend/public/data/example_households_{year}.json in
the schema the ExampleHouseholds component reads.

Each household's change is split by provision, from the household's
point of view (positive = gain):

  eitc_change        = change in the Montana earned income tax credit
  rate_change        = fall in Montana income tax net of the credit change
  federal_tax_change = fall in federal income tax (negative when a smaller
                       Montana tax bill shrinks the federal deduction for
                       state and local taxes)
"""
import json
import os

import numpy as np
from policyengine_us import Simulation

from reform_def import DATA_DIR, REFORM_DICT, YEARS, make_reform

XMAX = 400_000
NPTS = 161  # $0 to $400k in $2,500 steps

# Three profiles, one per outcome: a household that gains from the EITC
# increase, one the proposal does not affect (no EITC, taxable income
# below the top-rate threshold), and one that gains from the rate change.
# label, employment income, age of head, married, dependent ages
PROFILES = [
    ("Single parent, 1 child, $25k", 25_000, 30, False, [4]),
    ("Single, no children, $40k", 40_000, 35, False, []),
    ("Married, no children, $300k", 300_000, 50, True, []),
]


def build_situation(year, age_head, married, dep_ages):
    people = {"head": {"age": {year: age_head}}}
    members = ["head"]
    if married:
        people["spouse"] = {"age": {year: age_head}, "employment_income": {year: 0}}
        members.append("spouse")
    for i, a in enumerate(dep_ages):
        k = f"child{i}"
        people[k] = {"age": {year: a}, "employment_income": {year: 0}}
        members.append(k)
    return {
        "people": people,
        "families": {"family": {"members": members}},
        "marital_units": {"mu": {"members": ["head", "spouse"] if married else ["head"]}},
        "tax_units": {"tu": {"members": members}},
        "spm_units": {"spm": {"members": members}},
        "households": {"hh": {"members": members, "state_name": {year: "MT"}}},
        "axes": [[{"name": "employment_income", "count": NPTS, "min": 0,
                   "max": XMAX, "period": year}]],
    }


def household_totals(sim, year):
    """Per-sweep-point household totals for the variables of interest."""
    def hh(var):
        return np.array(sim.calculate(var, year, map_to="household"))
    return {
        "net": hh("household_net_income"),
        "state": hh("mt_income_tax"),
        "federal": hh("income_tax"),
        "eitc": hh("mt_eitc"),
    }


reform = make_reform(REFORM_DICT)
for year in YEARS:
    households = []
    xs = np.linspace(0, XMAX, NPTS)
    for label, income, age, married, deps in PROFILES:
        sit = build_situation(year, age, married, deps)
        b = household_totals(Simulation(situation=sit), year)
        r = household_totals(Simulation(situation=sit, reform=reform), year)

        net_chg = r["net"] - b["net"]
        state_chg = r["state"] - b["state"]
        fed_chg = r["federal"] - b["federal"]
        eitc_gain = r["eitc"] - b["eitc"]
        rate_gain = -state_chg - eitc_gain
        fed_gain = -fed_chg

        idx = int(np.argmin(np.abs(xs - income)))
        households.append({
            "label": label,
            "income": income,
            "age_head": age,
            "married": married,
            "dependents": deps,
            "baseline": {
                "household_net_income": float(b["net"][idx]),
                "state_income_tax": float(b["state"][idx]),
                "income_tax": float(b["federal"][idx]),
            },
            "reform": {
                "household_net_income": float(r["net"][idx]),
                "state_income_tax": float(r["state"][idx]),
                "income_tax": float(r["federal"][idx]),
            },
            "net_income_change": float(net_chg[idx]),
            "federal_tax_change": float(fed_chg[idx]),
            "provisions_at_income": {
                "rate_change": float(rate_gain[idx]),
                "eitc_change": float(eitc_gain[idx]),
                "federal_tax_change": float(fed_gain[idx]),
            },
            "chart": {
                "income_range": [float(x) for x in xs],
                "net_income_change": [round(float(v), 2) for v in net_chg],
                "state_tax_change": [round(float(v), 2) for v in state_chg],
                "federal_tax_change": [round(float(v), 2) for v in fed_chg],
                "provisions": {
                    "rate_change": [round(float(v), 2) for v in rate_gain],
                    "eitc_change": [round(float(v), 2) for v in eitc_gain],
                    "federal_tax_change": [round(float(v), 2) for v in fed_gain],
                },
            },
        })
        print(
            f"{year} {label}: net ${net_chg[idx]:+.0f} "
            f"(rates ${rate_gain[idx]:+.0f}, EITC ${eitc_gain[idx]:+.0f}, federal ${fed_gain[idx]:+.0f})",
            flush=True,
        )

    out = os.path.join(DATA_DIR, f"example_households_{year}.json")
    with open(out, "w") as f:
        json.dump({"year": year, "state_code": "MT", "households": households}, f)
    print("WROTE", out, flush=True)
print("DONE", flush=True)
