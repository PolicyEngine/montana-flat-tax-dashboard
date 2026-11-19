"""Statewide pipeline for the Montana flat income tax dashboard.

Runs current law against the governor's proposal (reform_def.py) on the
Montana state-calibrated dataset for each tax year in YEARS and writes
the data files the frontend reads from ../frontend/public/data/.

Each tax year uses fresh Microsimulation objects. Computing two years on
one simulation object returns $0 Montana tax for the second year (the
carried-forward inputs pick up the first year's monthly cache), so a
simulation is never reused across years.

Three reform simulations run per year so the two provisions can be
reported separately: the full proposal, the rate change alone, and the
EITC increase alone.
"""
import csv
import gc
import importlib.metadata as _md
import json
import os
from datetime import datetime, timezone

import numpy as np
from policyengine_us import Microsimulation

from reform_def import (
    DATA_DIR,
    EITC_REFORM_DICT,
    MT_DATASET,
    RATE_REFORM_DICT,
    REFORM_DICT,
    YEARS,
    make_reform,
)

os.makedirs(DATA_DIR, exist_ok=True)

_INTRA_BOUNDS = [-np.inf, -0.05, -1e-3, 1e-3, 0.05, np.inf]
_INTRA_LABELS = ["lose_more_5pct", "lose_less_5pct", "no_change",
                 "gain_less_5pct", "gain_more_5pct"]
INCOME_BRACKETS = [
    (-float("inf"), 25_000, "$0 - $25k"), (25_000, 50_000, "$25k - $50k"),
    (50_000, 75_000, "$50k - $75k"), (75_000, 100_000, "$75k - $100k"),
    (100_000, 150_000, "$100k - $150k"), (150_000, 200_000, "$150k - $200k"),
    (200_000, float("inf"), "$200k+"),
]


def hh(sim, var, year):
    return np.array(sim.calculate(var, period=year, map_to="household"))


def person(sim, var, year):
    return np.array(sim.calculate(var, period=year, map_to="person"))


def run_year(year):
    """Return (metrics dict, decile rows, winners/losers rows, bracket rows)."""
    print(f"=== {year} ===", flush=True)
    base = Microsimulation(dataset=MT_DATASET)
    ref = Microsimulation(dataset=MT_DATASET, reform=make_reform(REFORM_DICT))

    w = hh(base, "household_weight", year)
    total_hh = float(w.sum())

    mt_b = hh(base, "mt_income_tax", year)
    mt_r = hh(ref, "mt_income_tax", year)
    state_rev = float(((mt_r - mt_b) * w).sum())  # negative = revenue loss
    fed_b = hh(base, "income_tax", year)
    fed_r = hh(ref, "income_tax", year)
    fed_rev = float(((fed_r - fed_b) * w).sum())

    # Provision split: each provision alone against current law.
    rate_sim = Microsimulation(dataset=MT_DATASET, reform=make_reform(RATE_REFORM_DICT))
    rate_rev = float(((hh(rate_sim, "mt_income_tax", year) - mt_b) * w).sum())
    del rate_sim
    gc.collect()
    eitc_sim = Microsimulation(dataset=MT_DATASET, reform=make_reform(EITC_REFORM_DICT))
    eitc_rev = float(((hh(eitc_sim, "mt_income_tax", year) - mt_b) * w).sum())
    del eitc_sim
    gc.collect()

    nb = hh(base, "household_net_income", year)
    nr = hh(ref, "household_net_income", year)
    chg = nr - nb

    ben = chg > 0
    beneficiaries = float(w[ben].sum())
    avg_benefit = float((chg[ben] * w[ben]).sum() / beneficiaries) if beneficiaries > 0 else 0.0
    winners = float(w[chg > 1].sum())
    losers = float(w[chg < -1].sum())

    # Poverty (person-weighted, SPM). change = reform - baseline.
    pw = person(base, "person_weight", year)
    age = person(base, "age", year)
    is_child = age < 18

    def rate(sim, var, mask=None):
        v = person(sim, var, year)
        m = np.ones_like(pw, dtype=bool) if mask is None else mask
        tot = pw[m].sum()
        return float((v[m] * pw[m]).sum() / tot * 100) if tot > 0 else 0.0

    pov_b, pov_r = rate(base, "in_poverty"), rate(ref, "in_poverty")
    cpov_b, cpov_r = rate(base, "in_poverty", is_child), rate(ref, "in_poverty", is_child)
    dpov_b, dpov_r = rate(base, "in_deep_poverty"), rate(ref, "in_deep_poverty")
    dcpov_b, dcpov_r = (rate(base, "in_deep_poverty", is_child),
                        rate(ref, "in_deep_poverty", is_child))

    def pct(reform_rate, base_rate):
        return (reform_rate - base_rate) / base_rate * 100 if base_rate > 0 else 0.0

    m = {
        "budgetary_impact": state_rev,  # Montana state fiscal cost
        "state_tax_revenue_impact": state_rev,
        "rate_cut_state_revenue_impact": rate_rev,
        "eitc_state_revenue_impact": eitc_rev,
        "federal_tax_revenue_impact": fed_rev,
        "tax_revenue_impact": state_rev + fed_rev,
        "baseline_state_income_tax": float((mt_b * w).sum()),
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
        "child_poverty_rate_change": cpov_r - cpov_b,
        "child_poverty_percent_change": pct(cpov_r, cpov_b),
        "deep_poverty_baseline_rate": dpov_b, "deep_poverty_reform_rate": dpov_r,
        "deep_poverty_rate_change": dpov_r - dpov_b,
        "deep_poverty_percent_change": pct(dpov_r, dpov_b),
        "deep_child_poverty_baseline_rate": dcpov_b, "deep_child_poverty_reform_rate": dcpov_r,
        "deep_child_poverty_rate_change": dcpov_r - dcpov_b,
        "deep_child_poverty_percent_change": pct(dcpov_r, dcpov_b),
    }

    # Deciles
    dist_rows = []
    dec = hh(base, "household_income_decile", year)
    for d in range(1, 11):
        dm = dec == d
        dw = w[dm]
        dc = dw.sum()
        avg = (chg[dm] * dw).sum() / dc if dc > 0 else 0.0
        rel = (chg[dm] * dw).sum() / max((nb[dm] * dw).sum(), 1) if dc > 0 else 0.0
        dist_rows.append([year, d, round(float(avg), 2), round(float(rel), 6)])

    # Winners/losers within deciles (person-weighted)
    ppl = hh(base, "household_count_people", year)
    pweight = ppl * w
    rel_chg = chg / np.maximum(nb, 1)

    def wl_for(mask):
        tot = pweight[mask].sum()
        out = {}
        for lo, hi, lab in zip(_INTRA_BOUNDS[:-1], _INTRA_BOUNDS[1:], _INTRA_LABELS):
            ing = (rel_chg[mask] > lo) & (rel_chg[mask] <= hi)
            out[lab] = float(pweight[mask][ing].sum() / tot) if tot > 0 else 0.0
        return out

    header_order = ["gain_more_5pct", "gain_less_5pct", "no_change",
                    "lose_less_5pct", "lose_more_5pct"]
    wl_rows = []
    allwl = wl_for(np.ones_like(w, dtype=bool))
    wl_rows.append([year, "All"] + [allwl[k] for k in header_order])
    for d in range(1, 11):
        dwl = wl_for(dec == d)
        wl_rows.append([year, d] + [dwl[k] for k in header_order])

    # Income brackets: households grouped by federal AGI; counts are
    # households whose net income rises.
    bracket_rows = []
    agi = hh(base, "adjusted_gross_income", year)
    for lo, hi, lab in INCOME_BRACKETS:
        mask = (agi >= lo) & (agi < hi) & ben
        bcount = float(w[mask].sum())
        bcost = float((chg[mask] * w[mask]).sum()) if bcount > 0 else 0.0
        bavg = float(np.average(chg[mask], weights=w[mask])) if bcount > 0 else 0.0
        bracket_rows.append([year, lab, bcount, bcost, bavg])

    print(
        f"  state={state_rev/1e6:.1f}M (rates {rate_rev/1e6:.1f}M, eitc {eitc_rev/1e6:.1f}M) "
        f"fed={fed_rev/1e6:.1f}M winners={m['winners_rate']:.1f}% losers={m['losers_rate']:.1f}% "
        f"poverty {pov_b:.2f}->{pov_r:.2f} child {cpov_b:.2f}->{cpov_r:.2f} "
        f"deep {dpov_b:.2f}->{dpov_r:.2f}",
        flush=True,
    )
    del base, ref
    gc.collect()
    return m, dist_rows, wl_rows, bracket_rows


metrics_rows, dist_rows, wl_rows, bracket_rows, runs = [], [], [], [], []
for year in YEARS:
    m, d, wl, b = run_year(year)
    metrics_rows += [[year, k, v] for k, v in m.items()]
    dist_rows += d
    wl_rows += wl
    bracket_rows += b
    runs.append({
        "year": year,
        "state_revenue_impact": m["state_tax_revenue_impact"],
        "rate_cut_state_revenue_impact": m["rate_cut_state_revenue_impact"],
        "eitc_state_revenue_impact": m["eitc_state_revenue_impact"],
        "baseline_state_income_tax": m["baseline_state_income_tax"],
        "poverty_percent_change": m["poverty_percent_change"],
        "child_poverty_percent_change": m["child_poverty_percent_change"],
    })


def write_csv(name, header, rows):
    with open(os.path.join(DATA_DIR, name), "w", newline="") as f:
        wtr = csv.writer(f)
        wtr.writerow(header)
        wtr.writerows(rows)


write_csv("metrics.csv", ["year", "metric", "value"], metrics_rows)
write_csv("distributional_impact.csv",
          ["year", "decile", "average_change", "relative_change"], dist_rows)
write_csv("winners_losers.csv",
          ["year", "decile", "gain_more_5pct", "gain_less_5pct", "no_change",
           "lose_less_5pct", "lose_more_5pct"], wl_rows)
write_csv("income_brackets.csv",
          ["year", "bracket", "beneficiaries", "total_cost", "avg_benefit"], bracket_rows)

# Pinned runs for the Validation tab. Amounts are Montana's own income
# tax revenue change (negative = revenue loss). The external figures the
# tab compares against live in frontend/lib/montana.ts.
validation = {
    "schema_version": 4,
    "runs": runs,
    "provenance": {
        "policyengine_us": _md.version("policyengine-us"),
        "dataset": MT_DATASET,
        "reform": REFORM_DICT,
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
    },
}
with open(os.path.join(DATA_DIR, "validation.json"), "w") as f:
    json.dump(validation, f, indent=2)

print("WROTE:", sorted(os.listdir(DATA_DIR)), flush=True)
print("DONE", flush=True)
