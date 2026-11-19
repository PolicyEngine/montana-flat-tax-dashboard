import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PolicyOverview from '../components/PolicyOverview';

describe('PolicyOverview', () => {
  it('renders without errors', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('Montana flat income tax')).toBeInTheDocument();
  });

  it('describes the current two-rate schedule and the flat rate', () => {
    render(<PolicyOverview />);
    // The active change is the top rate moving 5.4% -> 4.7%.
    expect(screen.getAllByText('5.4%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4.7%').length).toBeGreaterThan(0);
  });

  it('displays the parameter change table with the real MT rate keys', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('Parameter changes')).toBeInTheDocument();
    expect(
      screen.getByText('gov.states.mt.tax.income.main.single[1].rate'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('gov.states.mt.tax.income.main.joint[1].rate'),
    ).toBeInTheDocument();
    // Effective from 2028.
    expect(screen.getAllByText('2028-01-01 onward').length).toBeGreaterThan(0);
    // Canonical-source note.
    expect(screen.getByText(/canonical, complete parameter set/)).toBeInTheDocument();
  });

  it('links to the primary sources', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('References')).toBeInTheDocument();
    // Daily Montanan article
    expect(
      screen.getByRole('link', { name: /Daily Montanan/ }),
    ).toHaveAttribute(
      'href',
      'https://dailymontanan.com/2026/07/13/montana-senate-republicans-back-governors-flat-income-tax-plan/',
    );
    // HB 337 background
    expect(
      screen.getByRole('link', { name: /House Bill 337/ }),
    ).toBeInTheDocument();
    // policyengine-us MT parameters (linked inline from the parameter-changes note)
    expect(
      screen.getByRole('link', { name: 'policyengine-us' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/PolicyEngine/policyengine-us/tree/master/policyengine_us/parameters/gov/states/mt/tax/income/main',
    );
  });
});
