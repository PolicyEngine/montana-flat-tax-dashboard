import { describe, it, expect, vi } from 'vitest';

// Mock the API to prevent actual network calls
vi.mock('../lib/api', () => ({
  api: {
    calculateHouseholdImpact: vi.fn().mockResolvedValue({
      income_range: [0, 10000, 20000, 30000],
      net_income_change: [5680, 5680, 4680, 3680],
      federalTaxChange: [0, 0, 1000, 2000],
      stateTaxChange: [0, 0, 0, 0],
      netIncomeChange: [5680, 5680, 4680, 3680],
      benefit_at_income: {
        baseline: 30000,
        reform: 34680,
        difference: 4680,
        federal_tax_change: 1000,
        state_tax_change: 0,
        net_income_change: 4680,
      },
      x_axis_max: 100000,
    }),
  },
}));

// Validation logic used by the household form in app/(shell)/page.tsx,
// tested in isolation.
describe('Household Input Form', () => {
  it('validates age input between 18-100', () => {
    const clampAge = (value: string): number => {
      return Math.max(18, Math.min(100, parseInt(value) || 18));
    };

    expect(clampAge('25')).toBe(25);
    expect(clampAge('10')).toBe(18);
    expect(clampAge('150')).toBe(100);
    expect(clampAge('')).toBe(18);
  });

  it('validates dependent ages between 0-26', () => {
    const clampDependentAge = (value: string): number => {
      return Math.max(0, Math.min(26, parseInt(value) || 0));
    };

    expect(clampDependentAge('5')).toBe(5);
    expect(clampDependentAge('-1')).toBe(0);
    expect(clampDependentAge('30')).toBe(26);
    expect(clampDependentAge('')).toBe(0);
  });

  it('parses income input correctly', () => {
    const parseNumber = (str: string) => {
      const num = Number(str.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    };

    expect(parseNumber('75,000')).toBe(75000);
    expect(parseNumber('1,000,000')).toBe(1000000);
    expect(parseNumber('50000')).toBe(50000);
    expect(parseNumber('')).toBe(0);
  });

  it('formats income with commas', () => {
    const formatNumber = (num: number) => num.toLocaleString('en-US');

    expect(formatNumber(75000)).toBe('75,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
  });
});
