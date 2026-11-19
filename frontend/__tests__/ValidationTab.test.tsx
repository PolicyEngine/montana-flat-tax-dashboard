import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ValidationTab from '../components/ValidationTab';
import type { ValidationData } from '../lib/types';

/** Montana schema_version 3 fixture: the pinned MT.h5 run reconciled
 *  against the Montana DOR revenue estimate. */
const validationFixture: ValidationData = {
  schema_version: 3,
  pinned_run: {
    label: 'This dashboard (pinned MT.h5 run)',
    year: 2028,
    net_cost: -118_200_000,
    poverty_percent_change: 0,
    child_poverty_percent_change: 0,
  },
  expected_band: {
    label: 'Montana Department of Revenue',
    net_cost: -130_000_000,
    source: 'Montana Department of Revenue (2029 Biennium Outlook Report, June 2026)',
  },
  provenance: {
    policyengine_us: '1.780.0',
    dataset: 'MT.h5 (state-calibrated)',
    reform: {},
    run_timestamp: '2026-07-25T18:00:00Z',
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

describe('ValidationTab', () => {
  describe('with validation.json (pinned run available)', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(validationFixture),
        })
      ) as unknown as typeof fetch;
    });

    it('renders the pinned run and the DOR anchor', async () => {
      renderWithClient(<ValidationTab />);
      // Pinned run tile
      expect(await screen.findByText('Pinned run (this dashboard)')).toBeInTheDocument();
      expect(screen.getAllByText('-$118.2M').length).toBeGreaterThan(0);
      // External anchor tile: Montana DOR -130M
      expect(screen.getByText('External anchor: Montana DOR')).toBeInTheDocument();
      expect(screen.getAllByText('-$130.0M').length).toBeGreaterThan(0);
    });

    it('shows the reconciliation table with both sources', async () => {
      renderWithClient(<ValidationTab />);
      expect(
        await screen.findByText('Pinned run vs Montana DOR estimate'),
      ).toBeInTheDocument();
      expect(screen.getByText('This dashboard (pinned MT.h5 run)')).toBeInTheDocument();
      expect(screen.getByText('Montana Department of Revenue')).toBeInTheDocument();
    });

    it('keeps the methodology behind a collapsible details block', async () => {
      renderWithClient(<ValidationTab />);
      await screen.findByText('Pinned run vs Montana DOR estimate');
      // The gap-explainer section was removed; only methodology remains.
      expect(
        screen.queryByText('Why the state-calibrated dataset resolves the earlier gap'),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Methodology & provenance')).toBeInTheDocument();
      const details = document.querySelectorAll('details');
      expect(details.length).toBe(1);
      details.forEach((d) => expect(d.open).toBe(false));
    });

    it('shows the pinned provenance in the methodology details', async () => {
      renderWithClient(<ValidationTab />);
      await screen.findByText('Pinned run vs Montana DOR estimate');
      expect(screen.getByText('policyengine-us 1.780.0')).toBeInTheDocument();
      expect(screen.getByText('MT.h5 (state-calibrated)')).toBeInTheDocument();
    });
  });

  describe('without validation.json (pipeline not run yet)', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 404 })
      ) as unknown as typeof fetch;
    });

    it('falls back to the DOR anchor and a pending pinned state', async () => {
      renderWithClient(<ValidationTab />);
      expect(
        await screen.findByText('Pinned run vs Montana DOR estimate'),
      ).toBeInTheDocument();
      // DOR anchor still shows
      expect(screen.getAllByText('-$130.0M').length).toBeGreaterThan(0);
      // Pinned run shown as pending in the table
      expect(screen.getAllByText('Pending pinned run').length).toBeGreaterThan(0);
    });
  });

  describe('with a stale schema_version 2 file (EDAA clone)', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ schema_version: 2, pinned_run: { net_cost: 615e9 } }),
        })
      ) as unknown as typeof fetch;
    });

    it('treats the stale file as pending', async () => {
      renderWithClient(<ValidationTab />);
      expect(
        await screen.findByText('Pinned run vs Montana DOR estimate'),
      ).toBeInTheDocument();
      expect(screen.getAllByText('Pending pinned run').length).toBeGreaterThan(0);
    });
  });
});
