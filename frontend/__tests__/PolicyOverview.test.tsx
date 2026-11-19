import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PolicyOverview from '../components/PolicyOverview';

/** Cell texts of the table row whose first cell is `label`. */
const rowCells = (label: string) => {
  const row = screen.getByText(label).closest('tr');
  if (!row) throw new Error(`no table row for ${label}`);
  return within(row)
    .getAllByRole('cell')
    .map((c) => c.textContent);
};

describe('PolicyOverview', () => {
  it('renders without errors', () => {
    render(<PolicyOverview />);
    expect(
      screen.getByText('Montana flat income tax and EITC proposal'),
    ).toBeInTheDocument();
  });

  it('shows the changes in one table with a column per tax year', () => {
    render(<PolicyOverview />);
    expect(screen.getByText('Changes by tax year')).toBeInTheDocument();
    expect(screen.getByText('Current law')).toBeInTheDocument();
    expect(screen.getAllByText('Tax year 2028').length).toBeGreaterThan(0);
    expect(screen.getByText('Tax year 2029 onward')).toBeInTheDocument();
    // Lower rate stays at 4.7%; the top rate steps 5.4% -> 5.0% -> 4.7%.
    expect(rowCells('Lower income tax rate')).toEqual([
      'Lower income tax rate', '4.7%', '4.7%', '4.7%',
    ]);
    expect(rowCells('Top income tax rate')).toEqual([
      'Top income tax rate', '5.4%', '5.0%', '4.7%',
    ]);
  });

  it('shows the EITC match rising from 20% to 30% of the federal credit', () => {
    render(<PolicyOverview />);
    expect(rowCells('Montana EITC, share of the federal credit')).toEqual([
      'Montana EITC, share of the federal credit', '20%', '30%', '30%',
    ]);
  });

  it('leaves parameter keys and budget office estimates to the Validation tab', () => {
    const { container } = render(<PolicyOverview />);
    expect(screen.queryByText('Parameter changes')).not.toBeInTheDocument();
    expect(screen.queryByText('Budget office estimates')).not.toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/gov\.states\.mt/);
    expect(text).not.toMatch(/\$\d+ million/);
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
  });
});
