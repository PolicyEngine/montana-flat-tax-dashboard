import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SWEEP_POINTS,
  buildHousehold,
  runHouseholdSweep,
  type HouseholdSweepPayload,
} from '../lib/householdApi';
import { MT_REFORM } from '../lib/montana';

const payload: HouseholdSweepPayload = {
  age_head: 35,
  age_spouse: null,
  dependent_ages: [5],
  income: 25000,
  year: 2029,
  max_earnings: 100000,
};

describe('buildHousehold', () => {
  it('requests each variable on the entity it belongs to', () => {
    const h = buildHousehold(payload, 2029);
    expect(Object.keys(h.households.household)).toEqual([
      'members',
      'state_name',
      'household_net_income',
    ]);
    expect(Object.keys(h.tax_units.tax_unit)).toEqual([
      'members',
      'mt_income_tax',
      'income_tax',
    ]);
    expect(h.people.head.employment_income).toEqual({ '2029': 25000 });
    expect(h.axes).toBeUndefined();
  });

  it('puts the head on an employment-income axis for the sweep', () => {
    const h = buildHousehold(payload, 2029, { count: SWEEP_POINTS, max: 100000 });
    expect(h.people.head.employment_income).toBeUndefined();
    expect(h.axes).toEqual([
      [
        {
          name: 'employment_income',
          count: SWEEP_POINTS,
          min: 0,
          max: 100000,
          period: '2029',
        },
      ],
    ]);
  });
});

/** A computed household: `scale` stands in for the policy's effect. */
function computed(n: number | null, scale: number) {
  const v = (x: number) =>
    n === null ? x : Array.from({ length: n }, (_, i) => x + i);
  return {
    people: {
      head: { mt_eitc: { '2029': v(100 * scale) } },
      dependent_0: {},
    },
    tax_units: {
      tax_unit: {
        mt_income_tax: { '2029': v(1000 - 200 * scale) },
        income_tax: { '2029': v(500) },
      },
    },
    households: {
      household: { household_net_income: { '2029': v(20000 + 200 * scale) } },
    },
  };
}

describe('runHouseholdSweep', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes four dashboard API calls and splits the change by provision', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const body = JSON.parse(String(init?.body));
      calls.push({ url: String(input), body });
      const sweep = Boolean(body.household.axes);
      const scale = body.policy ? 1 : 0;
      return new Response(
        JSON.stringify({
          status: 'ok',
          message: null,
          result: computed(sweep ? SWEEP_POINTS : null, scale),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const result = await runHouseholdSweep(payload);

    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.url).toBe('https://www.policyengine.org/api/household/calculate');
      expect(call.body.country).toBe('us');
    }
    const reformCalls = calls.filter((c) => c.body.policy);
    expect(reformCalls).toHaveLength(2);
    for (const call of reformCalls) expect(call.body.policy).toEqual(MT_REFORM);

    // 26 axis points; 25,000 is not on the 4,000-dollar grid, so it is added.
    expect(result.income_range).toHaveLength(SWEEP_POINTS + 1);
    expect(result.income_range).toContain(25000);
    expect([...result.income_range]).toEqual(
      [...result.income_range].sort((a, b) => a - b),
    );
    expect(result.provisions_at_income).toEqual({
      rate_change: 100,
      eitc_change: 100,
      federal_tax_change: -0,
    });
    expect(result.benefit_at_income.difference).toBe(200);
    expect(result.net_income_change.every((x) => x === 200)).toBe(true);
  });

  it('uses the point calculation in place of an axis point at the same income', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      const sweep = Boolean(body.household.axes);
      return new Response(
        JSON.stringify({
          status: 'ok',
          message: null,
          result: computed(sweep ? SWEEP_POINTS : null, body.policy ? 1 : 0),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const result = await runHouseholdSweep({ ...payload, income: 40000 });
    expect(result.income_range).toHaveLength(SWEEP_POINTS);
    expect(result.income_range.filter((x) => x === 40000)).toHaveLength(1);
  });
});
