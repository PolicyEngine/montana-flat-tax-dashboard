'use client';

import { useState, useEffect } from 'react';
import MTDistrictMap, { MTDistrictData } from './DynamicDistrictMap';
import ChartWatermark from './ChartWatermark';
import { DEFAULT_YEAR, YEAR_SUMMARY, type ReformYear } from '@/lib/montana';

interface Props {
  year?: ReformYear;
}

// Montana representatives for the 120th Congress (convenes January 3, 2027),
// as elected on November 3, 2026. Maintained by hand: update after each
// election. The proposal's tax years (2028 and 2029) begin during this
// Congress.
const MT_REPRESENTATIVES: Record<
  string,
  { name: string; party: 'R' | 'D'; region: string }
> = {
  '1': { name: 'Sam Forstag', party: 'D', region: 'Western Montana' },
  '2': { name: 'Troy Downing', party: 'R', region: 'Eastern Montana' },
};

function partyColor(party: 'R' | 'D' | undefined) {
  if (party === 'R') return 'var(--party-r)';
  if (party === 'D') return 'var(--party-d)';
  return 'var(--party-none)';
}

export default function CongressionalDistrictImpact({ year = DEFAULT_YEAR }: Props) {
  const [data, setData] = useState<MTDistrictData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  useEffect(() => {
    const basePath =
      process.env.NEXT_PUBLIC_BASE_PATH !== undefined
        ? process.env.NEXT_PUBLIC_BASE_PATH
        : '/us/montana-flat-tax-dashboard';

    let cancelled = false;

    fetch(`${basePath}/data/congressional_districts.csv`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load district data');
        return res.text();
      })
      .then((text) => {
        const lines = text.trim().split(/\r?\n/);
        const headers = lines[0].split(',').map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          const row: Record<string, string | number> = {};
          headers.forEach((h, i) => {
            const val = values[i];
            if (val === undefined || val === '') return;
            row[h] = isNaN(Number(val)) ? val : Number(val);
          });
          return row as unknown as MTDistrictData & { state: string; year: number };
        });
        const mtRows = rows
          .filter((r) => r.state === 'MT' && r.year === year)
          .map((r) => {
            const districtNum = String(r.district).split('-')[1] || '';
            const districtId = districtNum.replace(/^0+/, '') || districtNum;
            const rep = MT_REPRESENTATIVES[districtId];
            return {
              ...r,
              district_number: districtId,
              representative: rep?.name || '',
              party: rep?.party,
              region: rep?.region || '',
            } as MTDistrictData;
          })
          .sort((a, b) => Number(a.district_number) - Number(b.district_number));
        if (cancelled) return;
        setData(mtRows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading Montana district data...</p>
        </div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-yellow-800 font-semibold mb-2">
          Montana district data not yet available
        </h2>
        <p className="text-yellow-700">
          {error || 'Montana district-level impact data has not been generated yet.'}
        </p>
        <p className="text-yellow-700 mt-2">
          Run: <code className="bg-yellow-100 px-2 py-1 rounded">python scripts/district_pipeline.py</code>
        </p>
      </div>
    );
  }

  const selectedData = selectedDistrict
    ? data.find((d) => d.district_number === selectedDistrict) || null
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Montana congressional district impacts ({year})
        </h3>
        <p className="text-gray-600">
          Average household impact by congressional district under the
          proposal for tax year {year} ({YEAR_SUMMARY[year]}) vs. current law.
          Hover over a district for details and click to pin.
        </p>
      </div>

      {/* Map */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <MTDistrictMap
          data={data}
          selectedDistrict={selectedDistrict}
          onSelect={(districtNum) =>
            setSelectedDistrict((prev) =>
              prev === districtNum ? null : districtNum,
            )
          }
        />
        <ChartWatermark />
      </div>

      {/* Detail card below map */}
      {selectedData ? (
        <DistrictDetailCard
          district={selectedData}
          onClose={() => setSelectedDistrict(null)}
        />
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
          <p className="text-gray-500 text-sm">
            Click a district on the map to see detailed impact analysis.
          </p>
        </div>
      )}

      {/* All districts table */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">
          All Montana districts
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">District</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Representative</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Winners</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-900">Average change</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr
                  key={d.district_number}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedDistrict === d.district_number ? 'bg-primary-50' : ''
                  }`}
                  onClick={() =>
                    setSelectedDistrict((prev) =>
                      prev === d.district_number ? null : d.district_number,
                    )
                  }
                >
                  <td className="py-3 px-4 text-gray-700 font-medium">
                    MT-{String(d.district_number).padStart(2, '0')}
                    <span className="block text-xs text-gray-500 font-normal">{d.region}</span>
                  </td>
                  <td className="py-3 px-4" style={{ color: partyColor(d.party) }}>
                    {d.representative}
                    {d.party ? <span className="ml-1 text-xs">({d.party})</span> : null}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {d.winners_share !== undefined
                      ? `${(d.winners_share * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    {d.average_household_income_change >= 0 ? '+' : ''}
                    ${d.average_household_income_change.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology note */}
      <p className="text-xs text-gray-500">
        Winners are households whose net income rises, matching the statewide
        tab. District estimates use the Montana households in each district
        from the same Populace dataset as the statewide estimate, so the two
        districts add up to the statewide figure. Representatives are those elected in November 2026
        to the 120th Congress, which convenes in January 2027.
      </p>
    </div>
  );
}

function DistrictDetailCard({
  district,
  onClose,
}: {
  district: MTDistrictData;
  onClose: () => void;
}) {
  const avgChange = district.average_household_income_change;
  const isPositive = avgChange > 0;
  const isNegative = avgChange < 0;
  const winnersShare = district.winners_share ?? 0;
  const losersShare = district.losers_share ?? 0;
  // "No change" is the residual after winners + losers.
  const noChangeShare = Math.max(0, 1 - winnersShare - losersShare);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold text-lg"
            style={{
              backgroundColor: isPositive
                ? 'var(--primary-500)'
                : isNegative
                  ? 'var(--gray-600)'
                  : 'var(--gray-400)',
            }}
          >
            {district.district_number}
          </span>
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              Montana District {district.district_number}
            </h4>
            <p className="text-sm text-gray-500">
              <span style={{ color: partyColor(district.party) }}>
                {district.representative}
                {district.party ? ` (${district.party})` : ''}
              </span>
              {district.region ? ` — ${district.region}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Average household impact
          </p>
          <p
            className={`text-xl font-bold ${
              isPositive ? 'text-primary-700' : isNegative ? 'text-red-700' : 'text-gray-700'
            }`}
          >
            {isPositive ? '+' : ''}
            ${avgChange.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">per household, per year</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Winners</p>
          <p className="text-xl font-bold text-primary-600">
            {(winnersShare * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">of households gain</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Losers</p>
          <p className="text-xl font-bold text-gray-700">
            {(losersShare * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">of households</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">No change</p>
          <p className="text-xl font-bold text-gray-600">
            {(noChangeShare * 100).toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">of households</p>
        </div>
      </div>
    </div>
  );
}
