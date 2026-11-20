/**
 * Live household calculator for Montana's proposed flat income tax and
 * earned income tax credit increase.
 *
 * Calculations go through www.policyengine.org's dashboard API
 * (@policyengine/api-client), which forwards them to the PolicyEngine
 * Public API with PolicyEngine's credential. The Public API itself
 * (api.policyengine.org) refuses unauthenticated browser calls.
 *
 * For each request we build a Montana household from the form inputs and
 * make four calls, under current law (baseline) and under the proposal
 * (MT_REFORM):
 *
 *   - one at the entered income, for the point values;
 *   - one with an employment-income axis, for the earnings curve the
 *     ImpactAnalysis chart draws.
 *
 * The axis keeps a request to four calls; the dashboard API allows 30
 * household calculations a minute from one address. The impact is
 *
 *   impact = reform (governor's proposal) - baseline (current law)
 *
 * The change is split by provision from the household's point of view
 * (positive = gain): the Montana earned income tax credit change, the
 * remaining Montana income tax change (the rate change), and the federal
 * income tax change.
 */

import { createPolicyEngineApiClient } from '@policyengine/api-client';

import { MT_REFORM } from './montana';
import type { ProvisionBreakdown, ProvisionSeries } from './types';

export interface HouseholdSweepPayload {
  age_head: number;
  age_spouse: number | null;
  dependent_ages: number[];
  income: number;
  year: number;
  max_earnings: number;
  state_code?: string;
}

export interface HouseholdSweepResult {
  income_range: number[];
  net_income_change: number[];
  /** Reform minus baseline Montana state income tax at each sweep point. */
  state_income_tax_change: number[];
  /** Reform minus baseline federal income tax at each sweep point. */
  income_tax_change: number[];
  /** Per-provision gains at each sweep point (sum to the net change). */
  provisions: ProvisionSeries;
  provisions_at_income: ProvisionBreakdown;
  benefit_at_income: {
    baseline: number;
    reform: number;
    difference: number;
    federal_tax_change: number;
    state_tax_change: number;
  };
  point: {
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
  };
  x_axis_max: number;
}

/** Number of points on the employment-income axis. */
export const SWEEP_POINTS = 26;

type Reform = Record<string, Record<string, number>>;

/** A variable's values by period, as sent (null = compute it). */
type PeriodValues = Record<string, number | string | null>;

interface PeHousehold {
  people: Record<string, Record<string, PeriodValues>>;
  families: Record<string, { members: string[] }>;
  marital_units: Record<string, { members: string[] }>;
  tax_units: Record<string, Record<string, string[] | PeriodValues>>;
  spm_units: Record<string, { members: string[] }>;
  households: Record<string, Record<string, string[] | PeriodValues>>;
  axes?: Array<
    Array<{
      name: string;
      count: number;
      min: number;
      max: number;
      period: string;
    }>
  >;
}

/**
 * The calculated household. With an axis, each computed value is an
 * array with one entry per axis point; without one, a number.
 */
type ComputedEntity = Record<string, Record<string, unknown>>;
interface ComputedHousehold {
  people?: Record<string, ComputedEntity[string]>;
  tax_units?: Record<string, ComputedEntity[string]>;
  households?: Record<string, ComputedEntity[string]>;
}

const policyengine = createPolicyEngineApiClient();

/**
 * Build a PolicyEngine household for the given inputs, requesting
 * household_net_income (household), mt_income_tax and income_tax (tax
 * unit) and mt_eitc (person) for `year`. The Public API rejects a
 * variable requested on the wrong entity.
 *
 * Without `axis`, the head's employment_income is `payload.income`. With
 * it, the head's employment income runs from 0 to `axis.max` over
 * `axis.count` points. The spouse and dependents carry no earnings.
 */
export function buildHousehold(
  payload: HouseholdSweepPayload,
  year: number,
  axis?: { count: number; max: number },
): PeHousehold {
  const yr = String(year);
  const head: Record<string, PeriodValues> = {
    age: { [yr]: payload.age_head },
    mt_eitc: { [yr]: null },
  };
  if (!axis) head.employment_income = { [yr]: payload.income };
  const people: PeHousehold['people'] = { head };
  const memberNames = ['head'];

  if (payload.age_spouse != null) {
    people.spouse = {
      age: { [yr]: payload.age_spouse },
      employment_income: { [yr]: 0 },
      mt_eitc: { [yr]: null },
    };
    memberNames.push('spouse');
  }

  payload.dependent_ages.forEach((age, i) => {
    const name = `dependent_${i}`;
    people[name] = {
      age: { [yr]: age },
      employment_income: { [yr]: 0 },
    };
    memberNames.push(name);
  });

  const household: PeHousehold = {
    people,
    families: { family: { members: memberNames } },
    marital_units: {
      marital_unit:
        payload.age_spouse != null
          ? { members: ['head', 'spouse'] }
          : { members: ['head'] },
    },
    tax_units: {
      tax_unit: {
        members: memberNames,
        mt_income_tax: { [yr]: null },
        income_tax: { [yr]: null },
      },
    },
    spm_units: { spm_unit: { members: memberNames } },
    households: {
      household: {
        members: memberNames,
        state_name: { [yr]: payload.state_code ?? 'MT' },
        household_net_income: { [yr]: null },
      },
    },
  };
  if (axis) {
    household.axes = [
      [
        {
          name: 'employment_income',
          count: axis.count,
          min: 0,
          max: axis.max,
          period: yr,
        },
      ],
    ];
  }
  return household;
}

async function calculate(
  household: PeHousehold,
  reform: Reform | null,
): Promise<ComputedHousehold> {
  return policyengine.calculateHousehold<ComputedHousehold>({
    country: 'us',
    household: household as unknown as Record<string, unknown>,
    ...(reform ? { policy: reform } : {}),
  });
}

/** A computed value as `n` numbers (an axis array, or a repeated number). */
function asSeries(value: unknown, n: number): number[] {
  if (Array.isArray(value)) {
    if (value.length !== n) {
      throw new Error(
        `PolicyEngine API returned ${value.length} values where ${n} were expected.`,
      );
    }
    return value.map((v) => (typeof v === 'number' ? v : 0));
  }
  return new Array(n).fill(typeof value === 'number' ? value : 0);
}

function readGroup(
  group: Record<string, Record<string, unknown>> | undefined,
  name: string,
  key: string,
  year: number,
  n: number,
): number[] {
  const variable = group?.[name]?.[key] as Record<string, unknown> | undefined;
  return asSeries(variable?.[String(year)], n);
}

/** Sum a person-level variable across everyone in the household. */
function readPeopleSum(
  h: ComputedHousehold,
  key: string,
  year: number,
  n: number,
): number[] {
  const total = new Array(n).fill(0);
  for (const person of Object.values(h.people ?? {})) {
    const variable = person?.[key] as Record<string, unknown> | undefined;
    const values = asSeries(variable?.[String(year)], n);
    values.forEach((v, i) => (total[i] += v));
  }
  return total;
}

interface Outcome {
  income: number;
  netIncomeChange: number;
  stateTaxChange: number;
  federalTaxChange: number;
  provisions: ProvisionBreakdown;
  baseNet: number;
  reformNet: number;
  baseState: number;
  reformState: number;
  baseFed: number;
  reformFed: number;
}

/** Baseline and reform values, and their split by provision, per income. */
export function outcomes(
  baseline: ComputedHousehold,
  reform: ComputedHousehold,
  year: number,
  incomes: number[],
): Outcome[] {
  const n = incomes.length;
  const baseNet = readGroup(baseline.households, 'household', 'household_net_income', year, n);
  const reformNet = readGroup(reform.households, 'household', 'household_net_income', year, n);
  const baseState = readGroup(baseline.tax_units, 'tax_unit', 'mt_income_tax', year, n);
  const reformState = readGroup(reform.tax_units, 'tax_unit', 'mt_income_tax', year, n);
  const baseFed = readGroup(baseline.tax_units, 'tax_unit', 'income_tax', year, n);
  const reformFed = readGroup(reform.tax_units, 'tax_unit', 'income_tax', year, n);
  const baseEitc = readPeopleSum(baseline, 'mt_eitc', year, n);
  const reformEitc = readPeopleSum(reform, 'mt_eitc', year, n);

  return incomes.map((income, i) => {
    // mt_income_tax is net of refundable credits, so the credit gain is
    // separated out and the rest is attributed to the rate change.
    const eitcGain = reformEitc[i] - baseEitc[i];
    const stateTaxChange = reformState[i] - baseState[i];
    const federalTaxChange = reformFed[i] - baseFed[i];
    return {
      income,
      netIncomeChange: reformNet[i] - baseNet[i],
      stateTaxChange,
      federalTaxChange,
      provisions: {
        rate_change: -stateTaxChange - eitcGain,
        eitc_change: eitcGain,
        federal_tax_change: -federalTaxChange,
      } as ProvisionBreakdown,
      baseNet: baseNet[i],
      reformNet: reformNet[i],
      baseState: baseState[i],
      reformState: reformState[i],
      baseFed: baseFed[i],
      reformFed: reformFed[i],
    };
  });
}

export async function runHouseholdSweep(
  payload: HouseholdSweepPayload,
): Promise<HouseholdSweepResult> {
  const year = payload.year;
  const xMax = payload.max_earnings;

  // The axis's points, evenly spaced from 0 to xMax (labelled to the dollar).
  const axisIncomes: number[] = [];
  for (let i = 0; i < SWEEP_POINTS; i++) {
    axisIncomes.push(Math.round((xMax * i) / (SWEEP_POINTS - 1)));
  }

  const sweepHousehold = buildHousehold(payload, year, {
    count: SWEEP_POINTS,
    max: xMax,
  });
  const pointHousehold = buildHousehold(payload, year);
  const [sweepBase, sweepReform, pointBase, pointReform] = await Promise.all([
    calculate(sweepHousehold, null),
    calculate(sweepHousehold, MT_REFORM),
    calculate(pointHousehold, null),
    calculate(pointHousehold, MT_REFORM),
  ]);

  const point = outcomes(pointBase, pointReform, year, [payload.income])[0];
  // The curve includes the entered income: the point replaces an axis point
  // at the same income, or is inserted in order.
  const results = outcomes(sweepBase, sweepReform, year, axisIncomes).filter(
    (r) => r.income !== payload.income,
  );
  results.push(point);
  results.sort((a, b) => a.income - b.income);

  return {
    income_range: results.map((r) => r.income),
    net_income_change: results.map((r) => r.netIncomeChange),
    state_income_tax_change: results.map((r) => r.stateTaxChange),
    income_tax_change: results.map((r) => r.federalTaxChange),
    provisions: {
      rate_change: results.map((r) => r.provisions.rate_change),
      eitc_change: results.map((r) => r.provisions.eitc_change),
      federal_tax_change: results.map((r) => r.provisions.federal_tax_change),
    },
    provisions_at_income: point.provisions,
    benefit_at_income: {
      baseline: point.baseNet,
      reform: point.reformNet,
      difference: point.netIncomeChange,
      federal_tax_change: point.federalTaxChange,
      state_tax_change: point.stateTaxChange,
    },
    point: {
      baseline: {
        household_net_income: point.baseNet,
        state_income_tax: point.baseState,
        income_tax: point.baseFed,
      },
      reform: {
        household_net_income: point.reformNet,
        state_income_tax: point.reformState,
        income_tax: point.reformFed,
      },
    },
    x_axis_max: xMax,
  };
}
