import { useQuery } from "@tanstack/react-query";
import parseCSV from "@/lib/parseCSV";
import { AggregateImpactResponse, IntraDecileAll, IntraDecileDeciles } from "@/lib/types";

/** Canonical low-to-high order for the income-bracket table. The
 *  underlying CSV from the pipeline can return brackets in any
 *  order, so the hook sorts before handing them to the table. */
const BRACKET_ORDER = [
  "$0 - $25k",
  "$25k - $50k",
  "$50k - $75k",
  "$75k - $100k",
  "$100k - $150k",
  "$150k - $200k",
  "$200k+",
];

/** Thrown when the pipeline has not yet produced rows for a year. */
export class YearNotAvailableError extends Error {
  year: number;
  constructor(year: number) {
    super(`Data for ${year} has not been generated yet.`);
    this.name = "YearNotAvailableError";
    this.year = year;
  }
}

async function fetchCSV(filename: string): Promise<Record<string, string | number>[]> {
  // Use same default as next.config.js
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : "/us/montana-flat-tax-dashboard";
  const res = await fetch(`${basePath}/data/${filename}`);
  if (!res.ok) throw new Error(`Failed to load ${filename}`);
  const text = await res.text();
  return parseCSV(text);
}

function buildAggregateResponse(year: number): Promise<AggregateImpactResponse> {
  return Promise.all([
    fetchCSV("distributional_impact.csv"),
    fetchCSV("metrics.csv"),
    fetchCSV("winners_losers.csv"),
    fetchCSV("income_brackets.csv"),
  ]).then(([distributional, metrics, winnersLosers, incomeBrackets]) => {
    // Filter by year
    const dist = distributional.filter((r) => r.year === year);
    const met = metrics.filter((r) => r.year === year);
    const wl = winnersLosers.filter((r) => r.year === year);
    const ib = incomeBrackets.filter((r) => r.year === year);

    // Render gracefully when the pipeline has only produced some years
    // (e.g. 2026 only at first): surface a typed, friendly error.
    if (met.length === 0 || wl.length === 0) {
      throw new YearNotAvailableError(year);
    }

    // Build metrics lookup
    const m = Object.fromEntries(met.map((r) => [r.metric, r.value as number]));

    // Build decile objects
    const decileAverage: Record<string, number> = {};
    const decileRelative: Record<string, number> = {};
    for (const row of dist) {
      decileAverage[row.decile as string] = row.average_change as number;
      decileRelative[row.decile as string] = row.relative_change as number;
    }

    // Build intra-decile
    const allRow = wl.find((r) => r.decile === "All");
    if (!allRow) throw new YearNotAvailableError(year);
    const intraAll: IntraDecileAll = {
      gain_more_than_5pct: allRow.gain_more_5pct as number,
      gain_less_than_5pct: allRow.gain_less_5pct as number,
      no_change: allRow.no_change as number,
      lose_less_than_5pct: allRow.lose_less_5pct as number,
      lose_more_than_5pct: allRow.lose_more_5pct as number,
    };

    const decileRows = wl.filter((r) => r.decile !== "All").sort(
      (a, b) => Number(a.decile) - Number(b.decile)
    );
    const intraDeciles: IntraDecileDeciles = {
      gain_more_than_5pct: decileRows.map((r) => r.gain_more_5pct as number),
      gain_less_than_5pct: decileRows.map((r) => r.gain_less_5pct as number),
      no_change: decileRows.map((r) => r.no_change as number),
      lose_less_than_5pct: decileRows.map((r) => r.lose_less_5pct as number),
      lose_more_than_5pct: decileRows.map((r) => r.lose_more_5pct as number),
    };

    return {
      budget: {
        baseline_net_income: m.baseline_net_income,
        budgetary_impact: m.budgetary_impact,
        federal_tax_revenue_impact: m.federal_tax_revenue_impact ?? 0,
        state_tax_revenue_impact: m.state_tax_revenue_impact ?? m.budgetary_impact,
        tax_revenue_impact: m.tax_revenue_impact,
        households: m.households,
      },
      decile: { average: decileAverage, relative: decileRelative },
      intra_decile: { all: intraAll, deciles: intraDeciles },
      poverty: {
        poverty: {
          all: { baseline: m.poverty_baseline_rate, reform: m.poverty_reform_rate },
          child: { baseline: m.child_poverty_baseline_rate, reform: m.child_poverty_reform_rate },
        },
        deep_poverty: {
          all: { baseline: m.deep_poverty_baseline_rate, reform: m.deep_poverty_reform_rate },
          child: { baseline: m.deep_child_poverty_baseline_rate, reform: m.deep_child_poverty_reform_rate },
        },
      },
      total_cost: m.total_cost,
      beneficiaries: m.beneficiaries,
      avg_benefit: m.avg_benefit,
      winners: m.winners,
      losers: m.losers,
      winners_rate: m.winners_rate,
      losers_rate: m.losers_rate,
      poverty_baseline_rate: m.poverty_baseline_rate,
      poverty_reform_rate: m.poverty_reform_rate,
      poverty_rate_change: m.poverty_rate_change,
      poverty_percent_change: m.poverty_percent_change,
      child_poverty_baseline_rate: m.child_poverty_baseline_rate,
      child_poverty_reform_rate: m.child_poverty_reform_rate,
      child_poverty_rate_change: m.child_poverty_rate_change,
      child_poverty_percent_change: m.child_poverty_percent_change,
      deep_poverty_baseline_rate: m.deep_poverty_baseline_rate,
      deep_poverty_reform_rate: m.deep_poverty_reform_rate,
      deep_poverty_rate_change: m.deep_poverty_rate_change,
      deep_poverty_percent_change: m.deep_poverty_percent_change,
      deep_child_poverty_baseline_rate: m.deep_child_poverty_baseline_rate,
      deep_child_poverty_reform_rate: m.deep_child_poverty_reform_rate,
      deep_child_poverty_rate_change: m.deep_child_poverty_rate_change,
      deep_child_poverty_percent_change: m.deep_child_poverty_percent_change,
      by_income_bracket: ib
        .map((r) => ({
          bracket: r.bracket as string,
          beneficiaries: r.beneficiaries as number,
          total_cost: r.total_cost as number,
          avg_benefit: r.avg_benefit as number,
        }))
        .sort((a, b) => {
          const order = BRACKET_ORDER.indexOf(a.bracket);
          const orderB = BRACKET_ORDER.indexOf(b.bracket);
          return (
            (order === -1 ? Number.MAX_SAFE_INTEGER : order) -
            (orderB === -1 ? Number.MAX_SAFE_INTEGER : orderB)
          );
        }),
    };
  });
}

export function useAggregateImpact(
  enabled: boolean,
  year: number = 2028,
) {
  return useQuery<AggregateImpactResponse>({
    queryKey: ["aggregateImpact", year],
    queryFn: () => buildAggregateResponse(year),
    enabled,
    retry: (failureCount, error) =>
      error instanceof YearNotAvailableError ? false : failureCount < 3,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/** Sum a metric across the 2028-2035 window. Returns null unless the
 *  pipeline has produced rows for every year in the window, so the
 *  multi-year cards hide gracefully while only 2028 exists. */
function useTenYearMetric(enabled: boolean, metric: string) {
  return useQuery<number | null>({
    queryKey: ["multiYear", metric],
    queryFn: async () => {
      const rows = await fetchCSV("metrics.csv");
      const years = Array.from({ length: 8 }, (_, i) => 2028 + i);
      const perYear = years.map((year) =>
        rows.find((r) => r.year === year && r.metric === metric)
      );
      if (perYear.some((row) => row === undefined)) return null;
      return perYear.reduce((sum, row) => sum + (row!.value as number), 0);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useTenYearTotal(enabled: boolean) {
  return useTenYearMetric(enabled, "budgetary_impact");
}

export function useTenYearFederalTotal(enabled: boolean) {
  return useTenYearMetric(enabled, "federal_tax_revenue_impact");
}

export function useTenYearStateTotal(enabled: boolean) {
  return useTenYearMetric(enabled, "state_tax_revenue_impact");
}
