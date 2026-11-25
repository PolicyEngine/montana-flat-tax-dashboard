'use client';

import { YEARS, YEAR_SUMMARY, type ReformYear } from '@/lib/montana';

interface Props {
  year: ReformYear;
  onChange: (year: ReformYear) => void;
}

/** Tax-year selector shared by the household, statewide, and district
 *  tabs. The proposal phases in, so each year models different rules. */
export default function YearToggle({ year, onChange }: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
      role="group"
      aria-label="Tax year"
    >
      <span className="text-sm font-semibold text-gray-700">Tax year</span>
      <div className="flex gap-1">
        {YEARS.map((y) => (
          <button
            key={y}
            type="button"
            aria-pressed={year === y}
            onClick={() => onChange(y)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              year === y
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <span className="text-sm text-gray-600">{YEAR_SUMMARY[year]}</span>
    </div>
  );
}
