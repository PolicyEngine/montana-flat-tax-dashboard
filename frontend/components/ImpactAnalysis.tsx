'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useHouseholdImpact } from '@/hooks/useHouseholdImpact';
import type { HouseholdImpactResponse, HouseholdRequest } from '@/lib/types';
import { DEFAULT_YEAR, YEAR_SUMMARY, type ReformYear } from '@/lib/montana';
import ChartWatermark from './ChartWatermark';

interface Props {
  request: HouseholdRequest | null;
  triggered: boolean;
  maxEarnings?: number;
  /** When supplied, the chart renders this precomputed payload instead
   * of firing a live API request. */
  precomputed?: HouseholdImpactResponse | null;
}

const formatCurrency = (value: number) =>
  `$${Math.round(value).toLocaleString('en-US')}`;
const formatCurrencyWithSign = (value: number) => {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
};
const formatIncome = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${(value / 1000).toFixed(0)}k`;
};

/** Provision display order and labels, shared by the tooltip and the
 *  breakdown panel. Values are from the household's point of view
 *  (positive = gain) and sum to the net income change. */
const PROVISION_ROWS = [
  { key: 'rate_change', label: 'Lower top income tax rate' },
  { key: 'eitc_change', label: 'Montana EITC increase' },
  { key: 'federal_tax_change', label: 'Federal income tax' },
] as const;

type ProvisionKey = (typeof PROVISION_ROWS)[number]['key'];
type ProvisionPoint = Partial<Record<ProvisionKey, number>>;

// Custom tooltip: net income change with a per-provision breakdown at
// the hovered income point (rows sum to the net change). Falls back to
// the federal/net summary when provision series are unavailable (older
// cached results). Module-level so it is not recreated on every render
// (react-hooks/static-components).
const HoverTooltip = ({
  active,
  payload,
  label,
  showState,
}: {
  active?: boolean;
  payload?: Array<{ payload: {
    income: number;
    federalTaxChange: number;
    stateTaxChange: number;
    netIncomeChange: number;
    provisionPoint?: ProvisionPoint;
  } }>;
  label?: number;
  showState?: boolean;
}) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const incomeLabel = typeof label === 'number' ? label : p.income;
  const provisionPoint = p.provisionPoint;
  return (
    <div
      style={{
        background: 'var(--chart-tooltip-bg)',
        border: '1px solid var(--chart-tooltip-border)',
        borderRadius: 4,
        padding: '8px 12px',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
      }}
    >
      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>
        Income: {formatCurrency(Math.round(incomeLabel / 100) * 100)}
      </p>
      {provisionPoint ? (
        PROVISION_ROWS.filter(
          (row) => Math.abs(provisionPoint[row.key] ?? 0) > 0.5,
        ).map((row) => (
          <p key={row.key} style={{ margin: 0 }}>
            {row.label}: {formatCurrencyWithSign(provisionPoint[row.key] ?? 0)}
          </p>
        ))
      ) : (
        <>
          <p style={{ margin: 0 }}>
            Federal tax change: {formatCurrencyWithSign(p.federalTaxChange)}
          </p>
          {showState && (
            <p style={{ margin: 0 }}>
              Montana income tax change: {formatCurrencyWithSign(p.stateTaxChange)}
            </p>
          )}
        </>
      )}
      <p style={{ margin: '4px 0 0', fontWeight: 600, borderTop: '1px solid var(--chart-tooltip-border)', paddingTop: 4 }}>
        Net income change: {formatCurrencyWithSign(p.netIncomeChange)}
      </p>
    </div>
  );
};

export default function ImpactAnalysis({
  request,
  triggered,
  maxEarnings,
  precomputed,
}: Props) {
  const liveQuery = useHouseholdImpact(request, triggered && !precomputed);
  const data = precomputed ?? liveQuery.data;
  const isLoading = !precomputed && liveQuery.isLoading;
  const error = precomputed ? null : liveQuery.error;

  if (!triggered) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Calculating impact...</p>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            The calculator runs your household through the PolicyEngine API
            under current law and the proposal; this can take a few seconds.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as Error).message;
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-yellow-800 font-semibold mb-2">Household calculator temporarily unavailable</h2>
        <p className="text-yellow-700">{errorMessage}</p>
        <p className="text-yellow-700 mt-2">
          Please retry in a moment, or view the <strong>Statewide impact</strong>{' '}
          tab for precomputed results.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const year = (request?.year ?? DEFAULT_YEAR) as ReformYear;
  const benefitData = data.benefit_at_income;

  const federalTaxChangePoint = benefitData.federal_tax_change;
  const stateTaxChangePoint = benefitData.state_tax_change;
  const netIncomeChangePoint = benefitData.net_income_change;

  const xMax = maxEarnings ?? data.x_axis_max;

  const federalTaxChangeSeries = data.federalTaxChange;
  const stateTaxChangeSeries = data.stateTaxChange;
  const netIncomeChangeSeries = data.netIncomeChange;

  // Both provisions change Montana state income tax; show the state
  // line whenever it moves.
  const hasStateChange =
    stateTaxChangeSeries.some((v) => Math.abs(v) > 0.5) ||
    Math.abs(stateTaxChangePoint) > 0.5;

  const provisionSeries = data.provisions;
  const chartData = data.income_range
    .map((inc, i) => ({
      income: inc,
      benefit: netIncomeChangeSeries[i],
      federalTaxChange: federalTaxChangeSeries[i],
      stateTaxChange: stateTaxChangeSeries[i],
      netIncomeChange: netIncomeChangeSeries[i],
      provisionPoint: provisionSeries
        ? Object.fromEntries(
            PROVISION_ROWS.map((row) => [row.key, provisionSeries[row.key][i]]),
          ) as ProvisionPoint
        : undefined,
    }))
    .filter((d) => d.income <= xMax);

  // For tax-change metrics (federal, state), a REDUCTION (negative) is good
  // for the household, so we flip the color sign. For net income change,
  // a positive value is good for the household (no flip).
  const metricCard = (label: string, value: number, lowerIsBetter = false) => {
    const beneficial = lowerIsBetter ? value < 0 : value > 0;
    const harmful = lowerIsBetter ? value > 0 : value < 0;
    return (
      <div
        className={`rounded-lg p-6 border ${
          beneficial
            ? 'bg-green-50 border-success'
            : harmful
            ? 'bg-red-50 border-red-300'
            : 'bg-gray-50 border-gray-300'
        }`}
      >
        <p className="text-sm text-gray-700 mb-2">{label}</p>
        <p
          className={`text-3xl font-bold ${
            beneficial ? 'text-green-600' : harmful ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {value !== 0 ? `${formatCurrencyWithSign(value)}/year` : '$0/year'}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-primary">Impact analysis</h2>

      {/* Personal impact */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Your household impact from the Montana proposal ({year})
        </h3>
        <p className="text-gray-600 mb-4">
          Based on your employment income of <strong>{formatCurrency(request?.income ?? 0)}</strong>,
          comparing the proposal for tax year {year} ({YEAR_SUMMARY[year]}) to
          current law. The lower top rate reduces Montana income tax on
          taxable income above the bracket threshold. The EITC increase
          raises the Montana credit for households that receive the federal
          earned income tax credit.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {metricCard('Net income change', netIncomeChangePoint)}
          {data.provisions_at_income ? (
            <div className="rounded-lg p-4 border border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-700 mb-2 font-semibold">By provision</p>
              <dl className="space-y-1">
                {PROVISION_ROWS.filter(
                  (row) => Math.abs(data.provisions_at_income![row.key]) > 0.5,
                ).map((row) => {
                  const v = data.provisions_at_income![row.key];
                  return (
                    <div key={row.key} className="flex justify-between text-sm">
                      <dt className="text-gray-600">{row.label}</dt>
                      <dd className={v > 0 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                        {formatCurrencyWithSign(v)}
                      </dd>
                    </div>
                  );
                })}
                <div className="flex justify-between text-sm border-t border-gray-300 pt-1 mt-1">
                  <dt className="text-gray-800 font-semibold">Net income change</dt>
                  <dd className={`font-semibold ${netIncomeChangePoint >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatCurrencyWithSign(netIncomeChangePoint)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-4 ${hasStateChange ? 'md:grid-cols-2' : ''}`}>
              {hasStateChange && metricCard('Montana income tax change', stateTaxChangePoint, true)}
              {metricCard('Federal tax change', federalTaxChangePoint, true)}
            </div>
          )}
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Chart */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-1 text-gray-800">
          Change in net income under the Montana proposal
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Proposal vs. current law ({year}), by employment income
        </p>
        <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="income"
                type="number"
                tickFormatter={formatIncome}
                stroke="var(--chart-reference)"
                domain={[0, xMax]}
                allowDataOverflow={false}
              />
              <YAxis tickFormatter={formatCurrency} stroke="var(--chart-reference)" width={80} />
              <Tooltip content={<HoverTooltip showState={hasStateChange} />} />
              <Legend />
              <ReferenceLine y={0} stroke="var(--chart-reference)" strokeWidth={2} />
              <Line
                type="monotone"
                dataKey="benefit"
                stroke="var(--chart-positive)"
                strokeWidth={3}
                name="Net income change"
                dot={false}
              />
              {hasStateChange && (
                <Line
                  type="monotone"
                  dataKey="stateTaxChange"
                  stroke="var(--chart-negative)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Montana income tax change"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        <ChartWatermark />
      </div>
    </div>
  );
}
