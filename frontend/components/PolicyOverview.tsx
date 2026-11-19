'use client';

/**
 * Policy overview for Montana's proposed flat 4.7% individual income
 * tax (Gov. Gianforte; drafted for the 2027 session at the request of
 * Senate President Matt Regier), first applying to tax year 2028. All
 * rate and threshold figures in this file are statutory constants
 * (current-law HB 337 schedule, the proposed flat rate), not model
 * output. The machine-readable reform is reform.json at the repository
 * root; the constants live in lib/montana.ts.
 */

import {
  CURRENT_UPPER_RATE_2028,
  DOR_ANCHOR_ANNUAL_COST,
  FLAT_RATE,
  REFORM_START_YEAR,
  THRESHOLDS_2028,
  REFERENCE_LINKS,
} from '@/lib/montana';

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const dollars = (n: number) => `$${n.toLocaleString('en-US')}`;
const cutPP = ((CURRENT_UPPER_RATE_2028 - FLAT_RATE) * 100).toFixed(1);

/** Where the cut bites: the current-law upper rate begins at these
 *  approximate 2028 thresholds, by filing status. */
const THRESHOLD_CARDS = [
  { label: 'Single', value: THRESHOLDS_2028.single },
  { label: 'Married filing jointly', value: THRESHOLDS_2028.joint },
  { label: 'Head of household', value: THRESHOLDS_2028.head_of_household },
];

const FILING_STATUSES = [
  'single',
  'joint',
  'head_of_household',
  'separate',
  'surviving_spouse',
] as const;

const PARAMETER_ROWS = FILING_STATUSES.map((status) => ({
  parameter: `gov.states.mt.tax.income.main.${status}[1].rate`,
  current: pct(CURRENT_UPPER_RATE_2028),
  reform: pct(FLAT_RATE),
  dates: '2028-01-01 onward',
}));

export default function PolicyOverview() {
  return (
    <div className="space-y-10">
      {/* Header + lede */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Montana flat income tax
        </h2>
        <p className="text-gray-700 max-w-prose">
          Gov. Greg Gianforte has proposed replacing Montana&apos;s two-rate
          individual income tax with a single flat rate of {pct(FLAT_RATE)},
          beginning tax year {REFORM_START_YEAR}. Because the lower bracket
          already sits at {pct(FLAT_RATE)}, the reform is a{' '}
          {cutPP} percentage-point cut to the top rate on income above the
          bracket thresholds. Long-term capital gains are unchanged.
        </p>
      </div>

      {/* Visual rate change */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">
            Top rate on ordinary income
          </div>
          <div className="flex items-center gap-5">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-400 line-through decoration-2">
                {pct(CURRENT_UPPER_RATE_2028)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Current law</div>
            </div>
            <div className="text-3xl text-gray-300">&rarr;</div>
            <div className="text-center">
              <div className="text-5xl font-bold text-primary-600">
                {pct(FLAT_RATE)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Flat-tax reform</div>
            </div>
            <div className="ml-auto rounded-full bg-primary-100 px-4 py-2 text-sm font-semibold text-primary-700">
              &minus;{cutPP} pp
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            The top rate steps down 5.9% (2025) &rarr; 5.65% (2026) &rarr;{' '}
            {pct(CURRENT_UPPER_RATE_2028)} (2027+) under current law (HB 337).
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col justify-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Effective
          </div>
          <div className="text-3xl font-bold text-gray-900">
            Tax year {REFORM_START_YEAR}
          </div>
          <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Montana DOR revenue estimate
          </div>
          <div className="text-lg font-semibold text-gray-700">
            {dollars(DOR_ANCHOR_ANNUAL_COST / 1e6)}M / yr
          </div>
        </div>
      </div>

      {/* Where the cut starts */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          The cut applies only to income above (2028, approx.)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {THRESHOLD_CARDS.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="text-2xl font-bold text-gray-900">
                {dollars(card.value)}
              </div>
              <div className="mt-1 text-sm text-gray-500">{card.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Parameter changes */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Parameter changes
        </h3>
        <p className="text-sm text-gray-600 mb-3 max-w-prose">
          The reform edits Montana&apos;s income-tax rate schedule in{' '}
          <a
            className="text-primary-600 underline"
            href={REFERENCE_LINKS.peParameters}
            target="_blank"
            rel="noreferrer"
          >
            policyengine-us
          </a>
          . For each of the five filing statuses, both ordinary-rate
          brackets are set to {pct(FLAT_RATE)} from {REFORM_START_YEAR}; the
          economically active change is the top rate{' '}
          (<code className="text-xs">[1].rate</code>) shown below.{' '}
          <code className="text-xs">reform.json</code> at the repository
          root is the canonical, complete parameter set.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Parameter</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Current law</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Reform value</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Effective dates</th>
              </tr>
            </thead>
            <tbody>
              {PARAMETER_ROWS.map((row) => (
                <tr key={row.parameter} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-700 break-all font-mono text-xs">{row.parameter}</td>
                  <td className="py-3 px-4 text-gray-700">{row.current}</td>
                  <td className="py-3 px-4 text-gray-700">{row.reform}</td>
                  <td className="py-3 px-4 text-gray-700">{row.dates}</td>
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
          <li>
            <a
              href={REFERENCE_LINKS.dailyMontanan}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              Montana Senate Republicans back the Governor&apos;s flat income tax plan — Daily Montanan
            </a>
          </li>
          <li>
            <a
              href={REFERENCE_LINKS.hb337}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              House Bill 337 (current-law rate schedule)
            </a>
          </li>
          <li>
            <a
              href={REFERENCE_LINKS.montanaDor}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              Montana Department of Revenue
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
