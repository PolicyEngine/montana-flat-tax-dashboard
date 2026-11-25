import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ValidationTab from '../components/ValidationTab';
import type { ValidationData } from '../lib/types';

/** schema_version 4 fixture: pinned runs for both tax years, split by
 *  provision. Values are illustrative, not the published results. */
const validationFixture: ValidationData = {
  schema_version: 4,
  runs: [
    {
      year: 2028,
      state_revenue_impact: -90_000_000,
      rate_cut_state_revenue_impact: -73_000_000,
      eitc_state_revenue_impact: -17_000_000,
      baseline_state_income_tax: 2_100_000_000,
      poverty_percent_change: -1.5,
      child_poverty_percent_change: -3.0,
    },
    {
      year: 2029,
      state_revenue_impact: -151_000_000,
      rate_cut_state_revenue_impact: -134_000_000,
      eitc_state_revenue_impact: -17_000_000,
      baseline_state_income_tax: 2_230_000_000,
      poverty_percent_change: -0.7,
      child_poverty_percent_change: -2.0,
    },
  ],
  provenance: {
    policyengine_us: '1.715.2',
    dataset: 'MT.h5 (state-calibrated)',
    reform: {},
    run_timestamp: '2026-11-19T18:00:00Z',
  },
};

const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

const HEADING = 'Pinned runs vs budget office estimates';

describe('ValidationTab', () => {
  describe('with validation.json (pinned runs available)', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(validationFixture),
        })
      ) as unknown as typeof fetch;
    });

    it('renders a pinned-run total for each tax year', async () => {
      renderWithClient(<ValidationTab />);
      expect(await screen.findByText('Pinned run, tax year 2028')).toBeInTheDocument();
      expect(screen.getByText('-$90.0M')).toBeInTheDocument();
      expect(screen.getByText('Pinned run, tax year 2029')).toBeInTheDocument();
      expect(screen.getByText('-$151.0M')).toBeInTheDocument();
    });

    it('compares each provision with the budget office estimate', async () => {
      renderWithClient(<ValidationTab />);
      expect(await screen.findByText(HEADING)).toBeInTheDocument();
      // Rate change: 5.0% step in 2028, flat 4.7% in 2029
      expect(screen.getByText('Tax year 2028: -$73.0M')).toBeInTheDocument();
      expect(screen.getByText('Tax year 2029: -$134.0M')).toBeInTheDocument();
      expect(screen.getByText(/-\$117M at full implementation in FY2030/)).toBeInTheDocument();
      // EITC increase
      expect(
        screen.getByText('Tax year 2028: -$17.0M; tax year 2029: -$17.0M'),
      ).toBeInTheDocument();
      expect(screen.getByText('-$16M beginning in FY2029')).toBeInTheDocument();
    });

    it('carries the budget office context moved from the policy overview', async () => {
      renderWithClient(<ValidationTab />);
      await screen.findByText(HEADING);
      expect(screen.getByText(/\$220 million in tax\s+relief/)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'executive budget, Section R' }),
      ).toHaveAttribute(
        'href',
        'https://gov.mt.gov/_docs/budget_budget2029/OBPPREF.pdf#page=7',
      );
      // policyengine-us parameter link lives in the methodology details
      expect(
        screen.getByRole('link', { name: 'policyengine-us', hidden: true }),
      ).toHaveAttribute(
        'href',
        'https://github.com/PolicyEngine/policyengine-us/tree/main/policyengine_us/parameters/gov/states/mt/tax/income',
      );
    });

    it('keeps the methodology behind a collapsible details block', async () => {
      renderWithClient(<ValidationTab />);
      await screen.findByText(HEADING);
      expect(screen.getByText('Methodology & provenance')).toBeInTheDocument();
      const details = document.querySelectorAll('details');
      expect(details.length).toBe(1);
      details.forEach((d) => expect(d.open).toBe(false));
    });

    it('shows the pinned provenance in the methodology details', async () => {
      renderWithClient(<ValidationTab />);
      await screen.findByText(HEADING);
      expect(screen.getByText('policyengine-us 1.715.2')).toBeInTheDocument();
      expect(screen.getByText('MT.h5 (state-calibrated)')).toBeInTheDocument();
    });
  });

  describe('without validation.json (pipeline not run yet)', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 404 })
      ) as unknown as typeof fetch;
    });

    it('still shows the budget office figures with a pending pinned state', async () => {
      renderWithClient(<ValidationTab />);
      expect(await screen.findByText(HEADING)).toBeInTheDocument();
      expect(screen.getByText('-$16M beginning in FY2029')).toBeInTheDocument();
      expect(screen.getAllByText(/Pending pinned run/).length).toBeGreaterThan(0);
    });
  });

  describe('with a stale schema_version 3 file (single-year run)', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ schema_version: 3, pinned_run: { net_cost: -118.2e6 } }),
        })
      ) as unknown as typeof fetch;
    });

    it('treats the stale file as pending', async () => {
      renderWithClient(<ValidationTab />);
      expect(await screen.findByText(HEADING)).toBeInTheDocument();
      expect(screen.getAllByText(/Pending pinned run/).length).toBeGreaterThan(0);
      expect(screen.queryByText('-$118.2M')).not.toBeInTheDocument();
    });
  });
});
