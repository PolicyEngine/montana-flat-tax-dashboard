import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AggregateImpact from '../components/AggregateImpact';

// Mock fetch for CSV loading. Rows exist for both tax years: 2028 (top
// rate 5.0%) and 2029 (flat 4.7%), each with the EITC at 30%. Values
// are illustrative, not the published results.
const metricsFor = (
  year: number,
  state: number,
  rates: number,
  eitc: number,
  federal: number,
  povertyReform: number,
) => `${year},budgetary_impact,${state}
${year},state_tax_revenue_impact,${state}
${year},rate_cut_state_revenue_impact,${rates}
${year},eitc_state_revenue_impact,${eitc}
${year},federal_tax_revenue_impact,${federal}
${year},tax_revenue_impact,${state + federal}
${year},winners,160000
${year},winners_rate,34.1
${year},losers,16000
${year},losers_rate,3.4
${year},poverty_baseline_rate,15.12
${year},poverty_reform_rate,${povertyReform}
${year},child_poverty_baseline_rate,14.89
${year},child_poverty_reform_rate,14.4
${year},deep_poverty_baseline_rate,8.0
${year},deep_poverty_reform_rate,8.0
${year},deep_child_poverty_baseline_rate,6.9
${year},deep_child_poverty_reform_rate,6.9
${year},households,467000`;

const mockMetricsCSV = `year,metric,value
${metricsFor(2028, -90000000, -73000000, -17000000, 6300000, 14.88)}
${metricsFor(2029, -151000000, -134000000, -17000000, 11600000, 14.68)}`;

/** Repeat a single-year CSV body for both tax years. */
const bothYears = (header: string, rows2028: string) =>
  `${header}\n${rows2028}\n${rows2028.replace(/^2028,/gm, '2029,')}`;

const mockDistributionalCSV = bothYears(
  'year,decile,average_change,relative_change',
  `2028,1,0,0
2028,2,0,0
2028,3,0,0
2028,4,5,0.0001
2028,5,20,0.0003
2028,6,60,0.0008
2028,7,150,0.0015
2028,8,420,0.003
2028,9,900,0.005
2028,10,2569,0.009`,
);

const mockWinnersLosersCSV = bothYears(
  'year,decile,gain_more_5pct,gain_less_5pct,no_change,lose_less_5pct,lose_more_5pct',
  `2028,All,0,0.218,0.751,0.031,0
2028,1,0,0,1,0,0
2028,2,0,0,1,0,0
2028,3,0,0.02,0.98,0,0
2028,4,0,0.08,0.9,0.02,0
2028,5,0,0.15,0.82,0.03,0
2028,6,0,0.25,0.71,0.04,0
2028,7,0,0.35,0.6,0.05,0
2028,8,0,0.45,0.5,0.05,0
2028,9,0,0.55,0.4,0.05,0
2028,10,0,0.7,0.25,0.05,0`,
);

const mockIncomeBracketsCSV = bothYears(
  'year,bracket,beneficiaries,total_cost,avg_benefit',
  `2028,$0 - $25k,0,0,0
2028,$25k - $50k,10000,0,0
2028,$50k - $75k,40000,-2000000,-50
2028,$75k - $100k,60000,-12000000,-200
2028,$100k - $150k,50000,-30000000,-600
2028,$150k - $200k,20000,-25000000,-1250
2028,$200k+,15000,-49200000,-3280`,
);

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

  it('defaults to tax year 2029, the first year of the flat rate', async () => {
    renderWithClient(<AggregateImpact triggered={true} />);
    expect(await screen.findByText('State revenue impact (2029)')).toBeInTheDocument();
    expect(screen.getByText('Montana state income tax')).toBeInTheDocument();
    expect(screen.getAllByText('-$151.0M').length).toBeGreaterThan(0);
    // Federal interaction (SALT) shown separately
    expect(screen.getByText('Federal income tax')).toBeInTheDocument();
    expect(screen.getByText('+$11.6M')).toBeInTheDocument();
    expect(screen.getByText(/accrues to the federal government/i)).toBeInTheDocument();
  });

  it('splits the state revenue impact by provision', async () => {
    renderWithClient(<AggregateImpact triggered={true} />);
    expect(await screen.findByText('By provision (2029)')).toBeInTheDocument();
    expect(screen.getByText('Top rate 5.4% to 4.7% (flat rate)')).toBeInTheDocument();
    expect(screen.getByText('-$134.0M')).toBeInTheDocument();
    expect(screen.getByText('EITC 20% to 30% of the federal credit')).toBeInTheDocument();
    expect(screen.getByText('-$17.0M')).toBeInTheDocument();
  });

  it('shows the 5.0% step year when the year prop is 2028', async () => {
    renderWithClient(<AggregateImpact triggered={true} year={2028} />);
    expect(await screen.findByText('State revenue impact (2028)')).toBeInTheDocument();
    expect(screen.getAllByText('-$90.0M').length).toBeGreaterThan(0);
    expect(screen.getByText('Top rate 5.4% to 5.0%')).toBeInTheDocument();
    expect(screen.getByText('-$73.0M')).toBeInTheDocument();
  });

  it('poverty tab reports rates from the data files', async () => {
    renderWithClient(<AggregateImpact triggered={true} year={2028} />);
    await screen.findByText('State revenue impact (2028)');
    fireEvent.click(screen.getByRole('button', { name: 'Poverty impact' }));
    expect(await screen.findByText('Poverty impact (2028)')).toBeInTheDocument();
    // All residents: 15.12% -> 14.88% = -0.24 points
    expect(screen.getByText('15.12%')).toBeInTheDocument();
    expect(screen.getByText('14.88%')).toBeInTheDocument();
    expect(screen.getByText('-0.24')).toBeInTheDocument();
    // Children: 14.89% -> 14.40% = -0.49 points
    expect(screen.getByText('-0.49')).toBeInTheDocument();
  });
});
