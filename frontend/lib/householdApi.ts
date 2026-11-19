/**
 * Live household calculator for Montana's proposed flat income tax and
 * earned income tax credit increase, built on the public PolicyEngine
 * API (https://api.policyengine.org/us).
 *
 * For each request we build a Montana household from the form inputs
 * and call the public /calculate endpoint twice: once under current law
 * (baseline) and once under the proposal (MT_REFORM). The impact is
 *
 *   impact = reform (governor's proposal) - baseline (current law)
 *
 * We compute both a point value (at the entered income) and a sweep
 * across employment income, so the ImpactAnalysis chart can render the
 * earnings curve. The change is split by provision from the household's
 * point of view (positive = gain): the Montana earned income tax credit
 * change, the remaining Montana income tax change (the rate change),
 * and the federal income tax change.
 */

import { MT_REFORM, POLICYENGINE_API_BASE } from './montana';
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

/** Number of points on the employment-income sweep. */
const SWEEP_POINTS = 26;

type Reform = Record<string, Record<string, number>>;

interface PeHousehold {
  people: Record<string, Record<string, Record<string, number | null>>>;
  families: Record<string, { members: string[] }>;
  marital_units: Record<string, { members: string[] }>;
  tax_units: Record<
    string,
    Record<string, string[] | Record<string, number | null>>
  >;
  spm_units: Record<string, { members: string[] }>;
  households: Record<
    string,
    Record<string, string[] | Record<string, string | number | null>>
  >;
}

/**
 * Build a PolicyEngine household for the given inputs, requesting
 * household_net_income, mt_income_tax, income_tax, and (per person)
 * mt_eitc for `year`. The head's employment_income is set to `income`;
 * spouse and dependents carry zero employment income.
 */
function buildHousehold(
  payload: HouseholdSweepPayload,
  year: number,
): PeHousehold {
  const yr = String(year);
  const people: PeHousehold['people'] = {
    head: {
      age: { [yr]: payload.age_head },
      employment_income: { [yr]: payload.income },
      mt_eitc: { [yr]: null },
    },
  };
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

  const requested = {
    household_net_income: { [yr]: null },
    mt_income_tax: { [yr]: null },
    income_tax: { [yr]: null },
  };

  return {
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
        ...requested,
      },
    },
    spm_units: { spm_unit: { members: memberNames } },
    households: {
      household: {
        members: memberNames,
        state_name: { [yr]: payload.state_code ?? 'MT' },
        ...requested,
      },
    },
  };
}

async function calculate(
  household: PeHousehold,
  reform: Reform | null,
): Promise<PeHousehold> {
  const body: { household: PeHousehold; policy?: Reform } = { household };
  if (reform) body.policy = reform;

  const res = await fetch(`${POLICYENGINE_API_BASE}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `PolicyEngine API error ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { result?: PeHousehold } | PeHousehold;
  // The API wraps the computed household in { result } on some routes.
  return ('result' in json && json.result ? json.result : json) as PeHousehold;
}

function readTaxUnit(h: PeHousehold, key: string, year: number): number {
  const yr = String(year);
  const tu = h.tax_units?.tax_unit as
    | Record<string, Record<string, number | null>>
    | undefined;
  const v = tu?.[key]?.[yr];
  return typeof v === 'number' ? v : 0;
}

/** Sum a person-level variable across everyone in the household. */
function readPeopleSum(h: PeHousehold, key: string, year: number): number {
  const yr = String(year);
  return Object.values(h.people ?? {}).reduce((sum, person) => {
    const v = person?.[key]?.[yr];
    return sum + (typeof v === 'number' ? v : 0);
  }, 0);
}

function readHousehold(h: PeHousehold, key: string, year: number): number {
  const yr = String(year);
  const hh = h.households?.household as
    | Record<string, Record<string, number | null>>
    | undefined;
  const v = hh?.[key]?.[yr];
  return typeof v === 'number' ? v : 0;
}

export async function runHouseholdSweep(
  payload: HouseholdSweepPayload,
): Promise<HouseholdSweepResult> {
  const year = payload.year;
  const xMax = payload.max_earnings;

  // Sweep grid of employment-income points, plus a guaranteed point at
  // the entered income.
  const grid: number[] = [];
  for (let i = 0; i < SWEEP_POINTS; i++) {
    grid.push(Math.round((xMax * i) / (SWEEP_POINTS - 1)));
  }
  if (!grid.includes(payload.income)) {
    grid.push(payload.income);
    grid.sort((a, b) => a - b);
  }

  // One baseline + one reform call per grid point. Kept sequential-ish
  // via Promise.all over the grid; the public API handles concurrent
  // household calls.
  const results = await Promise.all(
    grid.map(async (income) => {
      const hh = buildHousehold({ ...payload, income }, year);
      const [baseline, reform] = await Promise.all([
        calculate(hh, null),
        calculate(hh, MT_REFORM),
      ]);
      const baseNet = readHousehold(baseline, 'household_net_income', year);
      const reformNet = readHousehold(reform, 'household_net_income', year);
      const baseState = readTaxUnit(baseline, 'mt_income_tax', year);
      const reformState = readTaxUnit(reform, 'mt_income_tax', year);
      const baseFed = readTaxUnit(baseline, 'income_tax', year);
      const reformFed = readTaxUnit(reform, 'income_tax', year);
      // mt_income_tax is net of refundable credits, so the credit gain
      // is separated out and the rest is attributed to the rate change.
      const eitcGain =
        readPeopleSum(reform, 'mt_eitc', year) -
        readPeopleSum(baseline, 'mt_eitc', year);
      const rateGain = -(reformState - baseState) - eitcGain;
      return {
        income,
        netIncomeChange: reformNet - baseNet,
        stateTaxChange: reformState - baseState,
        federalTaxChange: reformFed - baseFed,
        provisions: {
          rate_change: rateGain,
          eitc_change: eitcGain,
          federal_tax_change: -(reformFed - baseFed),
        } as ProvisionBreakdown,
        baseNet,
        reformNet,
        baseState,
        reformState,
        baseFed,
        reformFed,
      };
    }),
  );

  const income_range = results.map((r) => r.income);
  const net_income_change = results.map((r) => r.netIncomeChange);
  const state_income_tax_change = results.map((r) => r.stateTaxChange);
  const income_tax_change = results.map((r) => r.federalTaxChange);

  const point =
    results.find((r) => r.income === payload.income) ??
    results[results.length - 1];

  return {
    income_range,
    net_income_change,
    state_income_tax_change,
    income_tax_change,
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
