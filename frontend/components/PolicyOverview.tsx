'use client';

/**
 * Policy overview for the income tax proposals in Gov. Gianforte's
 * 2029 biennium executive budget (released November 16, 2026): a
 * phased move to a flat 4.7% rate and a larger Montana earned income
 * tax credit. Every rate and threshold in this file is a statutory or
 * proposed constant from lib/montana.ts, not model output. Revenue
 * estimates, including the budget office's, live on the Validation tab.
 */

import {
  CURRENT_EITC_MATCH,
  CURRENT_LOWER_RATE,
  CURRENT_UPPER_RATE,
  FLAT_RATE,
  FLAT_RATE_YEAR,
  PROPOSED_EITC_MATCH,
  PROPOSED_TOP_RATE,
  REFERENCE_LINKS,
  REFORM_START_YEAR,
  THRESHOLDS,
  YEARS,
} from '@/lib/montana';

const pct = (r: number, digits = 1) => `${(r * 100).toFixed(digits)}%`;
const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;

/** One row per provision; `values` are current law, the first reform
 *  year, and the flat-rate year onward. */
const CHANGE_ROWS = [
  {
    label: 'Lower income tax rate',
    values: [CURRENT_LOWER_RATE, CURRENT_LOWER_RATE, CURRENT_LOWER_RATE].map((r) => pct(r)),
  },
  {
    label: 'Top income tax rate',
    values: [
      CURRENT_UPPER_RATE,
      PROPOSED_TOP_RATE[REFORM_START_YEAR],
      PROPOSED_TOP_RATE[FLAT_RATE_YEAR],
    ].map((r) => pct(r)),
  },
  {
    label: 'Montana EITC, share of the federal credit',
    values: [CURRENT_EITC_MATCH, PROPOSED_EITC_MATCH, PROPOSED_EITC_MATCH].map((r) =>
      pct(r, 0),
    ),
  },
];

const CHANGE_COLUMNS = [
  'Current law',
  `Tax year ${REFORM_START_YEAR}`,
  `Tax year ${FLAT_RATE_YEAR} onward`,
];

const THRESHOLD_ROWS = [
  { label: 'Single', key: 'single' as const },
  { label: 'Married filing jointly', key: 'joint' as const },
  { label: 'Head of household', key: 'head_of_household' as const },
];

export default function PolicyOverview() {
  return (
    <div className="space-y-10">
      {/* Header + lede */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Montana flat income tax and EITC proposal
        </h2>
        <p className="text-gray-700 max-w-prose">
          Gov. Greg Gianforte&apos;s budget for the 2029 biennium, released
          November 16, 2026, proposes two changes to Montana&apos;s
          individual income tax. The first lowers the top rate from{' '}
          {pct(CURRENT_UPPER_RATE)} to{' '}
          {pct(PROPOSED_TOP_RATE[REFORM_START_YEAR])} in tax year{' '}
          {REFORM_START_YEAR} and to {pct(FLAT_RATE)} from tax year{' '}
          {FLAT_RATE_YEAR}. Because the lower bracket already sits at{' '}
          {pct(CURRENT_LOWER_RATE)}, that leaves one flat rate. The second
          raises the Montana earned income tax credit (EITC) from{' '}
          {pct(CURRENT_EITC_MATCH, 0)} to {pct(PROPOSED_EITC_MATCH, 0)} of the
          federal credit.
        </p>
      </div>

      {/* Changes by tax year */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Changes by tax year
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Provision</th>
                {CHANGE_COLUMNS.map((col) => (
                  <th key={col} className="text-right py-3 px-4 font-semibold text-gray-900">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHANGE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-700">{row.label}</td>
                  {row.values.map((value, i) => (
                    <td
                      key={CHANGE_COLUMNS[i]}
                      className={`py-3 px-4 text-right ${
                        i > 0 && value !== row.values[0]
                          ? 'font-semibold text-primary-700'
                          : 'text-gray-700'
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-2 text-xs text-gray-500 max-w-prose">
          <p>
            From tax year {FLAT_RATE_YEAR} the two rates are equal, so one
            rate applies to all taxable income. Under current law (House Bill
            337, 2025), the top rate stepped down from 5.9% in 2025 to 5.65%
            in 2026 and {pct(CURRENT_UPPER_RATE)} from 2027. The budget
            describes a change to the top marginal rate only, so this
            analysis leaves Montana&apos;s separate rates on long-term
            capital gains unchanged.
          </p>
          <p>
            Montana&apos;s EITC is refundable. The budget does not name the
            first tax year for the higher match. It counts the cost from
            fiscal year 2029, when tax year {REFORM_START_YEAR} returns are
            filed, so this dashboard applies the{' '}
            {pct(PROPOSED_EITC_MATCH, 0)} match from tax year{' '}
            {REFORM_START_YEAR}.
          </p>
        </div>
      </div>

      {/* Where the rate cut starts */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          The rate cut applies only to taxable income above
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Filing status</th>
                {YEARS.map((y) => (
                  <th key={y} className="text-right py-3 px-4 font-semibold text-gray-900">
                    Tax year {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {THRESHOLD_ROWS.map((row) => (
                <tr key={row.key} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-700">{row.label}</td>
                  {YEARS.map((y) => (
                    <td key={y} className="py-3 px-4 text-right text-gray-700">
                      {dollars(THRESHOLDS[y][row.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500 max-w-prose">
          House Bill 337 set these thresholds at $65,000, $130,000, and
          $97,500 for 2027 and indexes them to inflation. The values shown
          are PolicyEngine&apos;s projections of the indexed thresholds.
          Taxable income is income after the standard or itemized deductions.
        </p>
      </div>

      {/* References */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">References</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          {[
            {
              href: REFERENCE_LINKS.budgetReference,
              text: "Governor's Executive Budget, 2029 biennium, Section R (pages REF-7 and REF-8)",
            },
            {
              href: REFERENCE_LINKS.governorLetter,
              text: "Governor's letter, 2029 biennium executive budget",
            },
            {
              href: REFERENCE_LINKS.pressRelease,
              text: "Governor's Office news release, November 12, 2026",
            },
            {
              href: REFERENCE_LINKS.hb337,
              text: 'House Bill 337 (2025), current-law rate schedule and EITC match',
            },
            {
              href: REFERENCE_LINKS.eitcStatute,
              text: 'Montana Code Annotated 15-30-2318, earned income tax credit',
            },
          ].map((ref) => (
            <li key={ref.href}>
              <a
                href={ref.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                {ref.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
