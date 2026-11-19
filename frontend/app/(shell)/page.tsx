'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ImpactAnalysis from '@/components/ImpactAnalysis';
import AggregateImpact from '@/components/AggregateImpact';
import PolicyOverview from '@/components/PolicyOverview';
import CongressionalDistrictImpact from '@/components/CongressionalDistrictImpact';
import ValidationTab from '@/components/ValidationTab';
import ExampleHouseholds, { type ExampleHouseholdProfile } from '@/components/ExampleHouseholds';
import type { HouseholdRequest, HouseholdImpactResponse } from '@/lib/types';
import { parseHashParams, type TabId } from '@/lib/embedding';
import YearToggle from '@/components/YearToggle';
import { DEFAULT_YEAR, type ReformYear } from '@/lib/montana';

/** Tabs whose results depend on the selected tax year. */
const YEAR_TABS: TabId[] = ['impact', 'aggregate', 'districts'];

export default function Home() {
  // Initialize the active tab from the URL hash (embedding support)
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === 'undefined') return 'policy';
    return parseHashParams(window.location.hash).tab ?? 'policy';
  });

  // The proposal phases in, so the household, statewide, and district
  // tabs share one tax-year selection.
  const [year, setYear] = useState<ReformYear>(DEFAULT_YEAR);

  const TAB_CONFIG = [
    { id: 'policy' as const, label: 'Policy overview' },
    { id: 'impact' as const, label: 'Household impact' },
    { id: 'aggregate' as const, label: 'Statewide impact' },
    { id: 'districts' as const, label: 'Congressional districts' },
    { id: 'validation' as const, label: 'Validation' },
  ];

  // Simple tab change handler
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero section */}
      <section className="bg-primary-500 text-white py-8 px-4 shadow-md" aria-label="Page introduction">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">
            Montana flat income tax dashboard
          </h1>
          <p className="text-lg opacity-90">
            Estimate the impact of Gov. Gianforte&apos;s proposed flat 4.7% income tax rate and earned income tax credit increase
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Tabs */}
        <nav aria-label="Dashboard sections">
          <div className="flex flex-wrap gap-1 mb-4" role="tablist" aria-label="Dashboard tabs">
            {TAB_CONFIG.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => handleTabChange(tab.id)}
                className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-primary-600 border-t-4 border-primary-500'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Tab content */}
        <section
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="bg-white rounded-lg shadow-md p-6"
        >
          {YEAR_TABS.includes(activeTab) && (
            <div className="mb-6">
              <YearToggle year={year} onChange={setYear} />
            </div>
          )}
          {activeTab === 'policy' ? (
            <PolicyOverview />
          ) : activeTab === 'impact' ? (
            <HouseholdImpactTab year={year} />
          ) : activeTab === 'aggregate' ? (
            <StatewideImpactTab year={year} />
          ) : activeTab === 'districts' ? (
            <CongressionalDistrictImpact year={year} />
          ) : (
            <ValidationTab />
          )}
        </section>
      </div>
    </main>
  );
}

/** Household impact tab */
function HouseholdImpactTab({ year }: { year: ReformYear }) {
  // Initialize state from hash parameters if present
  // All households are Montana residents; the state is locked to MT.
  const getInitialValues = () => {
    if (typeof window === 'undefined') {
      return { income: 90000, age: 35, state: 'MT', married: false, dependents: [] as number[] };
    }
    const params = parseHashParams(window.location.hash);
    return {
      income: params.income ?? 90000,
      age: params.age ?? 35,
      state: 'MT',
      married: params.married ?? false,
      dependents: params.dependents ?? [],
    };
  };

  const initialValues = getInitialValues();
  const [ageHead, setAgeHead] = useState(initialValues.age);
  const [ageHeadRaw, setAgeHeadRaw] = useState(String(initialValues.age));
  const [ageSpouse, setAgeSpouse] = useState<number | null>(initialValues.married ? 35 : null);
  const [ageSpouseRaw, setAgeSpouseRaw] = useState('35');
  const [married, setMarried] = useState(initialValues.married);
  const [dependentAges, setDependentAges] = useState<number[]>(initialValues.dependents);
  const [income, setIncome] = useState(initialValues.income);
  const [maxEarnings, setMaxEarnings] = useState(100000);
  const [triggered, setTriggered] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<HouseholdRequest | null>(null);
  const [precomputedImpact, setPrecomputedImpact] =
    useState<HouseholdImpactResponse | null>(null);
  const [selectedExampleLabel, setSelectedExampleLabel] = useState<string | null>(null);
  const impactRef = useRef<HTMLDivElement | null>(null);

  // Results are specific to a tax year. When the year changes, clear the
  // displayed result (the form inputs stay) so nothing from the other
  // year remains on screen.
  const [resultsYear, setResultsYear] = useState(year);
  if (resultsYear !== year) {
    setResultsYear(year);
    setSubmittedRequest(null);
    setPrecomputedImpact(null);
    setSelectedExampleLabel(null);
    setTriggered(false);
  }

  useEffect(() => {
    if (selectedExampleLabel && impactRef.current) {
      impactRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedExampleLabel]);

  // Listen for hash changes to update form values
  useEffect(() => {
    const handleHashChange = () => {
      const params = parseHashParams(window.location.hash);
      if (params.income !== undefined) setIncome(params.income);
      if (params.age !== undefined) {
        setAgeHead(params.age);
        setAgeHeadRaw(String(params.age));
      }
      // State is locked to Montana; ignore any state hash param.
      if (params.married !== undefined) {
        setMarried(params.married);
        if (params.married) {
          setAgeSpouse(35);
          setAgeSpouseRaw('35');
        } else {
          setAgeSpouse(null);
        }
      }
      if (params.dependents) setDependentAges(params.dependents);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleMarriedChange = (value: boolean) => {
    setMarried(value);
    if (!value) {
      setAgeSpouse(null);
    } else {
      setAgeSpouse(35);
      setAgeSpouseRaw('35');
    }
  };

  const handleDependentCountChange = (count: number) => {
    const ages = [...dependentAges];
    while (ages.length < count) ages.push(5);
    ages.splice(count);
    setDependentAges(ages);
  };

  const formatNumber = (num: number) => num.toLocaleString('en-US');
  const parseNumber = (str: string) => {
    const num = Number(str.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const buildRequest = (): HouseholdRequest => ({
    age_head: ageHead,
    age_spouse: married ? ageSpouse : null,
    dependent_ages: dependentAges,
    income,
    year,
    max_earnings: maxEarnings,
    state_code: 'MT',
  });

  const handleCalculate = () => {
    setSubmittedRequest(buildRequest());
    setTriggered(true);
    setPrecomputedImpact(null);
    setSelectedExampleLabel(null);
  };

  /** Click handler from ExampleHouseholds. */
  const handleSelectExample = (
    profile: ExampleHouseholdProfile,
    response: HouseholdImpactResponse,
  ) => {
    const exampleState = 'MT';
    setSelectedExampleLabel(profile.label);
    setIncome(profile.income);
    setAgeHead(profile.age_head);
    setAgeHeadRaw(String(profile.age_head));
    setMarried(profile.married);
    setAgeSpouse(profile.married ? 35 : null);
    setAgeSpouseRaw('35');
    setDependentAges(profile.dependents);
    const exampleMaxEarnings = response.x_axis_max ?? maxEarnings;
    setMaxEarnings(exampleMaxEarnings);
    setSubmittedRequest({
      age_head: profile.age_head,
      age_spouse: profile.married ? 35 : null,
      dependent_ages: profile.dependents,
      income: profile.income,
      year,
      max_earnings: exampleMaxEarnings,
      state_code: exampleState,
    });
    setPrecomputedImpact(response);
    setTriggered(true);
  };

  return (
    <div className="space-y-6">
      {/* Pre-computed example households — clicking one populates the
          form below and the existing impact chart with precomputed
          values (no live API call). */}
      <ExampleHouseholds
        onSelect={handleSelectExample}
        selectedLabel={selectedExampleLabel}
        year={year}
      />

      {/* Inline household config */}
      <section className="bg-gray-50 rounded-xl p-6 md:p-8 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Your household</h2>

        {/* Row 1: Income, Age, Filing status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
          {/* Employment income */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Employment income
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
              <input
                type="text"
                value={formatNumber(income)}
                onChange={(e) => setIncome(parseNumber(e.target.value))}
                className="w-full pl-6 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Your age</label>
            <input
              type="number"
              value={ageHeadRaw}
              onChange={(e) => setAgeHeadRaw(e.target.value)}
              onBlur={() => {
                const clamped = Math.max(18, Math.min(100, parseInt(ageHeadRaw) || 18));
                setAgeHead(clamped);
                setAgeHeadRaw(String(clamped));
              }}
              min={18}
              max={100}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>

          {/* Married + spouse age */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Filing status</label>
            <label
              htmlFor="married"
              className="flex items-center gap-3 w-full px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <input
                type="checkbox"
                id="married"
                checked={married}
                onChange={(e) => handleMarriedChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Married filing jointly</span>
            </label>
            {married && (
              <input
                type="number"
                value={ageSpouseRaw}
                onChange={(e) => setAgeSpouseRaw(e.target.value)}
                onBlur={() => {
                  const clamped = Math.max(18, Math.min(100, parseInt(ageSpouseRaw) || 18));
                  setAgeSpouse(clamped);
                  setAgeSpouseRaw(String(clamped));
                }}
                min={18}
                max={100}
                placeholder="Spouse age"
                aria-label="Spouse age"
                className="w-full mt-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            )}
          </div>
        </div>

        {/* Row 2: Dependents, State */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5 mt-5">
          {/* Dependents */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Dependents</label>
            <input
              type="number"
              value={dependentAges.length}
              onChange={(e) => handleDependentCountChange(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
              min={0}
              max={10}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
            {dependentAges.length > 0 && (
              <div className="mt-2">
                <span className="block text-xs font-medium text-gray-500 mb-1">Age(s): dependents affect filing status and the earned income tax credit</span>
                <div className="grid grid-cols-3 gap-1.5">
                {dependentAges.map((age, i) => (
                  <input
                    key={i}
                    type="number"
                    value={age}
                    onChange={(e) => {
                      const newAges = [...dependentAges];
                      newAges[i] = Math.max(0, Math.min(26, parseInt(e.target.value) || 0));
                      setDependentAges(newAges);
                    }}
                    min={0}
                    max={26}
                    className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    placeholder={`Age ${i + 1}`}
                    aria-label={`Dependent ${i + 1} age`}
                  />
                ))}
                </div>
              </div>
            )}
          </div>

          {/* State (locked to Montana) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">State</label>
            <div
              className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700"
              aria-label="State"
            >
              Montana
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The proposal applies to Montana income tax, so all households
              are modeled as Montana residents.
            </p>
          </div>
        </div>

        {/* Calculate button */}
        <div className="mt-8">
          <button
            onClick={handleCalculate}
            className="py-3 px-10 rounded-lg font-semibold text-white bg-primary-500 hover:bg-primary-600 active:bg-primary-700 transition-all shadow-sm hover:shadow-md sm:w-auto w-full"
          >
            Calculate impact
          </button>
        </div>
      </section>

      {/* Impact results */}
      {submittedRequest && (
        <div ref={impactRef} className="scroll-mt-4">
          <ImpactAnalysis
            request={submittedRequest}
            triggered={triggered}
            maxEarnings={maxEarnings}
            precomputed={precomputedImpact}
          />
        </div>
      )}
    </div>
  );
}

/** Statewide impact tab */
function StatewideImpactTab({ year }: { year: ReformYear }) {
  return (
    <div className="space-y-6">
      <AggregateImpact triggered={true} year={year} />
    </div>
  );
}
