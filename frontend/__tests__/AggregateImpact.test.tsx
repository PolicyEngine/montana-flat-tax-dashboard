import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AggregateImpact from '../components/AggregateImpact';

// Mock fetch for CSV loading (Montana schema). The 2028 row carries the
// state revenue cost (negative) and the federal SALT interaction
// (positive); the EDAA-only decomposition metrics are absent.
const mockMetricsCSV = `year,metric,value
2028,budgetary_impact,-118200000
2028,state_tax_revenue_impact,-118200000
2028,federal_tax_revenue_impact,9100000
2028,tax_revenue_impact,-109100000
2028,winners,58000
2028,winners_rate,21.8
2028,losers,8000
2028,losers_rate,3.1
2028,poverty_baseline_rate,10.4
2028,poverty_reform_rate,10.4
2028,child_poverty_baseline_rate,12.1
2028,child_poverty_reform_rate,12.1
2028,deep_poverty_baseline_rate,3.0
2028,deep_poverty_reform_rate,3.0
2028,deep_child_poverty_baseline_rate,2.5
2028,deep_child_poverty_reform_rate,2.5
2028,households,530000`;

const mockDistributionalCSV = `year,decile,average_change,relative_change
2028,1,0,0
2028,2,0,0
2028,3,0,0
2028,4,5,0.0001
2028,5,20,0.0003
2028,6,60,0.0008
2028,7,150,0.0015
2028,8,420,0.003
2028,9,900,0.005
2028,10,2569,0.009`;

const mockWinnersLosersCSV = `year,decile,gain_more_5pct,gain_less_5pct,no_change,lose_less_5pct,lose_more_5pct
2028,All,0,0.218,0.751,0.031,0
2028,1,0,0,1,0,0
2028,2,0,0,1,0,0
2028,3,0,0.02,0.98,0,0
2028,4,0,0.08,0.9,0.02,0
2028,5,0,0.15,0.82,0.03,0
2028,6,0,0.25,0.71,0.04,0
2028,7,0,0.35,0.6,0.05,0
2028,8,0,0.45,0.5,0.05,0
2028,9,0,0.55,0.4,0.05,0
2028,10,0,0.7,0.25,0.05,0`;

const mockIncomeBracketsCSV = `year,bracket,beneficiaries,total_cost,avg_benefit
2028,$0 - $25k,0,0,0
2028,$25k - $50k,10000,0,0
2028,$50k - $75k,40000,-2000000,-50
2028,$75k - $100k,60000,-12000000,-200
2028,$100k - $150k,50000,-30000000,-600
2028,$150k - $200k,20000,-25000000,-1250
2028,$200k+,15000,-49200000,-3280`;

beforeEach(() => {
  global.fetch = vi.fn((url: string) => {
    if (url.includes('metrics.csv')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(mockMetricsCSV) });
    }
    if (url.includes('distributional_impact.csv')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(mockDistributionalCSV) });
    }
    if (url.includes('winners_losers.csv')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(mockWinnersLosersCSV) });
    }
    if (url.includes('income_brackets.csv')) {
      return Promise.resolve({ ok: true, text: () => Promise.resolve(mockIncomeBracketsCSV) });
    }
    // validation.json and everything else: 404
    return Promise.resolve({ ok: false, status: 404 });
  }) as unknown as typeof fetch;
});

// Mock ResizeObserver for Recharts
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
};

describe('AggregateImpact', () => {
  it('renders nothing when not triggered', () => {
    const { container } = renderWithClient(<AggregateImpact triggered={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state when triggered', () => {
    renderWithClient(<AggregateImpact triggered={true} />);
    expect(screen.getByText('Loading statewide impact data...')).toBeInTheDocument();
  });

  it('renders the state revenue impact with a separate federal card', async () => {
    renderWithClient(<AggregateImpact triggered={true} />);
    expect(await screen.findByText('State revenue impact (2028)')).toBeInTheDocument();
    // Montana state income tax = -118.2M
    expect(screen.getByText('Montana state income tax')).toBeInTheDocument();
    expect(screen.getAllByText('-$118.2M').length).toBeGreaterThan(0);
    // Federal interaction (SALT) shown separately = +9.1M
    expect(screen.getByText('Federal income tax')).toBeInTheDocument();
    expect(screen.getByText('+$9.1M')).toBeInTheDocument();
    // Note that the federal change accrues to the federal government
    expect(screen.getByText(/accrues to the federal government/i)).toBeInTheDocument();
  });

  it('covers a single tax year with no year selector', async () => {
    renderWithClient(<AggregateImpact triggered={true} />);
    await screen.findByText('State revenue impact (2028)');
    // The analysis is single-year (2028), so no year pill is rendered.
    expect(screen.queryByRole('button', { name: '2028' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '2029' })).not.toBeInTheDocument();
    expect(screen.queryByText('Select year')).not.toBeInTheDocument();
  });

  it('poverty tab states the reform makes no change to poverty', async () => {
    renderWithClient(<AggregateImpact triggered={true} />);
    await screen.findByText('State revenue impact (2028)');
    fireEvent.click(screen.getByRole('button', { name: 'Poverty impact' }));
    expect(await screen.findByText('No change to poverty')).toBeInTheDocument();
    expect(
      screen.getByText(/leaves the poverty rate\s+unchanged/i),
    ).toBeInTheDocument();
    // The old baseline-vs-reform rate chart is gone.
    expect(
      screen.queryByText(/Poverty rates: baseline vs reform/),
    ).not.toBeInTheDocument();
  });
});
