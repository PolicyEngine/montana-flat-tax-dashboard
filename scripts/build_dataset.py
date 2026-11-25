"""Slice Montana and its two congressional districts from Populace.

The dashboard runs on the Populace ACS local-area release
(policyengine/populace-us, populace_us_2024_acs_local.h5), a national file
of 1.59M households calibrated to state and congressional district targets.
This script keeps the Montana households (state_fips 30) and splits them by
congressional_district_geoid (3001, 3002), so each pipeline simulates only
Montana. The slices keep the release's calibrated weights unchanged.

Run once per release (on Modal; the national file needs about 100 GB of
memory to load):
    modal run scripts/build_dataset.py
Then, to run the pipelines locally:
    modal volume get mt-flat-tax-data populace .cache/datasets --force

The slicing follows child-poverty-impact-dashboard's
scripts/build_populace_state_slices.py, and runs under the release's own
model version (policyengine-us 2.2.1) so the slices round-trip its bytes.
"""

import os
import sys

import modal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset_config import (  # noqa: E402
    DISTRICT_GEOIDS,
    MT_STATE_FIPS,
    POPULACE_BUILD,
    POPULACE_FILE,
    POPULACE_REPO,
    POPULACE_TAG,
)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "policyengine-us==2.2.1", "numpy>=1.24.0", "pandas>=2.0.0", "huggingface_hub"
    )
    .apt_install("ca-certificates")
    .pip_install("certifi>=2026.10.19", "hf-xet>=1.4.3")
    .add_local_python_source("dataset_config")
)
app = modal.App("mt-flat-tax-build-dataset")
volume = modal.Volume.from_name("mt-flat-tax-data", create_if_missing=True)

GROUP_ENTITIES = ("tax_unit", "spm_unit", "family", "marital_unit")


@app.function(image=image, timeout=7200, memory=131072, cpu=8.0, volumes={"/data": volume})
def build() -> dict:
    import json

    from huggingface_hub import hf_hub_download
    from policyengine_us.data import USSingleYearDataset

    path = hf_hub_download(
        POPULACE_REPO, POPULACE_FILE, repo_type="dataset", revision=POPULACE_BUILD
    )
    ds = USSingleYearDataset(file_path=path)
    if hasattr(ds, "load"):
        ds.load()

    # Bookkeeping columns load as mixed-type objects that HDF refuses to
    # re-save. Bytes are decoded rather than str()-ed so county FIPS codes
    # stay "30049", not "b'30049'".
    def to_str(value):
        return value.decode("utf-8") if isinstance(value, bytes) else str(value)

    for entity in ("household", "person", *GROUP_ENTITIES):
        df = getattr(ds, entity)
        for col in df.columns:
            if df[col].dtype == object:
                if set(df[col].dropna().unique()) <= {True, False}:
                    df[col] = df[col].astype(bool)
                else:
                    df[col] = df[col].map(to_str)

    # parent_1_id and parent_2_id are 0 ("unknown" in policyengine-us) on
    # the ACS records and missing on the ASEC/PUF records. Current
    # policyengine-us refuses missing inputs, so they become 0 too.
    for col in ("parent_1_id", "parent_2_id"):
        if col in ds.person.columns:
            ds.person[col] = ds.person[col].fillna(0).astype("int64")

    households = ds.household
    people = ds.person

    def save(name, keep):
        hh_ids = set(keep["household_id"])
        person = people[people["person_household_id"].isin(hh_ids)]
        frames = {"household": keep, "person": person}
        for g in GROUP_ENTITIES:
            ids = set(person[f"person_{g}_id"].unique())
            frames[g] = getattr(ds, g)[getattr(ds, g)[f"{g}_id"].isin(ids)]
            # Every member of every kept group must be a kept person.
            members = people[people[f"person_{g}_id"].isin(ids)]
            if len(members) != len(person):
                raise ValueError(f"{name}: a {g} straddles the slice boundary")
        out = f"/data/populace/{POPULACE_TAG}/{name}.h5"
        os.makedirs(os.path.dirname(out), exist_ok=True)
        USSingleYearDataset(
            time_period=2024, **{k: v.reset_index(drop=True) for k, v in frames.items()}
        ).save(out)
        w = keep["household_weight"].to_numpy(dtype=float)
        missing = {
            f"{k}.{c}": int(v[c].isna().sum())
            for k, v in frames.items()
            for c in v.columns
            if v[c].isna().any()
        }
        return {
            "columns_with_missing_values": missing,
            "households": len(keep),
            "people": len(person),
            "weighted_households": float(w.sum()),
            # Kish effective sample size over household weights.
            "effective_sample_size": float(w.sum() ** 2 / (w**2).sum()),
            "max_weight": float(w.max()),
            "mb": round(os.path.getsize(out) / 1e6, 1),
        }

    state = households[households["state_fips"] == MT_STATE_FIPS]
    cds = state["congressional_district_geoid"]
    report = {
        "release": POPULACE_BUILD,
        "congressional_district_geoid_counts": {
            str(k): int(v) for k, v in cds.value_counts().items()
        },
        "slices": {"MT": save("MT", state)},
    }
    for district, geoid in DISTRICT_GEOIDS.items():
        report["slices"][district] = save(district, state[cds == geoid])
    in_districts = sum(report["slices"][d]["households"] for d in DISTRICT_GEOIDS)
    if in_districts != len(state):
        raise ValueError(
            f"District slices hold {in_districts} of {len(state)} Montana households"
        )
    with open(f"/data/populace/{POPULACE_TAG}/report.json", "w") as f:
        json.dump(report, f, indent=2)
    volume.commit()
    print(json.dumps(report, indent=2), flush=True)
    return report


@app.local_entrypoint()
def go():
    build.remote()
