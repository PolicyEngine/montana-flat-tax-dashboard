import { describe, it, expect } from 'vitest';
import parseCSV from '../lib/parseCSV';
import { parseHashParams, buildHashString } from '../lib/embedding';

describe('parseCSV', () => {
  it('parses headers and numeric values', () => {
    const rows = parseCSV('year,metric,value\n2026,budgetary_impact,-306780941369.55');
    expect(rows).toHaveLength(1);
    expect(rows[0].year).toBe(2026);
    expect(rows[0].metric).toBe('budgetary_impact');
    expect(rows[0].value).toBeCloseTo(-306780941369.55);
  });

  it('keeps non-numeric values as strings', () => {
    const rows = parseCSV('decile,label\nAll,everyone');
    expect(rows[0].decile).toBe('All');
    expect(rows[0].label).toBe('everyone');
  });

  it('trims whitespace and handles empty cells', () => {
    const rows = parseCSV('a, b \n 1 , ');
    expect(rows[0].a).toBe(1);
    expect(rows[0].b).toBe('');
  });
});

describe('embedding hash params', () => {
  it('parses household params from the hash', () => {
    const params = parseHashParams('#income=50000&age=40&state=mi&married=true&dependents=3,7');
    expect(params.income).toBe(50000);
    expect(params.age).toBe(40);
    expect(params.state).toBe('MI');
    expect(params.married).toBe(true);
    expect(params.dependents).toEqual([3, 7]);
  });

  it('accepts all five tab ids', () => {
    for (const tab of ['policy', 'impact', 'aggregate', 'districts', 'validation']) {
      expect(parseHashParams(`#tab=${tab}`).tab).toBe(tab);
    }
    expect(parseHashParams('#tab=bogus').tab).toBeUndefined();
  });

  it('round-trips through buildHashString', () => {
    const hash = buildHashString({ income: 25000, state: 'MI', tab: 'validation' });
    const parsed = parseHashParams(hash);
    expect(parsed.income).toBe(25000);
    expect(parsed.state).toBe('MI');
    expect(parsed.tab).toBe('validation');
  });
});
