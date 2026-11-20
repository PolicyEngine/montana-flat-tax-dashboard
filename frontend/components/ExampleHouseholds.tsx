'use client';

import { useEffect, useState } from 'react';
import type { HouseholdImpactResponse } from '@/lib/types';
import { DEFAULT_YEAR, YEAR_SUMMARY, type ReformYear } from '@/lib/montana';

export interface ExampleHouseholdProfile {
  label: string;
  income: number;
  age_head: number;
  married: boolean;
  dependents: number[];
  state_code: string;
}

interface ChartArrays {
  income_range: number[];
  net_income_change: number[];
  state_tax_change: number[];
  federal_tax_change: number[];
  provisions?: import('@/lib/types').ProvisionSeries;
}

/** One record in public/data/example_households_{year}.json (produced by
 *  scripts/compute_example_households.py). */
interface ExampleHousehold {
  label: string;
  income: number;
  age_head: number;
  married: boolean;
  dependents: number[];
  baseline: {
    household_net_income: number;
    state_income_tax: number;
    income_tax: number;
  };
  reform: {
    household_net_income: number;
    state_income_tax: number;
    income_tax: number;
  };
  net_income_change: number;
  federal_tax_change: number;
  provisions_at_income?: import('@/lib/types').ProvisionBreakdown;
  chart: ChartArrays;
}

interface Payload {
  year: number;
  state_code?: string;
  households: ExampleHousehold[];
}

const fmtCurrency = (v: number) =>
  `$${Math.round(v).toLocaleString('en-US')}`;

const fmtSigned = (v: number) => {
  const base = fmtCurrency(Math.abs(v));
  if (v > 0) return `+${base}`;
  if (v < 0) return `-${base}`;
  return base;
};

/** Build a HouseholdImpactResponse-shaped payload from one of the
 *  precomputed example records, so the existing ImpactAnalysis chart
 *  can render it without firing a live API call. */
function toImpactResponse(h: ExampleHousehold): HouseholdImpactResponse {
  const xMax = h.chart.income_range[h.chart.income_range.length - 1];
  const stateTaxChange =
    h.reform.state_income_tax - h.baseline.state_income_tax;
  return {
    income_range: h.chart.income_range,
    net_income_change: h.chart.net_income_change,
    federalTaxChange: h.chart.federal_tax_change,
    stateTaxChange: h.chart.state_tax_change,
    netIncomeChange: h.chart.net_income_change,
    provisions: h.chart.provisions,
    provisions_at_income: h.provisions_at_income,
    benefit_at_income: {
      baseline: h.baseline.household_net_income,
      reform: h.reform.household_net_income,
      difference: h.net_income_change,
      federal_tax_change: h.federal_tax_change,
      state_tax_change: stateTaxChange,
      net_income_change: h.net_income_change,
    },
    x_axis_max: xMax,
  };
}

interface Props {
  /** Fires when a card is clicked; parent populates the household form
   *  and passes the precomputed response into ImpactAnalysis. */
  onSelect: (
    profile: ExampleHouseholdProfile,
    response: HouseholdImpactResponse,
  ) => void;
  /** Label of the currently active example, so the matching card can
   *  highlight itself. */
  selectedLabel?: string | null;
  /** Tax year whose precomputed examples to load. */
  year?: ReformYear;
}

export default function ExampleHouseholds({
  onSelect,
  selectedLabel,
  year = DEFAULT_YEAR,
}: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const basePath =
      process.env.NEXT_PUBLIC_BASE_PATH !== undefined
        ? process.env.NEXT_PUBLIC_BASE_PATH
        : '/us/montana-flat-tax-dashboard';
    let cancelled = false;
    fetch(`${basePath}/data/example_households_${year}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then((j: Payload) => {
        if (cancelled) return;
        setData(j);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  if (error) return null;
  if (!data || data.year !== year) return null;

  const stateCode = data.state_code ?? 'MT';

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        Example households
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        Tax year {year} ({YEAR_SUMMARY[year]}). Click an example to load its
        profile into the calculator and render its net-income chart
        instantly. Charts come from precomputed values; no live API call.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.households.map((h, i) => {
          const isGain = h.net_income_change > 0;
          const isSelected = selectedLabel === h.label;
          return (
            <button
              key={i}
              type="button"
              onClick={() =>
                onSelect(
                  {
                    label: h.label,
                    income: h.income,
                    age_head: h.age_head,
                    married: h.married,
                    dependents: h.dependents,
                    state_code: stateCode,
                  },
                  toImpactResponse(h),
                )
              }
              className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                isSelected
                  ? 'ring-2 ring-primary-500 ring-offset-1 bg-white border-primary-500'
                  : isGain
                    ? 'bg-green-50 border-success hover:border-green-500'
                    : h.net_income_change < 0
                      ? 'bg-red-50 border-red-300 hover:border-red-400'
                      : 'bg-gray-50 border-gray-300 hover:border-gray-400'
              }`}
            >
              <p className="text-sm font-semibold text-gray-800">{h.label}</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  isGain
                    ? 'text-green-600'
                    : h.net_income_change < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                }`}
              >
                {fmtSigned(h.net_income_change)}/year
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 italic mt-2">
        Income change is the proposal minus current law. Single parents file
        head of household. Married couples file jointly. Examples use Montana
        residence and employment income only. Households gain when they
        receive the earned income tax credit or have taxable income above the
        bracket thresholds; edit the form below for your own household.
      </p>
    </div>
  );
}
