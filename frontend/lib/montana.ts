/**
 * Montana flat income tax and earned income tax credit proposal:
 * statute and reference constants.
 *
 * Every value here is a statutory constant (current-law HB 337 rates
 * and thresholds, the proposed rates and credit match) or an external
 * published figure (the Governor's Office of Budget and Program
 * Planning estimates), NOT model output of this dashboard. Model
 * figures are read from public/data/* via the react-query hooks. The
 * canonical, machine-readable reform is reform.json at the repository
 * root; MT_REFORM below mirrors it (a unit test keeps them in sync).
 *
 * Source for the proposal: Governor's Executive Budget, 2029 biennium,
 * Section R (Reference), pages REF-7 and REF-8, released November 16,
 * 2026.
 */

/** Tax years the dashboard reports. */
export const YEARS = [2028, 2029] as const;
export type ReformYear = (typeof YEARS)[number];

/** The first tax year the proposal applies. */
export const REFORM_START_YEAR: ReformYear = 2028;
/** The first tax year of the single flat rate; the default view. */
export const FLAT_RATE_YEAR: ReformYear = 2029;
export const DEFAULT_YEAR: ReformYear = FLAT_RATE_YEAR;

/** Current-law Montana ordinary-income rates (HB 337, 2025). The lower
 *  rate applies up to the bracket threshold; the upper rate above it.
 *  The upper rate steps down 5.9% (2025) -> 5.65% (2026) -> 5.4% (2027+). */
export const CURRENT_LOWER_RATE = 0.047;
export const CURRENT_UPPER_RATE = 0.054;

/** Proposed top rate by tax year: 5.0% in 2028, then 4.7% from 2029,
 *  which equals the lower rate and leaves a single flat rate. */
export const PROPOSED_TOP_RATE: Record<ReformYear, number> = {
  2028: 0.05,
  2029: 0.047,
};
export const FLAT_RATE = 0.047;

/** Montana earned income tax credit as a share of the federal credit. */
export const CURRENT_EITC_MATCH = 0.2;
export const PROPOSED_EITC_MATCH = 0.3;

/** Taxable-income thresholds at which the current-law upper rate
 *  begins, by filing status. HB 337 sets $65,000 / $130,000 / $97,500
 *  for 2027 and indexes them to inflation afterward; these are the
 *  indexed values the pinned policyengine-us version projects. */
export const THRESHOLDS: Record<
  ReformYear,
  { single: number; joint: number; head_of_household: number }
> = {
  2028: { single: 66_400, joint: 132_700, head_of_household: 99_500 },
  2029: { single: 67_800, joint: 135_600, head_of_household: 101_700 },
};

/** One-line description of what applies in each tax year. */
export const YEAR_SUMMARY: Record<ReformYear, string> = {
  2028: 'Top rate 5.0%, EITC 30% of federal',
  2029: 'Flat 4.7% rate, EITC 30% of federal',
};

/** Governor's Office of Budget and Program Planning (OBPP) estimates,
 *  as printed in Section R of the executive budget. Fiscal years run
 *  July to June, so they do not line up one-to-one with tax years. */
export const OBPP_LABEL =
  "Governor's Office of Budget and Program Planning, 2029 biennium executive budget (November 16, 2026)";
export const OBPP_ESTIMATES = {
  /** Rate change: about $12M in FY2028, $72M in FY2029, and $117M at
   *  full implementation in FY2030 (revenue reductions). */
  rates: { fy2028: -12_000_000, fy2029: -72_000_000, fy2030: -117_000_000 },
  /** EITC increase: $16M beginning in FY2029. */
  eitc: { fy2029: -16_000_000 },
} as const;

/** OBPP present-law forecast of individual income tax revenue
 *  (executive budget Volume 2, Individual Income Tax, Table 1). */
export const OBPP_INCOME_TAX_FORECAST = {
  fy2028: 2_423_563_000,
  fy2029: 2_545_697_000,
} as const;

/** Reference links (primary sources). */
export const REFERENCE_LINKS = {
  budgetReference: 'https://gov.mt.gov/_docs/budget_budget2029/OBPPREF.pdf#page=7',
  budgetIndex: 'https://budget.mt.gov/Budgets/',
  budgetVolume2: 'https://gov.mt.gov/_docs/budget_budget2029/29BVolume2Book.pdf',
  governorLetter:
    'https://gov.mt.gov/_docs/budget_budget2029/GovernorsLetter2029BExecutiveBudget.pdf',
  pressRelease:
    'https://news.mt.gov/Governors-Office/Governor-Gianforte-Unveils-Budget-for-2027-Legislative-Session-Realizing-the-Montana-Comeback',
  hb337: 'https://archive.legmt.gov/content/Sessions/69th/Contractor_index/CH0227.pdf',
  eitcStatute:
    'https://mca.legmt.gov/bills/mca/title_0150/chapter_0300/part_0230/section_0180/0150-0300-0230-0180.html',
  peParameters:
    'https://github.com/PolicyEngine/policyengine-us/tree/main/policyengine_us/parameters/gov/states/mt/tax/income',
} as const;

/** Public PolicyEngine API base for live household calculations. */
export const POLICYENGINE_API_BASE = 'https://api.policyengine.org/us';

export const FILING_STATUSES = [
  'single',
  'joint',
  'head_of_household',
  'separate',
  'surviving_spouse',
] as const;

export const EITC_MATCH_PARAMETER = 'gov.states.mt.tax.income.credits.eitc.match';

/** The reform as a PolicyEngine parameter-change map (mirror of
 *  reform.json), used to build the reform policy for the live API. */
export const MT_REFORM: Record<string, Record<string, number>> = {
  ...Object.fromEntries(
    FILING_STATUSES.map((status) => [
      `gov.states.mt.tax.income.main.${status}[1].rate`,
      {
        '2028-01-01.2028-12-31': PROPOSED_TOP_RATE[2028],
        '2029-01-01.2100-12-31': PROPOSED_TOP_RATE[2029],
      },
    ]),
  ),
  [EITC_MATCH_PARAMETER]: { '2028-01-01.2100-12-31': PROPOSED_EITC_MATCH },
};
