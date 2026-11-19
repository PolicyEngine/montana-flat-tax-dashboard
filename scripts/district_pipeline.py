"""Montana flat 4.7% income tax — per-district impact (MT-01, MT-02), TY2028.

Writes congressional_districts.csv in the dashboard's schema.
"""
import csv, os
import numpy as np
from policyengine_us import Microsimulation
from policyengine_core.reforms import Reform

YEAR = 2028
DISTRICTS = ["MT-01", "MT-02"]
OUT = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data", "congressional_districts.csv")

RD = {}
for fs in ["single", "joint", "head_of_household", "separate", "surviving_spouse"]:
    for b in (0, 1):
        RD[f"gov.states.mt.tax.income.main.{fs}[{b}].rate"] = {"2028-01-01.2100-12-31": 0.047}
reform = Reform.from_dict(RD, country_id="us")

rows = []
for did in DISTRICTS:
    url = f"hf://policyengine/policyengine-us-data/districts/{did}.h5"
    print(f"=== {did} ===", flush=True)
    base = Microsimulation(dataset=url)
    ref = Microsimulation(dataset=url, reform=reform)

    w = np.array(base.calculate("household_weight", period=YEAR))
    nb = np.array(base.calculate("household_net_income", period=YEAR, map_to="household"))
    nr = np.array(ref.calculate("household_net_income", period=YEAR, map_to="household"))
    chg = nr - nb
    total_w = w.sum()

    avg_change = float((chg * w).sum() / total_w) if total_w else 0.0
    rel_change = float((chg * w).sum() / max((nb * w).sum(), 1))
    winners_share = float(w[chg > 1].sum() / total_w) if total_w else 0.0
    losers_share = float(w[chg < -1].sum() / total_w) if total_w else 0.0

    def pov_pct(var):
        pb = np.array(base.calculate(var, period=YEAR, map_to="person"))
        pr = np.array(ref.calculate(var, period=YEAR, map_to="person"))
        pw = np.array(base.calculate("person_weight", period=YEAR))
        rb = (pb * pw).sum() / pw.sum()
        rr = (pr * pw).sum() / pw.sum()
        return float((rr - rb) / rb * 100) if rb > 0 else 0.0

    def child_pov_pct():
        age = np.array(base.calculate("age", period=YEAR))
        pw = np.array(base.calculate("person_weight", period=YEAR))
        ic = age < 18
        cw = pw[ic]; tcw = cw.sum()
        pb = np.array(base.calculate("in_poverty", period=YEAR, map_to="person"))[ic]
        pr = np.array(ref.calculate("in_poverty", period=YEAR, map_to="person"))[ic]
        rb = (pb * cw).sum() / tcw; rr = (pr * cw).sum() / tcw
        return float((rr - rb) / rb * 100) if rb > 0 else 0.0

    pov = pov_pct("in_poverty")
    cpov = child_pov_pct()
    rows.append([did, round(avg_change, 2), round(rel_change, 6),
                 round(winners_share, 4), round(losers_share, 4),
                 round(pov, 2), round(cpov, 2), "MT", YEAR])
    print(f"  avg=${avg_change:.2f} winners={winners_share:.1%} losers={losers_share:.1%} pov={pov:+.2f}%", flush=True)

with open(OUT, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["district", "average_household_income_change", "relative_household_income_change",
                "winners_share", "losers_share", "poverty_pct_change", "child_poverty_pct_change",
                "state", "year"])
    w.writerows(rows)
print("WROTE", OUT, flush=True)
print("DONE", flush=True)
