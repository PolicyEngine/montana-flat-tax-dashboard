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

- Dataset: `hf://policyengine/policyengine-us-data/states/MT.h5` and
  `districts/MT-01.h5`, `districts/MT-02.h5`. These are calibrated to Montana.
  They were built on May 20, 2026 and that data repository has not changed
  since May 31, 2026.
- `scripts/reform_def.py:load_dataset()` downloads each file and changes it
  so current policyengine-us reads it as intended:
  - `partnership_se_income` becomes `partnership_self_employment_net_earnings`
    (renamed in policyengine-us #8614).
  - `partnership_s_corp_income` becomes `partnership_income`. Since #8614 the
    combined variable is the sum of `partnership_income` and `s_corp_income`,
    and the combined column no longer carries into later years. Without the
    change the model counts no partnership or S corporation income in 2028
    and 2029, and Montana income tax falls 15%.
  - `first_home_mortgage_interest` and `second_home_mortgage_interest` are
    dropped (removed in #9605). `home_mortgage_interest` holds the same
    amounts.
  - `county_fips` is stored as five-digit text, and 10 records (a 15- or
    16-year-old in an SPM unit of their own) are flagged as independent.
    Current policyengine-us computes no SPM threshold until both hold.
- Model: `policyengine-us==2.153.8`. It includes the filing-status estimate
  of Montana tax for the federal SALT deduction (#11197) and the fix that
  makes results independent of calculation order (#9741).
- `scripts/diagnostics/pin_check.py` sums every dataset column and the main
  derived totals under a given pin; results are in
  `scripts/diagnostics/results/pin_check_*.json`. Against 1.715.2, for tax
  year 2029: most income inputs are about 3% lower (newer economic
  projections); federal AGI is 8.6% higher, mainly because 2.153.8 limits
  business losses under section 461(l), which mostly makes negative AGIs
  less negative; federal taxable income is 0.9% higher and Montana taxable
  income 0.1% higher; Montana income tax after refundable credits is 2.2%
  higher ($2.28B against $2.23B). Rerun the check before changing the pin.
- Each tax year uses fresh `Microsimulation` objects. Computing two years on
  one simulation object returns $0 Montana tax for the second year.

### Known limits

- Estimates are static: no behavioral responses.
- The dataset is calibrated mainly to tax and demographic targets. Its poverty
  rates can differ from Census Bureau estimates, and poverty changes rest on a
  small number of sampled households.
- About 1.2% of households show a loss (about 5,700 in tax year 2029,
  averaging $44 per losing tax unit and at most $577). All of them itemize
  federal deductions. The model's federal deduction for state and local
  taxes reads `mt_withheld_income_tax`, an estimate of Montana income tax
  that avoids a circular calculation, not the household's computed Montana
  tax. The estimate uses the tax unit's filing-status brackets but
  subtracts the standard deduction rather than itemized deductions, so for
  these households it exceeds their computed Montana tax ($7,700 against
  $3,100 on average in 2029). Under the proposal the estimate falls about
  $310 on average while their computed Montana tax barely changes, so their
  modeled federal tax rises. This is a limit of the model, not a provision
  of the proposal. Moving the deduction with each household's computed
  Montana tax removes every loss and lowers the 2029 federal revenue change
  from $7.9M to $6.7M (`scripts/diagnostics/results/salt_proxy_diag_2.153.8.json`).
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
