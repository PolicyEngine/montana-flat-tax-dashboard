/**
 * Content-rule regression tests carried over from the dashboard
 * template (plan.yaml constraints), applied to the Montana flat-tax
 * dashboard:
 * - no-race-breakdowns: no tab renders a race breakdown section
 * - neutral-tone: no characterizing adjectives
 * - tab navigation: the five tabs render in the specified order
 * - figures come from public/data files, never hardcoded model output
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '../app/(shell)/page';
import PolicyOverview from '../components/PolicyOverview';
import ValidationTab from '../components/ValidationTab';

beforeEach(() => {
  // No data files exist in unit tests: everything 404s, components
  // must render their pending/empty states.
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve(''), json: () => Promise.reject(new Error('404')) })
  ) as unknown as typeof fetch;
});

const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

const VIEWS: [string, () => React.ReactElement][] = [
  ['home (policy tab)', () => <Home />],
  ['policy overview', () => <PolicyOverview />],
  ['validation', () => <ValidationTab />],
];

describe.each(VIEWS)('%s content rules', (_name, View) => {
  it('contains no race breakdowns', async () => {
    const { container } = renderWithClient(View());
    // Allow pending fetches to settle
    await Promise.resolve();
    expect(container.textContent ?? '').not.toMatch(
      /\brace\b|\bracial\b|\bethnic/i,
    );
  });

  it('avoids characterizing adjectives (neutral tone)', async () => {
    const { container } = renderWithClient(View());
    await Promise.resolve();
    expect(container.textContent ?? '').not.toMatch(
      /\b(modest|substantial|significant|generous|wealthy|low-income|struggling)\b/i,
    );
  });
});

describe('Tab navigation', () => {
  it('renders the five tabs in the specified order', () => {
    renderWithClient(<Home />);
    const tablist = screen.getByRole('tablist');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Policy overview',
      'Household impact',
      'Statewide impact',
      'Congressional districts',
      'Validation',
    ]);
  });

  it('marks only the active tab as selected', () => {
    renderWithClient(<Home />);
    const tablist = screen.getByRole('tablist');
    const selected = within(tablist)
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Policy overview');
  });
});

describe('Figures come from data files, not JSX', () => {
  it('policy overview only shows statute constants (allowed), never model output', () => {
    // The provision tables contain statutory rates and thresholds,
    // which are allowed. Model-output figures (the state revenue cost,
    // poverty changes) must not appear in the policy overview.
    const { container } = renderWithClient(<PolicyOverview />);
    expect(container.textContent ?? '').not.toMatch(
      /118\.2|-\$118|\$\d+(\.\d+)?[BTM]\b/
    );
  });
});
