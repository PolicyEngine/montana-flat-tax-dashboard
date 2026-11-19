"""Precompute Montana example households for the household-impact tab.

Builds synthetic Montana households, sweeps employment income (PE axes),
and computes baseline (current law) vs flat-4.7% reform for tax year 2028.
Writes frontend/public/data/example_households.json in the schema the
ExampleHouseholds component expects.
"""
import json, os
import numpy as np
from policyengine_us import Simulation
from policyengine_core.reforms import Reform

YEAR = 2028
XMAX = 400_000
NPTS = 81  # 0..400k step 5k
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data", "example_households.json")

RD = {}
for fs in ["single", "joint", "head_of_household", "separate", "surviving_spouse"]:
    for b in (0, 1):
        RD[f"gov.states.mt.tax.income.main.{fs}[{b}].rate"] = {"2028-01-01.2100-12-31": 0.047}
reform = Reform.from_dict(RD, country_id="us")

# label, employment_income, age_head, married, dependent ages
PROFILES = [
    ("Single, no children, $40k", 40_000, 35, False, []),
    ("Single, no children, $90k", 90_000, 40, False, []),
    ("Head of household, 1 child, $70k", 70_000, 38, False, [8]),
    ("Married, 2 children, $150k", 150_000, 42, True, [10, 7]),
    ("Married, no children, $300k", 300_000, 50, True, []),
    ("Single retiree, $50k", 50_000, 68, False, []),
]


def build_situation(income, age_head, married, dep_ages, with_axis):
    people = {"head": {"age": {YEAR: age_head}, "employment_income": {YEAR: income}}}
    members = ["head"]
    if married:
        people["spouse"] = {"age": {YEAR: age_head}, "employment_income": {YEAR: 0}}
        members.append("spouse")
    for i, a in enumerate(dep_ages):
        k = f"child{i}"
        people[k] = {"age": {YEAR: a}, "employment_income": {YEAR: 0}}
        members.append(k)
    sit = {
        "people": people,
        "families": {"family": {"members": members}},
        "marital_units": {"mu": {"members": ["head", "spouse"] if married else ["head"]}},
        "tax_units": {"tu": {"members": members}},
        "spm_units": {"spm": {"members": members}},
        "households": {"hh": {"members": members, "state_name": {YEAR: "MT"}}},
    }
    if with_axis:
        sit["axes"] = [[{"name": "employment_income", "count": NPTS, "min": 0, "max": XMAX, "period": YEAR}]]
    return sit


def arr(sim, var):
    return np.array(sim.calculate(var, YEAR))


households = []
for label, income, age, married, deps in PROFILES:
    # --- sweep (axis on head employment_income) ---
    sit = build_situation(income, age, married, deps, with_axis=True)
    b = Simulation(situation=sit)
    r = Simulation(situation=sit, reform=reform)
    xs = np.linspace(0, XMAX, NPTS)
    nb = arr(b, "household_net_income"); nr = arr(r, "household_net_income")
    sb = arr(b, "mt_income_tax"); sr = arr(r, "mt_income_tax")
    fb = arr(b, "income_tax"); fr = arr(r, "income_tax")
    net_chg = (nr - nb)
    state_chg = (sr - sb)
    fed_chg = (fr - fb)

    # --- point at the household's actual income (nearest sweep index) ---
    idx = int(np.argmin(np.abs(xs - income)))
    households.append({
        "label": label,
        "income": income,
        "age_head": age,
        "married": married,
        "dependents": deps,
        "baseline": {
            "household_net_income": float(nb[idx]),
            "state_income_tax": float(sb[idx]),
            "income_tax": float(fb[idx]),
        },
        "reform": {
            "household_net_income": float(nr[idx]),
            "state_income_tax": float(sr[idx]),
            "income_tax": float(fr[idx]),
        },
        "net_income_change": float(net_chg[idx]),
        "federal_tax_change": float(fed_chg[idx]),
        "chart": {
            "income_range": [float(x) for x in xs],
            "net_income_change": [float(v) for v in net_chg],
            "state_tax_change": [float(v) for v in state_chg],
            "federal_tax_change": [float(v) for v in fed_chg],
        },
    })
    print(f"{label}: net change at ${income:,} = ${net_chg[idx]:+.0f} (state ${state_chg[idx]:+.0f})", flush=True)

payload = {"year": YEAR, "state_code": "MT", "households": households}
with open(OUT, "w") as f:
    json.dump(payload, f)
print("WROTE", OUT, flush=True)
print("DONE", flush=True)
