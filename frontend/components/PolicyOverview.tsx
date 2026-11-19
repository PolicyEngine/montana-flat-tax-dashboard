'use client';

/**
 * Policy overview for the income tax proposals in Gov. Gianforte's
 * 2029 biennium executive budget (released November 16, 2026): a
 * phased move to a flat 4.7% rate and a larger Montana earned income
 * tax credit. All rate, threshold, and estimate figures in this file
 * are statutory constants or figures published by the Governor's
 * budget office, not model output. The machine-readable reform is
 * reform.json at the repository root; the constants live in
 * lib/montana.ts.
 */

import {
  CURRENT_EITC_MATCH,
  CURRENT_LOWER_RATE,
  CURRENT_UPPER_RATE,
  EITC_MATCH_PARAMETER,
  FILING_STATUSES,
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

const RATE_STEPS = [
  { label: 'Current law', sub: 'Tax year 2027 onward', top: CURRENT_UPPER_RATE },
  {
    label: 'Proposal',
    sub: `Tax year ${REFORM_START_YEAR}`,
    top: PROPOSED_TOP_RATE[REFORM_START_YEAR],
  },
  {
    label: 'Proposal',
    sub: `Tax year ${FLAT_RATE_YEAR} onward`,
    top: PROPOSED_TOP_RATE[FLAT_RATE_YEAR],
  },
];

const THRESHOLD_ROWS = [
  { label: 'Single', key: 'single' as const },
  { label: 'Married filing jointly', key: 'joint' as const },
  { label: 'Head of household', key: 'head_of_household' as const },
];

const PARAMETER_ROWS = [
  ...FILING_STATUSES.map((status) => ({
    parameter: `gov.states.mt.tax.income.main.${status}[1].rate`,
    current: pct(CURRENT_UPPER_RATE),
    first: pct(PROPOSED_TOP_RATE[REFORM_START_YEAR]),
    later: pct(PROPOSED_TOP_RATE[FLAT_RATE_YEAR]),
  })),
  {
    parameter: EITC_MATCH_PARAMETER,
    current: pct(CURRENT_EITC_MATCH, 0),
    first: pct(PROPOSED_EITC_MATCH, 0),
    later: pct(PROPOSED_EITC_MATCH, 0),
  },
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

      {/* Rate path */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Income tax rates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RATE_STEPS.map((step, i) => {
            const flat = step.top === CURRENT_LOWER_RATE;
            return (
              <div
                key={step.sub}
                className={`rounded-xl border p-6 ${
                  i === 0 ? 'border-gray-200 bg-gray-50' : 'border-primary-200 bg-white'
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {step.label}
                </div>
                <div className="text-sm text-gray-600 mb-3">{step.sub}</div>
                {flat ? (
                  <div>
                    <div className="text-4xl font-bold text-primary-600">
                      {pct(step.top)}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      One rate on all taxable income
                    </div>
                  </div>
                ) : (
                  <div className="flex items-end gap-4">
                    <div>
                      <div className="text-2xl font-bold text-gray-500">
                        {pct(CURRENT_LOWER_RATE)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">Lower rate</div>
                    </div>
                    <div>
                      <div
                        className={`text-4xl font-bold ${
                          i === 0 ? 'text-gray-700' : 'text-primary-600'
                        }`}
                      >
                        {pct(step.top)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">Top rate</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-500 max-w-prose">
          Under current law (House Bill 337, 2025), the top rate stepped down
          from 5.9% in 2025 to 5.65% in 2026 and {pct(CURRENT_UPPER_RATE)}{' '}
          from 2027. The budget describes a change to the top marginal rate
          only, so this analysis leaves Montana&apos;s separate rates on
          long-term capital gains unchanged.
        </p>
      </div>

      {/* EITC */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Earned income tax credit
        </h3>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-500">
                {pct(CURRENT_EITC_MATCH, 0)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Current law</div>
            </div>
            <div className="text-3xl text-gray-300">&rarr;</div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-600">
                {pct(PROPOSED_EITC_MATCH, 0)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Proposal</div>
            </div>
            <div className="text-sm text-gray-600">of the federal credit</div>
          </div>
          <p className="mt-4 text-xs text-gray-500 max-w-prose">
            Montana&apos;s credit is refundable and equals a share of the
            federal EITC. The budget does not name the first tax year for
            the higher match. It counts the cost from fiscal year 2029, when
            tax year {REFORM_START_YEAR} returns are filed, so this dashboard
            applies the {pct(PROPOSED_EITC_MATCH, 0)} match from tax year{' '}
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

      {/* Budget office estimates */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Budget office estimates
        </h3>
        <p className="text-sm text-gray-700 max-w-prose mb-3">
          The Governor&apos;s Office of Budget and Program Planning lists
          these revenue reductions in the{' '}
          <a
            className="text-primary-600 underline"
            href={REFERENCE_LINKS.budgetReference}
            target="_blank"
            rel="noopener noreferrer"
          >
            executive budget
          </a>
          :
        </p>
        <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5 max-w-prose">
          <li>
            Rate change: about $12 million in fiscal year 2028, $72 million in
            fiscal year 2029, and $117 million at full implementation in
            fiscal year 2030.
          </li>
          <li>EITC increase: $16 million beginning in fiscal year 2029.</li>
        </ul>
        <p className="mt-3 text-xs text-gray-500 max-w-prose">
          The governor&apos;s letter describes the two proposals together as
          $220 million in tax relief. The budget documents do not state the
          period that figure covers. The Validation tab compares these
          estimates with this dashboard&apos;s results.
        </p>
      </div>

      {/* Parameter changes */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Parameter changes
        </h3>
        <p className="text-sm text-gray-600 mb-3 max-w-prose">
          The reform edits Montana&apos;s income tax parameters in{' '}
          <a
            className="text-primary-600 underline"
            href={REFERENCE_LINKS.peParameters}
            target="_blank"
            rel="noreferrer"
          >
            policyengine-us
          </a>
          : the top rate (<code className="text-xs">[1].rate</code>) for each
          of the five filing statuses, and the EITC match.{' '}
          <code className="text-xs">reform.json</code> at the repository root
          is the canonical, complete parameter set.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Parameter</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Current law</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">{REFORM_START_YEAR}</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">{FLAT_RATE_YEAR} onward</th>
              </tr>
            </thead>
            <tbody>
              {PARAMETER_ROWS.map((row) => (
                <tr key={row.parameter} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-700 break-all font-mono text-xs">{row.parameter}</td>
                  <td className="py-3 px-4 text-gray-700">{row.current}</td>
                  <td className="py-3 px-4 text-gray-700">{row.first}</td>
                  <td className="py-3 px-4 text-gray-700">{row.later}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
