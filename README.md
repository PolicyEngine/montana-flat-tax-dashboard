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
  reform_def.py              loads reform.json; shared years; dataset loading
  dataset_config.py          Populace release and Montana geography
  build_dataset.py           slices Montana and its districts from Populace
  pipeline.py                statewide results by tax year and provision
  district_pipeline.py       MT-01 and MT-02 results
  compute_example_households.py   precomputed example households
  modal_data.py              runs the three pipelines on Modal
  diagnostics/               pin check and losers investigation, with results
frontend/                    Next.js app (deployed to Vercel)
  public/data/               pipeline outputs the app reads
```

## Regenerating the data

```
make install   # creates .venv from requirements.txt and installs the frontend
make dataset   # downloads the Montana slices (needs Modal access)
make data      # runs the three pipelines; rewrites frontend/public/data/
```

or, on Modal:

```
modal run --detach scripts/modal_data.py
modal volume get mt-flat-tax-losers data frontend/public --force
```

Each pipeline runs current law against the reform for tax years 2028 and
2029 and writes CSV or JSON into `frontend/public/data/`. The statewide
pipeline also runs each provision alone so the dashboard can report the rate
change and the EITC increase separately.

### Data and model version

- Dataset: the Populace ACS local-area release, build
  `populace-us-2024-buildo-acs-local-766b7c7-20261017T030317Z`
  (`policyengine/populace-us`, `populace_us_2024_acs_local.h5`; the current
  local-area build as of November 2026). The national file holds 1.59
  million households calibrated to 4,765 administrative targets, including
  IRS Statistics of Income tables by state and population by congressional
  district. `scripts/build_dataset.py` keeps the 6,039 Montana households
  (`state_fips` 30) and splits them by `congressional_district_geoid`
  (2,830 in MT-01, 3,209 in MT-02) with the release's weights unchanged. It
  also sets missing `parent_1_id` and `parent_2_id` values on the ASEC/PUF
  records to 0, which policyengine-us reads as unknown and which the ACS
  records already carry; current policyengine-us refuses missing inputs.
  The slices are on the `mt-flat-tax-data` Modal volume; `make dataset`
  copies them to `.cache/datasets/`.
- Effective sample size: the Kish effective sample size of the Montana
  household weights is 315 (164 in MT-01, 151 in MT-02). The
  policyengine-us-data file used before November 2026 (`states/MT.h5`) had
  2,782. Results that rest on a small group of households, such as top-rate
  filers or households near the poverty line, carry more sampling noise.
- Model: `policyengine-us==2.153.8`. It includes the filing-status estimate
  of Montana tax for the federal SALT deduction (#11197) and the fix that
  makes results independent of calculation order (#9741).
- `scripts/diagnostics/pin_check.py` sums every dataset column and the main
  derived totals for a dataset and pin; results are in
  `scripts/diagnostics/results/pin_check_*.json`, including runs on the old
  `states/MT.h5` (`scripts/diagnostics/legacy_dataset.py` maps its
  outdated columns). For tax year 2029 under 2.153.8, Populace gives
  current-law Montana income tax of $2.47B against $2.28B on the old file;
  the budget office forecasts $2.55B for fiscal year 2029. Rerun the check
  before changing the dataset or the pin.
- Each tax year uses fresh `Microsimulation` objects. Computing two years on
  one simulation object returns $0 Montana tax for the second year.

### Known limits

- Estimates are static: no behavioral responses.
- The dataset is calibrated mainly to tax, program and population targets.
  Its current-law SPM poverty rate for Montana is about 6.0% in 2029; the
  Census Bureau's three-year average for 2023 to 2025 is 9.5% (±1.6). Poverty
  changes rest on a small number of sampled households.
- About 0.6% of households show a loss (about 2,700 in tax year 2029,
  averaging $18 per losing tax unit and at most $298). All of them itemize
  federal deductions. The model's federal deduction for state and local
  taxes reads `mt_withheld_income_tax`, an estimate of Montana income tax
  that avoids a circular calculation, not the household's computed Montana
  tax. The estimate uses the tax unit's filing-status brackets but
  subtracts the standard deduction rather than itemized deductions, so for
  these households it exceeds their computed Montana tax ($6,100 against
  $5,100 on average in 2029). Under the proposal the estimate falls about
  $90 on average while their computed Montana tax barely changes, so their
  modeled federal tax rises. This is a limit of the model, not a provision
  of the proposal. Moving the deduction with each household's computed
  Montana tax removes every loss and lowers the 2029 federal revenue change
  from $5.2M to $5.0M (`scripts/diagnostics/results/salt_proxy_diag_2.153.8_populace.json`).
- The household calculator calls www.policyengine.org's dashboard API
  through `@policyengine/api-client`, which forwards to the PolicyEngine
  Public API with PolicyEngine's credential (`api.policyengine.org` refuses
  unauthenticated browser calls). It runs the current model version rather
  than the pinned one. The dashboard API answers pages on localhost, on the
  team's Vercel previews and on hosts listed in policyengine-app-v2's
  `website/src/lib/dashboardApi/cors.ts`, and allows 30 household
  calculations a minute per address; each calculator request uses four.
  The example households are precomputed with the pinned version and do not
  need the API.

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
