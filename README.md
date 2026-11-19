# Montana flat income tax dashboard

Household, statewide, and congressional district impacts of the income tax
proposals in Gov. Greg Gianforte's 2029 biennium executive budget (released
November 16, 2026).

Live: https://montana-flat-tax-dashboard.vercel.app/us/montana-flat-tax-dashboard

## The reform

| Provision | Current law | Tax year 2028 | Tax year 2029 onward |
| --- | --- | --- | --- |
| Top income tax rate | 5.4% | 5.0% | 4.7% (equal to the lower rate, so one flat rate) |
| Montana EITC, share of the federal credit | 20% | 30% | 30% |

Source: [Governor's Executive Budget, Section R, pages REF-7 and REF-8](https://gov.mt.gov/_docs/budget_budget2029/OBPPREF.pdf#page=7).

The budget does not name the first tax year for the higher EITC match. It
counts the cost from fiscal year 2029, when tax year 2028 returns are filed,
so the dashboard applies the 30% match from tax year 2028.

`reform.json` is the canonical parameter set. The Python pipelines load it
directly. `frontend/lib/montana.ts` mirrors it for the live household
calculator, and `frontend/__tests__/reform.test.ts` fails if the two differ.

## Repository layout

```
reform.json                  canonical reform (PolicyEngine parameter changes)
requirements.txt             pinned Python environment for the pipelines
requirements.lock.txt        full resolved environment
scripts/
  reform_def.py              loads reform.json; shared years and dataset paths
  pipeline.py                statewide results by tax year and provision
  district_pipeline.py       MT-01 and MT-02 results
  compute_example_households.py   precomputed example households
frontend/                    Next.js app (deployed to Vercel)
  public/data/               pipeline outputs the app reads
```

## Regenerating the data

```
make install   # creates .venv from requirements.txt and installs the frontend
make data      # runs the three pipelines; rewrites frontend/public/data/
```

Each pipeline runs current law against the reform for tax years 2028 and
2029 and writes CSV or JSON into `frontend/public/data/`. The statewide
pipeline also runs each provision alone so the dashboard can report the rate
change and the EITC increase separately.

### Data and model version

- Dataset: `hf://policyengine/policyengine-us-data/states/MT.h5` and
  `districts/MT-01.h5`, `districts/MT-02.h5`. These are calibrated to Montana.
  They were built on May 20, 2026 and that data repository has not changed
  since May 31, 2026.
- Model: `policyengine-us==1.715.2`, the nearest release to the dataset build
  (1.700.x) that PyPI still publishes. It reads all 197 fields in the dataset.
  Older and newer releases read some income fields differently and give
  different totals, so do not change the pin without checking the baseline
  aggregates.
- Each tax year uses fresh `Microsimulation` objects. Computing two years on
  one simulation object returns $0 Montana tax for the second year.

### Known limits

- Estimates are static: no behavioral responses.
- The dataset is calibrated mainly to tax and demographic targets. Its poverty
  rates can differ from Census Bureau estimates, and poverty changes rest on a
  small number of sampled households.
- About 3% of households show a small loss. The model estimates the federal
  deduction for state and local taxes from an approximation of state income
  tax withheld on wages. For those households the approximation falls while
  their computed Montana tax does not, so their modeled federal tax rises.
- The household calculator calls the public PolicyEngine API
  (`api.policyengine.org`), which runs the current model version rather than
  the pinned one. The example households are precomputed with the pinned
  version and do not need the API.

## Frontend

```
cd frontend
npm ci
npm run dev     # http://localhost:3010/us/montana-flat-tax-dashboard
npm test
npm run build
```

Set `NEXT_PUBLIC_BASE_PATH=""` to serve from `/` in local development.

## Deployment

The Vercel project `montana-flat-tax-dashboard` (team `policy-engine`) builds
from this repository with `frontend` as its root directory. Merges to `main`
deploy to production; pull requests get preview deployments.
