'use client';

/**
 * Validation tab: compares this dashboard's pinned Montana runs with
 * the estimates the Governor's Office of Budget and Program Planning
 * (OBPP) published in the 2029 biennium executive budget.
 *
 * Data source: public/data/validation.json (schema_version 4), read via
 * useValidation. While the file is absent or carries an older schema,
 * the tab renders a "pending pinned run" state alongside the published
 * OBPP figures.
 *
 * The OBPP figures are external published constants (lib/montana.ts),
 * not model output of this dashboard.
 */

import { useValidation } from '@/hooks/useValidation';
import {
  FLAT_RATE_YEAR,
  OBPP_INCOME_TAX_FORECAST,
  OBPP_LABEL,
  REFERENCE_LINKS,
  REFORM_START_YEAR,
} from '@/lib/montana';
import type { ValidationRun } from '@/lib/types';

const PENDING = 'Pending pinned run';

const fmtM = (v: number) => {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  return `${sign}$${(abs / 1e6).toFixed(1)}M`;
};

const fmtLevel = (v: number) => `$${(v / 1e9).toFixed(2)}B`;

function Tile({ title, value, detail, pending }: {
  title: string;
  value: string;
  detail: string;
  pending: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-5 border ${
        pending ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-300'
      }`}
    >
      <p className="text-sm text-gray-700">{title}</p>
      <p className={`text-2xl font-bold mt-2 ${pending ? 'text-amber-700' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-600 mt-2 leading-5">{detail}</p>
    </div>
  );
}

export default function ValidationTab() {
  const { data: validation, isLoading } = useValidation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading validation data...</p>
        </div>
      </div>
    );
  }

  const runFor = (year: number): ValidationRun | undefined =>
    validation?.runs.find((r) => r.year === year);
  const first = runFor(REFORM_START_YEAR);
  const flat = runFor(FLAT_RATE_YEAR);
  const provenance = validation?.provenance ?? null;
  const show = (v: number | undefined) => (v === undefined ? PENDING : fmtM(v));

  const rows = [
    {
      provision: 'Top rate to 5.0%',
      ours: `Tax year ${REFORM_START_YEAR}: ${show(first?.rate_cut_state_revenue_impact)}`,
      obpp: 'About -$12M in FY2028 and -$72M in FY2029',
    },
    {
      provision: 'Flat 4.7% rate',
      ours: `Tax year ${FLAT_RATE_YEAR}: ${show(flat?.rate_cut_state_revenue_impact)}`,
      obpp: 'About -$117M at full implementation in FY2030',
    },
    {
      provision: 'EITC to 30% of the federal credit',
      ours: `Tax year ${REFORM_START_YEAR}: ${show(first?.eitc_state_revenue_impact)}; tax year ${FLAT_RATE_YEAR}: ${show(flat?.eitc_state_revenue_impact)}`,
      obpp: '-$16M beginning in FY2029',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-primary mb-2">Validation</h2>
        <p className="text-gray-600 max-w-prose">
          How this dashboard&apos;s pinned Montana runs compare with the
          estimates published by the Governor&apos;s Office of Budget and
          Program Planning.
        </p>
      </div>

      {/* Pinned run totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Tile
          title={`Pinned run, tax year ${REFORM_START_YEAR}`}
          value={show(first?.state_revenue_impact)}
          detail="Montana income tax revenue change with the top rate at 5.0% and the EITC at 30% of the federal credit."
          pending={!first}
        />
        <Tile
          title={`Pinned run, tax year ${FLAT_RATE_YEAR}`}
          value={show(flat?.state_revenue_impact)}
          detail="Montana income tax revenue change with the flat 4.7% rate and the EITC at 30% of the federal credit."
          pending={!flat}
        />
      </div>

      {/* Comparison table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Pinned runs vs budget office estimates
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left px-4 py-3 font-medium text-gray-900">Provision</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900">This dashboard</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900">Budget office</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.provision} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900">{row.provision}</td>
                  <td className="px-4 py-3 text-gray-700">{row.ours}</td>
                  <td className="px-4 py-3 text-gray-700">{row.obpp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2 italic max-w-prose">
          All figures are changes in Montana&apos;s own income tax revenue
          (negative = revenue loss). This dashboard reports tax-year
          liabilities. The budget office reports fiscal years, which run
          July through June and combine withholding from one tax year with
          final payments and refunds from another, so the two do not line up
          one to one.
        </p>
        <p className="text-xs text-gray-500 mt-2 max-w-prose">
          The budget office figures come from the{' '}
          <a
            className="text-primary-600 underline"
            href={REFERENCE_LINKS.budgetReference}
            target="_blank"
            rel="noopener noreferrer"
          >
            executive budget, Section R
          </a>
          . The{' '}
          <a
            className="text-primary-600 underline"
            href={REFERENCE_LINKS.governorLetter}
            target="_blank"
            rel="noopener noreferrer"
          >
            governor&apos;s letter
          </a>{' '}
          describes the two proposals together as $220 million in tax
          relief. The budget documents do not state the period that figure
          covers.
        </p>
      </div>

      <details className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
        <summary className="cursor-pointer font-semibold text-gray-800">
          Methodology &amp; provenance
        </summary>
        <div className="mt-3 space-y-3 text-sm text-gray-700 max-w-prose">
          <p>
            Static analysis with no behavioral responses, Montana only, on a
            dataset calibrated to Montana. Each provision is also run on its
            own against current law. Poverty uses the Supplemental Poverty
            Measure (SPM).
          </p>
          <p>
            The pinned run&apos;s current-law Montana income tax is{' '}
            {flat?.baseline_state_income_tax !== undefined
              ? fmtLevel(flat.baseline_state_income_tax)
              : PENDING}{' '}
            for tax year {FLAT_RATE_YEAR}. The budget office forecasts{' '}
            {fmtLevel(OBPP_INCOME_TAX_FORECAST.fy2029)} of individual income
            tax revenue in fiscal year 2029 (
            <a
              className="text-primary-600 underline"
              href={REFERENCE_LINKS.budgetVolume2}
              target="_blank"
              rel="noopener noreferrer"
            >
              Volume 2
            </a>
            ).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-3 py-2 text-gray-500">Pinned run model</td>
                  <td className="px-3 py-2">{provenance ? `policyengine-us ${provenance.policyengine_us}` : PENDING}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">Pinned run dataset</td>
                  <td className="px-3 py-2 break-all">{provenance?.dataset ?? PENDING}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">Budget office source</td>
                  <td className="px-3 py-2">
                    <a
                      className="text-primary-600 underline"
                      href={REFERENCE_LINKS.budgetReference}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {OBPP_LABEL}
                    </a>
                    , Section R
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">Pinned run computed</td>
                  <td className="px-3 py-2">{provenance?.run_timestamp ?? PENDING}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The reform changes two sets of Montana income tax parameters in{' '}
            <a
              className="text-primary-600 underline"
              href={REFERENCE_LINKS.peParameters}
              target="_blank"
              rel="noopener noreferrer"
            >
              policyengine-us
            </a>
            : the top rate for all five filing statuses and the EITC match
            (reform.json at the repository root is the canonical parameter
            set). The household calculator uses the
            current PolicyEngine API, whose model version can differ from the
            pinned run.
          </p>
        </div>
      </details>
    </div>
  );
}
