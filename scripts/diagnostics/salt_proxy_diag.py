"""Why the Montana proposal shows households that lose.

The federal SALT deduction in policyengine-us does not read a household's
computed Montana tax. It reads state_withheld_income_tax, which for Montana
is mt_withheld_income_tax, an estimate that avoids a circular calculation.
Before policyengine-us 2.153.4 the estimate applied the single-filer rate
schedule to each person's AGI less the single standard deduction cap. From
2.153.4 (PE-US #11197) it applies the tax unit's filing-status schedule and
capital gains rates to its AGI less the federal basic standard deduction.
This script measures, on the repository's Montana dataset and pinned model:

1. who loses, and how the estimate's change compares with the change in
   the Montana tax the model actually computes;
2. a corrected reform run in which the SALT input moves with each tax
   unit's actual change in Montana tax before refundable credits (the
   baseline is untouched);
3. optionally, whether the loser count depends on the order variables are
   calculated (it did on policyengine-us 1.715.2; PE-US #9741 fixed it).

Usage (from the repository root, with scripts/ importable):
    python scripts/diagnostics/salt_proxy_diag.py OUT.json
It is normally run on Modal through modal_salt_proxy_diag.py.
"""

import gc
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from policyengine_us import Microsimulation  # noqa: E402
from reform_def import (  # noqa: E402
    REFORM_DICT,
    YEARS,
    load_dataset,
    make_reform,
)

TU_VARS = [
    "tax_unit_weight",
    "tax_unit_itemizes",
    "state_withheld_income_tax",
    "salt_deduction",
    "mt_income_tax",
    "mt_income_tax_before_refundable_credits_unit",
    "income_tax",
    "taxable_income",
    "adjusted_gross_income",
    "mt_files_separately",
]


def dataset():
    return load_dataset()


def values(sim, var, year, map_to=None):
    if map_to:
        return np.asarray(sim.calculate(var, period=year, map_to=map_to).values)
    return np.asarray(sim.calculate(var, period=year).values)


def wavg(x, w):
    return float(np.average(x, weights=w)) if w.sum() > 0 else float("nan")


def tax_unit_structure(sim, year):
    """Per tax unit: household index, earner count and largest person AGI."""
    tu_ids = values(sim, "tax_unit_id", year)
    hh_ids = values(sim, "household_id", year)
    p_tu = values(sim, "tax_unit_id", year, map_to="person")
    p_hh = values(sim, "household_id", year, map_to="person")
    earn = values(sim, "employment_income", year, map_to="person") + values(
        sim, "self_employment_income", year, map_to="person"
    )
    p_agi = values(sim, "adjusted_gross_income_person", year, map_to="person")

    tu_pos = {t: i for i, t in enumerate(tu_ids)}
    hh_pos = {h: i for i, h in enumerate(hh_ids)}
    n = len(tu_ids)
    earners = np.zeros(n)
    max_agi = np.zeros(n)
    tu_hh = np.full(n, -1)
    for t, h, e, a in zip(p_tu, p_hh, earn, p_agi):
        i = tu_pos[t]
        earners[i] += e > 0
        max_agi[i] = max(max_agi[i], a)
        tu_hh[i] = hh_pos[h]
    return tu_hh, earners, max_agi


def diagnose_year(year):
    t0 = time.time()
    print(f"=== {year} ===", flush=True)
    base = Microsimulation(dataset=dataset())
    ref = Microsimulation(dataset=dataset(), reform=make_reform(REFORM_DICT))

    # Same order as pipeline.py: state tax, federal tax, then net income.
    w_hh = values(base, "household_weight", year, map_to="household")
    hh = {}
    for v in ["mt_income_tax", "income_tax", "household_net_income"]:
        hh[v] = (
            values(base, v, year, map_to="household"),
            values(ref, v, year, map_to="household"),
        )
    chg_hh = hh["household_net_income"][1] - hh["household_net_income"][0]

    tu = {v: (values(base, v, year), values(ref, v, year)) for v in TU_VARS}
    fs = np.asarray(base.calculate("filing_status", period=year).values).astype(str)
    tu_hh, earners, max_agi = tax_unit_structure(base, year)
    w = tu["tax_unit_weight"][0]

    def d(v):
        return tu[v][1] - tu[v][0]

    d_proxy = d("state_withheld_income_tax")
    d_salt = d("salt_deduction")
    d_mt = d("mt_income_tax")
    d_mt_brc = d("mt_income_tax_before_refundable_credits_unit")
    d_fed = d("income_tax")
    tu_chg = -(d_mt + d_fed)
    itemizes = tu["tax_unit_itemizes"][0].astype(bool)

    p = base.tax_benefit_system.parameters(f"{year}-01-01").gov.states.mt.tax.income
    single_top = float(p.main.single.thresholds[1])
    joint_top = float(p.main.joint.thresholds[1])
    actual_rate_unchanged = np.abs(d_mt_brc) < 1

    lose = tu_chg < -1
    lw = w[lose]
    by_status = {
        s: float(w[lose & (fs == s)].sum() / lw.sum()) for s in np.unique(fs[lose])
    }
    joint = fs == "JOINT"
    out = {
        "year": year,
        "thresholds": {
            "single_top_rate_starts": single_top,
            "joint_top_rate_starts": joint_top,
        },
        "households": {
            "total": float(w_hh.sum()),
            "losers_over_1": float(w_hh[chg_hh < -1].sum()),
            "winners_over_1": float(w_hh[chg_hh > 1].sum()),
            "state_revenue_change": float(
                ((hh["mt_income_tax"][1] - hh["mt_income_tax"][0]) * w_hh).sum()
            ),
            "federal_revenue_change": float(
                ((hh["income_tax"][1] - hh["income_tax"][0]) * w_hh).sum()
            ),
        },
        "losing_tax_units": {
            "count": float(lw.sum()),
            "share_itemizing": wavg(itemizes[lose], lw),
            "share_by_filing_status": by_status,
            "share_joint_with_one_earner": float(
                w[lose & joint & (earners <= 1)].sum() / max(w[lose & joint].sum(), 1)
            ),
            "share_actual_mt_tax_before_refundable_unchanged": wavg(
                actual_rate_unchanged[lose], lw
            ),
            "mean_baseline_estimate": wavg(
                tu["state_withheld_income_tax"][0][lose], lw
            ),
            "mean_baseline_actual_mt_tax_before_refundable": wavg(
                tu["mt_income_tax_before_refundable_credits_unit"][0][lose], lw
            ),
            "share_estimate_above_actual": wavg(
                (
                    tu["state_withheld_income_tax"][0]
                    > tu["mt_income_tax_before_refundable_credits_unit"][0] + 1
                )[lose],
                lw,
            ),
            "mean_change_proxy": wavg(d_proxy[lose], lw),
            "mean_change_salt_deduction": wavg(d_salt[lose], lw),
            "mean_change_actual_mt_tax_before_refundable": wavg(d_mt_brc[lose], lw),
            "mean_change_federal_tax": wavg(d_fed[lose], lw),
            "mean_loss": wavg(tu_chg[lose], lw),
            "largest_loss": float(tu_chg[lose].min()) if lose.any() else 0.0,
            "mean_agi": wavg(tu["adjusted_gross_income"][0][lose], lw),
            "mean_baseline_federal_taxable_income": wavg(
                tu["taxable_income"][0][lose], lw
            ),
        },
        "all_itemizers": {
            "count": float(w[itemizes].sum()),
            "sum_change_proxy": float((d_proxy * w)[itemizes].sum()),
            "sum_change_salt_deduction": float((d_salt * w)[itemizes].sum()),
            "sum_change_actual_mt_tax_before_refundable": float(
                (d_mt_brc * w)[itemizes].sum()
            ),
            "sum_change_federal_tax": float((d_fed * w)[itemizes].sum()),
        },
    }

    # Corrected reform run: SALT input = baseline proxy + actual change in
    # Montana tax before refundable credits. Baseline untouched.
    fix = Microsimulation(dataset=dataset(), reform=make_reform(REFORM_DICT))
    fix.set_input(
        "state_withheld_income_tax", year, tu["state_withheld_income_tax"][0] + d_mt_brc
    )
    fx = {
        v: values(fix, v, year, map_to="household")
        for v in ["mt_income_tax", "income_tax", "household_net_income"]
    }
    fix_mt_tu = values(fix, "mt_income_tax", year)
    chg_fix = fx["household_net_income"] - hh["household_net_income"][0]
    out["corrected"] = {
        "max_abs_mt_tax_difference_vs_stock_reform": float(
            np.abs(fix_mt_tu - tu["mt_income_tax"][1]).max()
        ),
        "state_revenue_change": float(
            ((fx["mt_income_tax"] - hh["mt_income_tax"][0]) * w_hh).sum()
        ),
        "federal_revenue_change": float(
            ((fx["income_tax"] - hh["income_tax"][0]) * w_hh).sum()
        ),
        "losers_over_1": float(w_hh[chg_fix < -1].sum()),
        "winners_over_1": float(w_hh[chg_fix > 1].sum()),
        "largest_loss": float(chg_fix.min()),
        "mean_gain_among_winners": wavg(chg_fix[chg_fix > 1], w_hh[chg_fix > 1]),
    }
    # Who still loses in the corrected run, if anyone.
    still = chg_fix < -1
    out["corrected"]["remaining_losers_sample"] = [
        {
            "household_index": int(i),
            "weight": float(w_hh[i]),
            "net_change": float(chg_fix[i]),
            "stock_net_change": float(chg_hh[i]),
        }
        for i in np.argsort(chg_fix)[: min(10, int(still.sum()))]
    ]
    del fix
    gc.collect()
    print(f"  {year} done in {time.time() - t0:.0f}s", flush=True)
    return out


ORDER_VARS = [
    "tax_unit_itemizes",
    "standard_deduction",
    "itemized_taxable_income_deductions",
    "state_withheld_income_tax",
    "salt_deduction",
    "taxable_income",
    "income_tax",
    "mt_files_separately",
    "mt_income_tax_before_refundable_credits_unit",
    "mt_income_tax",
]


def order_test(year):
    """Compute the headline variables in two orders and find what differs."""
    t0 = time.time()
    orders = {
        "taxes_first": ["mt_income_tax", "income_tax", "household_net_income"],
        "net_income_first": ["household_net_income", "mt_income_tax", "income_tax"],
    }
    runs = {}
    for name, order in orders.items():
        sims = {
            "base": Microsimulation(dataset=dataset()),
            "reform": Microsimulation(dataset=dataset(), reform=make_reform(REFORM_DICT)),
        }
        res = {}
        for which, sim in sims.items():
            r = {v: values(sim, v, year, map_to="household") for v in order}
            r["tu"] = {v: values(sim, v, year) for v in ORDER_VARS}
            res[which] = r
        res["w_hh"] = values(sims["base"], "household_weight", year, map_to="household")
        res["w_tu"] = values(sims["base"], "tax_unit_weight", year)
        res["tu_hh"] = tax_unit_structure(sims["base"], year)[0]
        runs[name] = res
        del sims
        gc.collect()

    a, b = runs["taxes_first"], runs["net_income_first"]
    w_hh = a["w_hh"]
    out = {"year": year}
    for name, r in runs.items():
        chg = r["reform"]["household_net_income"] - r["base"]["household_net_income"]
        out[name] = {
            "losers_over_1": float(w_hh[chg < -1].sum()),
            "winners_over_1": float(w_hh[chg > 1].sum()),
            "state_revenue_change": float(
                ((r["reform"]["mt_income_tax"] - r["base"]["mt_income_tax"]) * w_hh).sum()
            ),
            "federal_revenue_change": float(
                ((r["reform"]["income_tax"] - r["base"]["income_tax"]) * w_hh).sum()
            ),
        }
    # Which simulation and which variables differ between orders.
    for which in ("base", "reform"):
        diffs = {}
        for v in ["household_net_income", "mt_income_tax", "income_tax"]:
            dv = np.abs(a[which][v] - b[which][v]) > 0.5
            diffs[f"household:{v}"] = {
                "records": int(dv.sum()),
                "weighted": float(w_hh[dv].sum()),
            }
        for v in ORDER_VARS:
            x, y = a[which]["tu"][v].astype(float), b[which]["tu"][v].astype(float)
            dv = np.abs(x - y) > 0.5
            diffs[f"tax_unit:{v}"] = {
                "records": int(dv.sum()),
                "weighted": float(a["w_tu"][dv].sum()),
            }
        out[f"differences_in_{which}"] = diffs
    # Example tax units whose net income differs, with both orders' values.
    chg_a = a["reform"]["household_net_income"] - a["base"]["household_net_income"]
    chg_b = b["reform"]["household_net_income"] - b["base"]["household_net_income"]
    differ_hh = np.where(np.abs(chg_a - chg_b) > 0.5)[0]
    examples = []
    for h in differ_hh[:8]:
        for t in np.where(a["tu_hh"] == h)[0]:
            row = {"household_index": int(h), "tax_unit_index": int(t)}
            for which in ("base", "reform"):
                for v in ORDER_VARS:
                    row[f"{which}:{v}"] = [
                        float(a[which]["tu"][v][t]),
                        float(b[which]["tu"][v][t]),
                    ]
            examples.append(row)
    out["examples"] = examples
    print(f"  order test done in {time.time() - t0:.0f}s", flush=True)
    return out


def main(out_path, log=print, order=False):
    import importlib.metadata as md

    result = {
        "policyengine_us": md.version("policyengine-us"),
        "years": [],
        "order_test": None,
    }
    for y in YEARS:
        result["years"].append(diagnose_year(y))
        with open(out_path, "w") as f:
            json.dump(result, f, indent=2)
        log(f"wrote {y}")
    if order:
        result["order_test"] = order_test(2029)
        with open(out_path, "w") as f:
            json.dump(result, f, indent=2)
        log("wrote order test")
    return result


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "salt_proxy_diag.json")


CREDIT_VARS = [
    "income_tax_before_refundable_credits",
    "income_tax_refundable_credits",
    "income_tax_non_refundable_credits",
    "ctc_limiting_tax_liability",
    "non_refundable_ctc",
    "refundable_ctc",
    "eitc",
    "income_tax_before_credits",
    "income_tax",
]


def order_credits(year):
    """Which credit variable carries the order effect, in the baseline.

    Three fresh baseline simulations: taxes first (pipeline.py's order),
    net income first, and income_tax alone.
    """
    orders = {
        "taxes_first": ["mt_income_tax", "income_tax", "household_net_income"],
        "net_income_first": ["household_net_income", "mt_income_tax", "income_tax"],
        "income_tax_alone": ["income_tax"],
    }
    vals = {}
    for name, order in orders.items():
        sim = Microsimulation(dataset=dataset())
        for v in order:
            sim.calculate(v, period=year)
        vals[name] = {v: values(sim, v, year).astype(float) for v in CREDIT_VARS}
        if name == "taxes_first":
            w = values(sim, "tax_unit_weight", year)
            kids = values(sim, "ctc_qualifying_children", year)
        del sim
        gc.collect()
    out = {"year": year}
    a, b, c = (vals[k] for k in orders)
    for v in CREDIT_VARS:
        ab = np.abs(a[v] - b[v]) > 0.5
        ac = np.abs(a[v] - c[v]) > 0.5
        bc = np.abs(b[v] - c[v]) > 0.5
        out[v] = {
            "taxes_first_vs_net_income_first": [int(ab.sum()), float(w[ab].sum())],
            "taxes_first_vs_alone": [int(ac.sum()), float(w[ac].sum())],
            "net_income_first_vs_alone": [int(bc.sum()), float(w[bc].sum())],
        }
    differ = np.where(np.abs(a["income_tax"] - b["income_tax"]) > 0.5)[0]
    out["share_with_ctc_children"] = float(
        w[differ][kids[differ] > 0].sum() / max(w[differ].sum(), 1)
    )
    out["examples"] = [
        {
            "tax_unit_index": int(t),
            "ctc_qualifying_children": float(kids[t]),
            **{v: [float(a[v][t]), float(b[v][t]), float(c[v][t])] for v in CREDIT_VARS},
        }
        for t in differ[:6]
    ]
    return out
