import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EITC_MATCH_PARAMETER,
  FILING_STATUSES,
  MT_REFORM,
  PROPOSED_EITC_MATCH,
  PROPOSED_TOP_RATE,
} from '../lib/montana';

/** reform.json at the repository root is the canonical reform: the
 *  Python pipelines load it directly. The frontend cannot import a file
 *  outside its own directory at deploy time, so lib/montana.ts mirrors
 *  it. This test fails if the two drift apart. */
const canonical = JSON.parse(
  readFileSync(resolve(__dirname, '..', '..', 'reform.json'), 'utf-8'),
);

describe('reform definition', () => {
  it('matches reform.json exactly', () => {
    expect(MT_REFORM).toEqual(canonical);
  });

  it('steps the top rate to 5.0% in 2028 and 4.7% from 2029 for every filing status', () => {
    for (const status of FILING_STATUSES) {
      expect(MT_REFORM[`gov.states.mt.tax.income.main.${status}[1].rate`]).toEqual({
        '2028-01-01.2028-12-31': 0.05,
        '2029-01-01.2100-12-31': 0.047,
      });
    }
    expect(PROPOSED_TOP_RATE).toEqual({ 2028: 0.05, 2029: 0.047 });
  });

  it('raises the EITC match to 30% from 2028', () => {
    expect(MT_REFORM[EITC_MATCH_PARAMETER]).toEqual({
      '2028-01-01.2100-12-31': 0.3,
    });
    expect(PROPOSED_EITC_MATCH).toBe(0.3);
  });
});
