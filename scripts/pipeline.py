"""Montana flat 4.7% income tax (TY2028+) aggregate pipeline.

Runs baseline (current law: 4.7% / 5.4% two-rate schedule under HB 337) vs
reform (flat 4.7%) on the MT state-calibrated dataset and writes EDAA-schema
data files into ../frontend/public/data/.
"""
import csv
import json
import os
import numpy as np
from datetime import datetime, timezone
from policyengine_us import Microsimulation
from policyengine_core.reforms import Reform

MT_DATASET = "hf://policyengine/policyengine-us-data/states/MT.h5"
# MT.h5 is a single-year (2028) state-calibrated build: income variables are
# populated only for its 2028 target year, so mt_income_tax computes to $0 in
# later years. Only 2028 (the reform's first effective year, matching the DOR
# FY2029 anchor) is valid.
YEARS = [2028]
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data")
os.makedirs(OUT, exist_ok=True)

REFORM_DICT = {}
for fs in ["single", "joint", "head_of_household", "separate", "surviving_spouse"]:
    for b in (0, 1):
        REFORM_DICT[f"gov.states.mt.tax.income.main.{fs}[{b}].rate"] = {
            "2028-01-01.2100-12-31": 0.047
        }

_INTRA_BOUNDS = [-np.inf, -0.05, -1e-3, 1e-3, 0.05, np.inf]
_INTRA_LABELS = ["lose_more_5pct", "lose_less_5pct", "no_change",
                 "gain_less_5pct", "gain_more_5pct"]
INCOME_BRACKETS = [
    (0, 25_000, "$0 - $25k"), (25_000, 50_000, "$25k - $50k"),
    (50_000, 75_000, "$50k - $75k"), (75_000, 100_000, "$75k - $100k"),
    (100_000, 150_000, "$100k - $150k"), (150_000, 200_000, "$150k - $200k"),
    (200_000, float("inf"), "$200k+"),
]

print("Building baseline (current law) on MT.h5...", flush=True)
base = Microsimulation(dataset=MT_DATASET)
print("Building reform (flat 4.7%) on MT.h5...", flush=True)
reform = Reform.from_dict(REFORM_DICT, country_id="us")
ref = Microsimulation(dataset=MT_DATASET, reform=reform)

def hh(sim, var, year):
    return np.array(sim.calculate(var, period=year, map_to="household"))

def person(sim, var, year):
    return np.array(sim.calculate(var, period=year, map_to="person"))

metrics_rows = []
dist_rows = []
wl_rows = []
bracket_rows = []
val_pinned = None

for year in YEARS:
    print(f"=== {year} ===", flush=True)
    w = hh(base, "household_weight", year)
    total_hh = float(w.sum())

    mt_b = hh(base, "mt_income_tax", year)
    mt_r = hh(ref, "mt_income_tax", year)
    state_rev = float(((mt_r - mt_b) * w).sum())          # negative = revenue loss
    fed_b = hh(base, "income_tax", year)
    fed_r = hh(ref, "income_tax", year)
    fed_rev = float(((fed_r - fed_b) * w).sum())
    tax_rev = state_rev + fed_rev

    nb = hh(base, "household_net_income", year)
    nr = hh(ref, "household_net_income", year)
    chg = nr - nb

    ben = chg > 0
    beneficiaries = float(w[ben].sum())
    avg_benefit = float((chg[ben] * w[ben]).sum() / beneficiaries) if beneficiaries > 0 else 0.0
    winners = float(w[chg > 1].sum())
    losers = float(w[chg < -1].sum())

    # Poverty (person-weighted). change = reform - baseline (negative = falls).
    def prate(sim, var):
        v = person(sim, var, year)
        pw = person(sim, "person_weight", year)
        return float((v * pw).sum() / pw.sum() * 100)
    age = person(base, "age", year)
    pw = person(base, "person_weight", year)
    is_child = age < 18
    cw = pw[is_child]; tcw = cw.sum()
    def crate(sim, var):
        v = person(sim, var, year)
        return float((v[is_child] * cw).sum() / tcw * 100) if tcw > 0 else 0.0

    pov_b = prate(base, "in_poverty"); pov_r = prate(ref, "in_poverty")
    cpov_b = crate(base, "in_poverty"); cpov_r = crate(ref, "in_poverty")
    dpov_b = prate(base, "in_deep_poverty"); dpov_r = prate(ref, "in_deep_poverty")
    dcpov_b = crate(base, "in_deep_poverty"); dcpov_r = crate(ref, "in_deep_poverty")

    def pct(reform_rate, base_rate):
        return (reform_rate - base_rate) / base_rate * 100 if base_rate > 0 else 0.0

    m = {
        "budgetary_impact": state_rev,             # Montana state fiscal cost
        "state_tax_revenue_impact": state_rev,
        "federal_tax_revenue_impact": fed_rev,
        "tax_revenue_impact": tax_rev,
        "households": total_hh,
        "total_cost": -state_rev,
        "beneficiaries": beneficiaries,
        "avg_benefit": avg_benefit,
        "winners": winners,
        "losers": losers,
        "winners_rate": winners / total_hh * 100 if total_hh else 0.0,
        "losers_rate": losers / total_hh * 100 if total_hh else 0.0,
        "poverty_baseline_rate": pov_b, "poverty_reform_rate": pov_r,
        "poverty_rate_change": pov_r - pov_b, "poverty_percent_change": pct(pov_r, pov_b),
        "child_poverty_baseline_rate": cpov_b, "child_poverty_reform_rate": cpov_r,
        "child_poverty_rate_change": cpov_r - cpov_b, "child_poverty_percent_change": pct(cpov_r, cpov_b),
        "deep_poverty_baseline_rate": dpov_b, "deep_poverty_reform_rate": dpov_r,
        "deep_poverty_rate_change": dpov_r - dpov_b, "deep_poverty_percent_change": pct(dpov_r, dpov_b),
        "deep_child_poverty_baseline_rate": dcpov_b, "deep_child_poverty_reform_rate": dcpov_r,
        "deep_child_poverty_rate_change": dcpov_r - dcpov_b, "deep_child_poverty_percent_change": pct(dcpov_r, dcpov_b),
    }
    for k, v in m.items():
        metrics_rows.append([year, k, v])

    # Deciles
    dec = hh(base, "household_income_decile", year)
    for d in range(1, 11):
        dm = dec == d
        dw = w[dm]; dc = dw.sum()
        avg = (chg[dm] * dw).sum() / dc if dc > 0 else 0.0
        rel = (chg[dm] * dw).sum() / max((nb[dm] * dw).sum(), 1) if dc > 0 else 0.0
        dist_rows.append([year, d, round(float(avg), 2), round(float(rel), 6)])

    # Winners/losers intra-decile (person-weighted)
    ppl = hh(base, "household_count_people", year)
    pweight = ppl * w
    capped = np.maximum(nb, 1)
    rel_chg = chg / capped
    def wl_for(mask):
        tot = pweight[mask].sum()
        out = {}
        for lo, hi, lab in zip(_INTRA_BOUNDS[:-1], _INTRA_BOUNDS[1:], _INTRA_LABELS):
            ing = (rel_chg[mask] > lo) & (rel_chg[mask] <= hi)
            out[lab] = float(pweight[mask][ing].sum() / tot) if tot > 0 else 0.0
        return out
    allwl = wl_for(np.ones_like(w, dtype=bool))
    wl_rows.append([year, "All"] + [allwl[l] for l in _INTRA_LABELS])
    for d in range(1, 11):
        dwl = wl_for(dec == d)
        wl_rows.append([year, d] + [dwl[l] for l in _INTRA_LABELS])

    # Income brackets (by AGI)
    agi = hh(base, "adjusted_gross_income", year)
    for lo, hi, lab in INCOME_BRACKETS:
        mask = (agi >= lo) & (agi < hi) & ben
        bcount = float(w[mask].sum())
        bcost = float((chg[mask] * w[mask]).sum()) if bcount > 0 else 0.0
        bavg = float(np.average(chg[mask], weights=w[mask])) if bcount > 0 else 0.0
        bracket_rows.append([year, lab, bcount, bcost, bavg])

    print(f"  state_rev={state_rev/1e6:.1f}M fed={fed_rev/1e6:.1f}M winners={m['winners_rate']:.1f}%", flush=True)
    if year == 2028:
        val_pinned = m

# ---- write files ----
with open(os.path.join(OUT, "metrics.csv"), "w", newline="") as f:
    wtr = csv.writer(f); wtr.writerow(["year", "metric", "value"]); wtr.writerows(metrics_rows)
with open(os.path.join(OUT, "distributional_impact.csv"), "w", newline="") as f:
    wtr = csv.writer(f); wtr.writerow(["year", "decile", "average_change", "relative_change"]); wtr.writerows(dist_rows)
with open(os.path.join(OUT, "winners_losers.csv"), "w", newline="") as f:
    wtr = csv.writer(f); wtr.writerow(["year", "decile", "gain_more_5pct", "gain_less_5pct", "no_change", "lose_less_5pct", "lose_more_5pct"])
    # reorder allwl labels to header order
    for r in wl_rows:
        y, d, lose_more, lose_less, no_ch, gain_less, gain_more = r
        wtr.writerow([y, d, gain_more, gain_less, no_ch, lose_less, lose_more])
with open(os.path.join(OUT, "income_brackets.csv"), "w", newline="") as f:
    wtr = csv.writer(f); wtr.writerow(["year", "bracket", "beneficiaries", "total_cost", "avg_benefit"]); wtr.writerows(bracket_rows)

import importlib.metadata as _md
validation = {
    "schema_version": 3,
    "pinned_run": {
        "label": "This dashboard (Montana flat 4.7%, state-calibrated MT.h5 run)",
        "year": 2028,
        # negative = revenue loss (matches ValidationTab sign convention)
        "net_cost": val_pinned["state_tax_revenue_impact"],
        "poverty_percent_change": val_pinned["poverty_percent_change"],
        "child_poverty_percent_change": val_pinned["child_poverty_percent_change"],
        "deep_poverty_percent_change": val_pinned["deep_poverty_percent_change"],
        "deep_child_poverty_percent_change": val_pinned["deep_child_poverty_percent_change"],
        "dataset": "policyengine-us-data states/MT.h5 (state-calibrated)",
    },
    "expected_band": {
        "label": "Montana Department of Revenue (2029 Biennium Outlook Report, June 2026)",
        "net_cost": -130_000_000,  # negative = revenue loss; FY2029 ~ TY2028
        "source": "Montana Department of Revenue (2029 Biennium Outlook Report, June 2026)",
    },
    "provenance": {
        "policyengine_us": _md.version("policyengine-us"),
        "dataset": MT_DATASET,
        "reform": REFORM_DICT,
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
    },
}
with open(os.path.join(OUT, "validation.json"), "w") as f:
    json.dump(validation, f, indent=2)

print("WROTE:", os.listdir(OUT), flush=True)
print("DONE", flush=True)
