"""Congressional district pipeline (MT-01, MT-02) for each tax year.

Writes frontend/public/data/congressional_districts.csv. As in
pipeline.py, every tax year uses fresh Microsimulation objects.
"""
import csv
import gc
import os

import numpy as np
from policyengine_us import Microsimulation

from reform_def import (
    DATA_DIR,
    DISTRICT_DATASET,
    DISTRICTS,
    REFORM_DICT,
    YEARS,
    load_dataset,
    make_reform,
)

OUT = os.path.join(DATA_DIR, "congressional_districts.csv")


def run(district, year):
    path = load_dataset(DISTRICT_DATASET.format(district=district))
    base = Microsimulation(dataset=path)
    ref = Microsimulation(dataset=path, reform=make_reform(REFORM_DICT))

    w = np.array(base.calculate("household_weight", period=year))
    nb = np.array(base.calculate("household_net_income", period=year, map_to="household"))
    nr = np.array(ref.calculate("household_net_income", period=year, map_to="household"))
    chg = nr - nb
    total_w = w.sum()

    avg_change = float((chg * w).sum() / total_w) if total_w else 0.0
    rel_change = float((chg * w).sum() / max((nb * w).sum(), 1))
    winners_share = float(w[chg > 1].sum() / total_w) if total_w else 0.0
    losers_share = float(w[chg < -1].sum() / total_w) if total_w else 0.0

    pw = np.array(base.calculate("person_weight", period=year))
    age = np.array(base.calculate("age", period=year))
    pb = np.array(base.calculate("in_poverty", period=year, map_to="person"))
    pr = np.array(ref.calculate("in_poverty", period=year, map_to="person"))

    def pct_change(mask):
        rb = (pb[mask] * pw[mask]).sum() / pw[mask].sum()
        rr = (pr[mask] * pw[mask]).sum() / pw[mask].sum()
        return float((rr - rb) / rb * 100) if rb > 0 else 0.0

    pov = pct_change(np.ones_like(pw, dtype=bool))
    cpov = pct_change(age < 18)
    print(
        f"  {district} {year}: avg=${avg_change:.2f} winners={winners_share:.1%} "
        f"losers={losers_share:.1%} poverty={pov:+.2f}% child={cpov:+.2f}%",
        flush=True,
    )
    del base, ref
    gc.collect()
    return [district, round(avg_change, 2), round(rel_change, 6),
            round(winners_share, 4), round(losers_share, 4),
            round(pov, 2), round(cpov, 2), "MT", year]


rows = [run(d, y) for y in YEARS for d in DISTRICTS]

with open(OUT, "w", newline="") as f:
    wtr = csv.writer(f)
    wtr.writerow(["district", "average_household_income_change",
                  "relative_household_income_change", "winners_share", "losers_share",
                  "poverty_pct_change", "child_poverty_pct_change", "state", "year"])
    wtr.writerows(rows)
print("WROTE", OUT, flush=True)
print("DONE", flush=True)
