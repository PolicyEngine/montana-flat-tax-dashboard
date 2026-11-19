import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PolicyOverview from '../components/PolicyOverview';

describe('PolicyOverview', () => {
  it('renders without errors', () => {
    render(<PolicyOverview />);
    expect(
      screen.getByText('Montana flat income tax and EITC proposal'),
    ).toBeInTheDocument();
  });

  it('shows the phased rate path: 5.4% now, 5.0% in 2028, 4.7% from 2029', () => {
    render(<PolicyOverview />);
    expect(screen.getAllByText('5.4%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('5.0%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4.7%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tax year 2028').length).toBeGreaterThan(0);
    expect(screen.getByText('Tax year 2029 onward')).toBeInTheDocument();
    expect(screen.getByText('One rate on all taxable income')).toBeInTheDocument();
  });

  it('shows the EITC match rising from 20% to 30% of the federal credit', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('Earned income tax credit')).toBeInTheDocument();
    expect(screen.getAllByText('20%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30%').length).toBeGreaterThan(0);
  });

  it('displays the parameter change table with the real MT parameter keys', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('Parameter changes')).toBeInTheDocument();
    expect(
      screen.getByText('gov.states.mt.tax.income.main.single[1].rate'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('gov.states.mt.tax.income.main.joint[1].rate'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('gov.states.mt.tax.income.credits.eitc.match'),
    ).toBeInTheDocument();
    // Canonical-source note.
    expect(screen.getByText(/canonical, complete parameter set/)).toBeInTheDocument();
  });

  it('reports the budget office estimates as published figures', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('Budget office estimates')).toBeInTheDocument();
    expect(screen.getByText(/\$117 million at full implementation/)).toBeInTheDocument();
    expect(screen.getByText(/\$16 million beginning in fiscal year 2029/)).toBeInTheDocument();
  });

  it('links to the primary sources', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('References')).toBeInTheDocument();
    // Executive budget, Section R (the proposal's official description)
    expect(
      screen.getByRole('link', { name: /Section R/ }),
    ).toHaveAttribute(
      'href',
      'https://gov.mt.gov/_docs/budget_budget2029/OBPPREF.pdf#page=7',
    );
    // HB 337 (2025) background
    expect(
      screen.getByRole('link', { name: /House Bill 337/ }),
    ).toHaveAttribute(
      'href',
      'https://archive.legmt.gov/content/Sessions/69th/Contractor_index/CH0227.pdf',
    );
    // policyengine-us MT parameters (linked inline from the parameter-changes note)
    expect(
      screen.getByRole('link', { name: 'policyengine-us' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/PolicyEngine/policyengine-us/tree/main/policyengine_us/parameters/gov/states/mt/tax/income',
    );
  });
});
