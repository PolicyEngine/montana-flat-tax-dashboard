/**
 * Montana flat income tax — statute and reference constants.
 *
 * Every value here is a statutory constant (current-law HB 337 rates
 * and thresholds, the proposed flat rate) or an external published
 * anchor (Montana Department of Revenue estimate), NOT model output of
 * this dashboard. Model figures are read from public/data/* via the
 * react-query hooks. The canonical, machine-readable reform is
 * reform.json at the repository root.
 */

/** The tax year the flat rate first applies. */
export const REFORM_START_YEAR = 2028;

/** Current-law Montana ordinary-income rates (HB 337). The lower rate
 *  applies up to the bracket threshold; the upper rate above it. The
 *  upper rate steps down 5.9% (2025) -> 5.65% (2026) -> 5.4% (2027+). */
export const CURRENT_LOWER_RATE = 0.047;
export const CURRENT_UPPER_RATE_2028 = 0.054;

/** Proposed single flat rate that replaces the two-rate schedule. */
export const FLAT_RATE = 0.047;

/** Approximate 2028 bracket thresholds (uprated from 2027) at which
 *  the current-law upper rate begins, by filing status. */
export const THRESHOLDS_2028 = {
  single: 65000,
  joint: 130000,
  head_of_household: 97500,
} as const;

/** Montana Department of Revenue's own estimate of the annual revenue
 *  reduction (2029 Biennium Outlook Report, June 2026; FY2029 ~ TY2028). */
export const DOR_ANCHOR_ANNUAL_COST = -130_000_000;
export const DOR_ANCHOR_LABEL =
  'Montana Department of Revenue (2029 Biennium Outlook Report, June 2026)';

/** Reference links (primary sources). */
export const REFERENCE_LINKS = {
  dailyMontanan:
    'https://dailymontanan.com/2026/07/13/montana-senate-republicans-back-governors-flat-income-tax-plan/',
  hb337:
    'https://leg.mt.gov/bills/2023/billpdf/HB0337.pdf',
  peParameters:
    'https://github.com/PolicyEngine/policyengine-us/tree/master/policyengine_us/parameters/gov/states/mt/tax/income/main',
  montanaDor: 'https://mtrevenue.gov/',
} as const;

/** Public PolicyEngine API base for live household calculations. */
export const POLICYENGINE_API_BASE = 'https://api.policyengine.org/us';

/** The reform as a PolicyEngine parameter-change map (mirror of
 *  reform.json), used to build the reform policy for the live API. The
 *  economically active change is each status's [1].rate (the upper
 *  rate) moving 0.054 -> 0.047 from 2028. */
export const MT_FLAT_TAX_REFORM: Record<string, Record<string, number>> =
  Object.fromEntries(
    ['single', 'joint', 'head_of_household', 'separate', 'surviving_spouse'].flatMap(
      (status) => [
        [
          `gov.states.mt.tax.income.main.${status}[0].rate`,
          { '2028-01-01.2100-12-31': FLAT_RATE },
        ],
        [
          `gov.states.mt.tax.income.main.${status}[1].rate`,
          { '2028-01-01.2100-12-31': FLAT_RATE },
        ],
      ],
    ),
  );
