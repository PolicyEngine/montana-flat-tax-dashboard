"""Where the dashboard's Montana microdata comes from.

The Populace ACS local-area release (policyengine/populace-us). Pinned to a
build tag so the slices, and the results, do not move when a newer build
becomes current. scripts/build_dataset.py slices Montana and its two
congressional districts from it.
"""

POPULACE_REPO = "policyengine/populace-us"
POPULACE_FILE = "populace_us_2024_acs_local.h5"
POPULACE_BUILD = "populace-us-2024-buildo-acs-local-766b7c7-20261017T030317Z"
POPULACE_TAG = "766b7c7"
MT_STATE_FIPS = 30
DISTRICT_GEOIDS = {"MT-01": 3001, "MT-02": 3002}
