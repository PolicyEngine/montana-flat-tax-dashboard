'use client';

/**
 * Validation tab — reconciles this dashboard's pinned Montana run
 * against the Montana Department of Revenue's own published revenue
 * estimate.
 *
 * Data source: public/data/validation.json (schema_version 3), read
 * via useValidation. While the file is absent or carries an older
 * schema, the tab renders a graceful "pending pinned run" state built
 * from the external anchor constants below.
 *
 * The anchor constants are external published figures (the Montana DOR
 * estimate and the calibrated baseline) — not model output of this
 * dashboard.
 */

import { useValidation } from '@/hooks/useValidation';
import {
  DOR_ANCHOR_ANNUAL_COST,
  DOR_ANCHOR_LABEL,
  REFORM_START_YEAR,
} from '@/lib/montana';

/** Fallback pinned-run figure used only until validation.json ships.
 *  Sourced from the verified MT.h5 run described in the project brief. */
const FALLBACK_PINNED = {
  label: 'This dashboard (pinned MT.h5 run)',
  year: REFORM_START_YEAR,
  net_cost: -118_200_000,
  poverty_percent_change: 0,
  child_poverty_percent_change: 0,
};

const fmtM = (v: number) => {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  return `${sign}$${(abs / 1e6).toFixed(1)}M`;
};

function VerdictTile({
  title,
  status,
  value,
  detail,
  tone,
}: {
  title: string;
  status: string;
  value: string;
  detail: string;
  tone: 'good' | 'pending' | 'neutral';
}) {
  const toneClasses =
    tone === 'good'
      ? 'bg-green-50 border-success'
      : tone === 'pending'
        ? 'bg-amber-50 border-amber-300'
        : 'bg-gray-50 border-gray-300';
  const statusClasses =
    tone === 'good'
      ? 'text-green-700'
      : tone === 'pending'
        ? 'text-amber-700'
        : 'text-gray-600';
  return (
    <div className={`rounded-lg p-5 border ${toneClasses}`}>
      <p className="text-sm text-gray-700">{title}</p>
      <p className={`text-sm font-semibold uppercase tracking-wide mt-0.5 ${statusClasses}`}>
        {status}
      </p>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
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

  const hasPinned = validation?.pinned_run != null;
  const pinnedRun = validation?.pinned_run ?? FALLBACK_PINNED;
  const anchorCost = validation?.expected_band?.net_cost ?? DOR_ANCHOR_ANNUAL_COST;
  const anchorLabel = validation?.expected_band?.source ?? DOR_ANCHOR_LABEL;
  const provenance = validation?.provenance ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-primary mb-2">Validation</h2>
        <p className="text-gray-600 max-w-prose">
          How this dashboard&apos;s pinned Montana run for tax year{' '}
          {REFORM_START_YEAR} was reconciled against the Montana Department
          of Revenue&apos;s own published revenue estimate.
        </p>
      </div>

      {/* Verdict strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VerdictTile
          title="Pinned run (this dashboard)"
          status={hasPinned ? 'Pinned run' : 'Pending pinned run'}
          value={fmtM(pinnedRun.net_cost)}
          detail={`Montana state income-tax revenue change for ${pinnedRun.year}, on the state-calibrated MT.h5 dataset.`}
          tone={hasPinned ? 'neutral' : 'pending'}
        />
        <VerdictTile
          title="External anchor: Montana DOR"
          status="Published estimate"
          value={fmtM(anchorCost)}
          detail={`${anchorLabel}. FY2029 corresponds approximately to tax year ${REFORM_START_YEAR}.`}
          tone="neutral"
        />
      </div>

      {/* Comparison table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Pinned run vs Montana DOR estimate
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left px-4 py-3 font-medium text-gray-900">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-900">Basis</th>
                <th className="text-right px-4 py-3 font-medium text-gray-900">Annual revenue change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-900">This dashboard (pinned MT.h5 run)</td>
                <td className="px-4 py-3 text-gray-700">Tax year {pinnedRun.year}</td>
                <td className={`px-4 py-3 text-right ${hasPinned ? 'text-gray-700' : 'text-gray-400 italic'}`}>
                  {hasPinned ? fmtM(pinnedRun.net_cost) : 'Pending pinned run'}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-900">Montana Department of Revenue</td>
                <td className="px-4 py-3 text-gray-700">2029 Biennium Outlook, FY2029</td>
                <td className="px-4 py-3 text-gray-700 text-right">{fmtM(anchorCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2 italic">
          Both figures are Montana&apos;s own annual revenue change (negative
          = revenue loss). The federal SALT interaction accrues to the
          federal government and is excluded here.
        </p>
      </div>

      <details className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
        <summary className="cursor-pointer font-semibold text-gray-800">
          Methodology &amp; provenance
        </summary>
        <div className="mt-3 space-y-3 text-sm text-gray-700 max-w-prose">
          <p>
            Static analysis with no behavioral responses, Montana only,
            using the state-calibrated dataset. The revenue figure is
            Montana&apos;s own income-tax change; poverty uses the
            Supplemental Poverty Measure (SPM) and moves negligibly for a
            rate cut on higher earners.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-3 py-2 text-gray-500">Pinned run model</td>
                  <td className="px-3 py-2">{provenance ? `policyengine-us ${provenance.policyengine_us}` : 'Pending pinned run'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">Pinned run dataset</td>
                  <td className="px-3 py-2">{provenance?.dataset ?? 'Pending pinned run'}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">External anchor</td>
                  <td className="px-3 py-2">{anchorLabel}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-500">Pinned run computed</td>
                  <td className="px-3 py-2">{provenance?.run_timestamp ?? 'Pending pinned run'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            The reform is the flat {`${(4.7).toFixed(1)}%`} rate applied to
            both ordinary-rate brackets across all five filing statuses
            (reform.json at the repository root is the canonical parameter
            set).
          </p>
        </div>
      </details>
    </div>
  );
}
