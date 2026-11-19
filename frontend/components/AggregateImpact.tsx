'use client';

import { useState } from 'react';
import {
  useAggregateImpact,
  YearNotAvailableError,
} from '@/hooks/useAggregateImpact';
import { DEFAULT_YEAR, YEAR_SUMMARY, type ReformYear } from '@/lib/montana';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import ChartWatermark from './ChartWatermark';

// App-v2 color tokens using CSS variables
const COLORS = {
  gainMore5: 'var(--chart-gain-more-5)',
  gainLess5: 'var(--chart-gain-less-5)',
  noChange: 'var(--chart-no-change)',
  loseLess5: 'var(--chart-lose-less-5)',
  loseMore5: 'var(--chart-lose-more-5)',
  positive: 'var(--chart-positive)',
  negative: 'var(--chart-negative)',
};

// Shared chart margins
const CHART_MARGIN = { top: 20, right: 20, bottom: 30, left: 60 };

// Shared axis tick style
const TICK_STYLE = { fontFamily: 'var(--font-sans)', fontSize: 12 };

// Custom tooltip component
function CustomTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--chart-tooltip-bg)',
      border: '1px solid var(--chart-tooltip-border)',
      borderRadius: 4,
      padding: '8px 12px',
      fontFamily: 'var(--font-sans)',
      fontSize: 12,
    }}>
      {label && <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text-heading)' }}>{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: 0, color: entry.color || 'var(--text-body)' }}>
          {entry.name}: {formatter ? formatter(entry.value, entry.name) : entry.value}
        </p>
      ))}
    </div>
  );
}

interface Props {
  triggered: boolean;
  /** Tax year to show; the page-level year toggle sets it. */
  year?: ReformYear;
}

export default function AggregateImpact({ triggered, year = DEFAULT_YEAR }: Props) {
  const selectedYear = year;
  const { data, isLoading, error } = useAggregateImpact(triggered, selectedYear);
  const [activeSection, setActiveSection] = useState<'fiscal' | 'distributional' | 'winners' | 'poverty'>('fiscal');
  const [distMode, setDistMode] = useState<'relative' | 'absolute'>('relative');

  if (!triggered) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading statewide impact data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isMissingYear = error instanceof YearNotAvailableError;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-primary">Statewide impact analysis</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-gray-800 font-semibold mb-2">
            {isMissingYear
              ? `Statewide impact data for ${selectedYear} not yet available`
              : 'Statewide impact data not yet available'}
          </h3>
          <p className="text-gray-600 font-medium mb-2">{errorMessage}</p>
          <p className="text-sm text-gray-500 mt-4">
            {isMissingYear
              ? 'Select another tax year above, or check back after the data pipeline has produced this year.'
              : 'Precomputed data has not been generated yet.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) =>
    `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const formatCurrencyWithSign = (value: number) => {
    const formatted = formatCurrency(value);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  };
  const formatMillions = (value: number) => {
    const abs = Math.abs(value);
    const sign = value >= 0 ? '+' : '-';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    return formatCurrencyWithSign(value);
  };

  // Section tabs
  const sections = [
    { key: 'fiscal' as const, label: 'Revenue impact' },
    { key: 'distributional' as const, label: 'Distributional impact' },
    { key: 'winners' as const, label: 'Winners & losers' },
    { key: 'poverty' as const, label: 'Poverty impact' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Statewide impact analysis</h2>
        <p className="text-sm text-gray-600 mt-1">
          Tax year {selectedYear} ({YEAR_SUMMARY[selectedYear]}), compared with current law.
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === s.key
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ===== REVENUE IMPACT ===== */}
      {activeSection === 'fiscal' && (
        <div className="space-y-6">
          {(() => {
            const b = data.budget;
            // Montana's own fiscal cost is the state income-tax revenue
            // change (negative = revenue loss). The federal interaction
            // (reduced SALT deductions) accrues to the federal
            // government and is reported separately.
            const stateImpact = b.state_tax_revenue_impact;
            const federalImpact = b.federal_tax_revenue_impact;
            return (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">State revenue impact ({selectedYear})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`rounded-lg p-5 border ${
                    stateImpact >= 0 ? 'bg-green-50 border-success' : 'bg-red-50 border-red-300'
                  }`}>
                    <p className="text-sm text-gray-700 mb-2">Montana state income tax</p>
                    <p className={`text-2xl font-bold ${
                      stateImpact >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatMillions(stateImpact)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Change in Montana individual income tax revenue from both provisions.
                    </p>
                  </div>
                  <div className="rounded-lg p-5 border bg-gray-50 border-gray-300">
                    <p className="text-sm text-gray-700 mb-2">Federal income tax</p>
                    <p className="text-2xl font-bold text-gray-700">
                      {formatMillions(federalImpact)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Accrues to the federal government, not Montana: a smaller Montana tax bill reduces itemizers&apos; federal deductions for state and local taxes (SALT).
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Montana&apos;s own fiscal cost is the {formatMillions(stateImpact)} state figure. The federal interaction is shown for completeness and does not affect the Montana budget.
                </p>
                {b.rate_cut_state_revenue_impact != null && b.eitc_state_revenue_impact != null && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">By provision ({selectedYear})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-lg p-5 border bg-white border-gray-300">
                        <p className="text-sm text-gray-700 mb-2">
                          {selectedYear === 2028 ? 'Top rate 5.4% to 5.0%' : 'Top rate 5.4% to 4.7% (flat rate)'}
                        </p>
                        <p className="text-2xl font-bold text-gray-800">
                          {formatMillions(b.rate_cut_state_revenue_impact)}
                        </p>
                      </div>
                      <div className="rounded-lg p-5 border bg-white border-gray-300">
                        <p className="text-sm text-gray-700 mb-2">EITC 20% to 30% of the federal credit</p>
                        <p className="text-2xl font-bold text-gray-800">
                          {formatMillions(b.eitc_state_revenue_impact)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Each provision is modeled on its own against current law. Montana state income tax revenue only.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Income bracket table */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Impact by income bracket</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left px-4 py-3 font-medium text-gray-900">Income bracket</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-900">Households gaining</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-900">Total gain</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-900">Average gain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.by_income_bracket.map((bracket, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900">{bracket.bracket}</td>
                      <td className="px-4 py-3 text-gray-700 text-right">{Math.round(bracket.beneficiaries).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-right"
                        style={{ color: bracket.total_cost >= 0 ? COLORS.positive : COLORS.negative }}>
                        {formatMillions(bracket.total_cost)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-right"
                        style={{ color: bracket.avg_benefit >= 0 ? COLORS.positive : COLORS.negative }}>
                        {formatCurrencyWithSign(bracket.avg_benefit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-3 italic">
              Households are grouped by federal adjusted gross income. The table counts households whose net income rises and shows their total and average gain. The EITC increase reaches households with earnings in the federal credit&apos;s range; the rate cut reaches households with taxable income above the bracket thresholds.
            </p>
          </div>
        </div>
      )}

      {/* ===== DISTRIBUTIONAL IMPACT ===== */}
      {activeSection === 'distributional' && (() => {
        const isRelative = distMode === 'relative';
        const rawValues = isRelative
          ? Object.entries(data.decile.relative)
              .map(([, v]) => v * 100)
          : Object.values(data.decile.average);
        const maxAbs = Math.max(...rawValues.map(Math.abs));
        const niceStep = (() => {
          const rough = maxAbs / 3;
          const mag = Math.pow(10, Math.floor(Math.log10(rough)));
          const residual = rough / mag;
          if (residual <= 1) return mag;
          if (residual <= 2) return 2 * mag;
          if (residual <= 5) return 5 * mag;
          return 10 * mag;
        })();
        const niceMax = Math.ceil(maxAbs / niceStep) * niceStep;
        const symmetricDomain = [-niceMax, niceMax];
        const niceTicks = Array.from(
          { length: Math.round(2 * niceMax / niceStep) + 1 },
          (_, i) => -niceMax + i * niceStep,
        );
        const chartData = isRelative
          ? Object.entries(data.decile.relative).map(([k, v]) => ({
              decile: k,
              value: v * 100,
            }))
          : Object.entries(data.decile.average).map(([k, v]) => ({ decile: k, value: v }));

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-lg font-semibold text-gray-800">Impact by income decile</h3>
              <div className="flex gap-1">
                {(['relative', 'absolute'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setDistMode(mode)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      distMode === mode
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {mode === 'relative' ? 'Relative' : 'Absolute'}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-gray-700">
              {isRelative
                ? 'Change in household net income as a percentage of baseline income, by decile.'
                : 'Average change in household net income in dollars, by decile.'}
            </p>
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="decile" tick={TICK_STYLE} stroke="var(--chart-axis)" label={{ value: 'Income decile', position: 'insideBottom', offset: -15, style: { ...TICK_STYLE, fill: 'var(--chart-axis-label)' } }} />
                  <YAxis
                    domain={symmetricDomain}
                    ticks={niceTicks}
                    tickFormatter={isRelative
                      ? (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
                      : formatCurrencyWithSign}
                    tick={TICK_STYLE}
                    stroke="var(--chart-axis)"
                    width={isRelative ? 60 : 80}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip formatter={isRelative
                    ? (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
                    : (v) => formatCurrencyWithSign(v)} />}
                  />
                  <ReferenceLine y={0} stroke="var(--chart-axis)" strokeWidth={1} />
                  <Bar dataKey="value" name={isRelative ? 'Relative impact (% of income)' : 'Average impact'} radius={[2, 2, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={(d.value ?? 0) >= 0 ? COLORS.positive : COLORS.negative} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            <ChartWatermark />
            <p className="text-xs text-gray-500 mt-3 italic">
              Distributional impacts are calculated at the household level. A household may contain multiple tax units (e.g., an adult child living with parents who files separately). Deciles rank households by net income. Gains in the lower deciles come from the EITC increase; gains in the upper deciles come from the lower top rate, which applies only to taxable income above the bracket thresholds.
            </p>
          </div>
        );
      })()}

      {/* ===== WINNERS & LOSERS ===== */}
      {activeSection === 'winners' && (() => {
        const intra = data.intra_decile;
        const categories = [
          { key: 'gain_more_than_5pct', label: 'Gain more than 5%', color: COLORS.gainMore5 },
          { key: 'gain_less_than_5pct', label: 'Gain less than 5%', color: COLORS.gainLess5 },
          { key: 'no_change', label: 'No change', color: COLORS.noChange },
          { key: 'lose_less_than_5pct', label: 'Lose less than 5%', color: COLORS.loseLess5 },
          { key: 'lose_more_than_5pct', label: 'Lose more than 5%', color: COLORS.loseMore5 },
        ] as const;

        const stackedData = [
          {
            label: 'All',
            ...Object.fromEntries(categories.map(c => [c.key, (intra.all[c.key] * 100)])),
          },
          ...Array.from({ length: 10 }, (_, i) => {
            const d = 10 - i;
            return {
              label: `${d}`,
              ...Object.fromEntries(categories.map(c => [c.key, (intra.deciles[c.key][d - 1] * 100)])),
            };
          }),
        ];

        return (
          <div className="space-y-6">
            {/* Headline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg p-6 border" style={{ backgroundColor: 'var(--chart-winners-bg)', borderColor: COLORS.positive }}>
                <p className="text-sm text-gray-700 mb-2">Winners</p>
                <p className="text-3xl font-bold" style={{ color: COLORS.gainMore5 }}>{data.winners_rate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">{Math.round(data.winners).toLocaleString()} residents gain</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-300">
                <p className="text-sm text-gray-700 mb-2">No change</p>
                <p className="text-3xl font-bold text-gray-600">
                  {(100 - data.winners_rate - data.losers_rate).toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg p-6 border" style={{ backgroundColor: 'var(--chart-losers-bg)', borderColor: COLORS.loseMore5 }}>
                <p className="text-sm text-gray-700 mb-2">Losers</p>
                <p className="text-3xl font-bold" style={{ color: COLORS.loseMore5 }}>{data.losers_rate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">{Math.round(data.losers).toLocaleString()} residents lose</p>
              </div>
            </div>

            {/* Stacked bar chart by decile */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Winners & losers by income decile</h3>
              <div className="bg-white border rounded-lg p-6">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={stackedData} layout="vertical" stackOffset="expand" barSize={24} margin={CHART_MARGIN}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
                      <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={TICK_STYLE} stroke="var(--chart-axis)" />
                      <YAxis type="category" dataKey="label" tick={TICK_STYLE} stroke="var(--chart-axis)" width={40} />
                      <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)}%`} />} />
                      {categories.map((c) => (
                        <Bar key={c.key} dataKey={c.key} stackId="a" fill={c.color} name={c.label} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                <ChartWatermark />
                {/* Custom legend */}
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {categories.map((c) => (
                    <div key={c.key} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color }} />
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-body)' }}>{c.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3 italic">
                  Winners and losers count residents: a person gains or loses when their household&apos;s net income changes by more than $1. The model estimates the federal deduction for state and local taxes from an approximation of state income tax withheld on wages. For a small share of households that approximation falls while their computed Montana tax does not, so their modeled federal tax rises and they show as losing.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== POVERTY IMPACT ===== */}
      {activeSection === 'poverty' && (() => {
        const povertyRows = [
          { label: 'All residents', group: data.poverty.poverty.all },
          { label: 'Children (under 18)', group: data.poverty.poverty.child },
        ];
        const fmtRate = (v: number) => `${v.toFixed(2)}%`;
        const fmtPoints = (v: number) =>
          Math.abs(v) < 0.005 ? '0.00' : `${v > 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}`;
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Poverty impact ({selectedYear})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left px-4 py-3 font-medium text-gray-900">Group</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-900">Current law</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-900">Proposal</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-900">Change (percentage points)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {povertyRows.map((row) => (
                    <tr key={row.label} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900">{row.label}</td>
                      <td className="px-4 py-3 text-gray-700 text-right">{fmtRate(row.group.baseline)}</td>
                      <td className="px-4 py-3 text-gray-700 text-right">{fmtRate(row.group.reform)}</td>
                      <td className="px-4 py-3 text-gray-700 text-right">
                        {fmtPoints(row.group.reform - row.group.baseline)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 italic max-w-prose">
              Poverty uses the Supplemental Poverty Measure (SPM). The change comes from the EITC increase, a refundable credit that raises after-tax income for households with earnings; the rate cut applies to taxable income above the bracket thresholds. The dataset is calibrated mainly to tax and demographic targets, so its poverty rates can differ from Census Bureau estimates, and the change rests on a small number of sampled Montana households near the poverty threshold.
            </p>
          </div>
        );
      })()}

      <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
        These estimates are static: they do not capture behavioral responses such as changes in labor supply, tax avoidance, or migration.
      </p>
    </div>
  );
}
