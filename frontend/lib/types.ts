export interface HouseholdRequest {
  age_head: number;
  age_spouse: number | null;
  dependent_ages: number[];
  income: number;
  year: number;
  max_earnings: number;
  state_code: string;
}

export interface BenefitAtIncome {
  baseline: number;
  reform: number;
  difference: number;
  federal_tax_change: number;
  state_tax_change: number;
  net_income_change: number;
}

/** Per-provision decomposition, household perspective (positive = gain).
 *  The three rows sum to the net income change:
 *  - rate_change: fall in Montana income tax from the lower top rate
 *  - eitc_change: rise in the Montana earned income tax credit
 *  - federal_tax_change: fall in federal income tax (negative when a
 *    smaller Montana tax bill shrinks the federal deduction for state
 *    and local taxes) */
export interface ProvisionBreakdown {
  rate_change: number;
  eitc_change: number;
  federal_tax_change: number;
}

export type ProvisionSeries = { [K in keyof ProvisionBreakdown]: number[] };

export interface HouseholdImpactResponse {
  income_range: number[];
  net_income_change: number[];
  federalTaxChange: number[];
  stateTaxChange: number[];
  netIncomeChange: number[];
  /** Optional: absent from pre-provisions cached results. */
  provisions?: ProvisionSeries;
  provisions_at_income?: ProvisionBreakdown;
  benefit_at_income: BenefitAtIncome;
  x_axis_max: number;
}

export interface IncomeBracket {
  bracket: string;
  beneficiaries: number;
  total_cost: number;
  avg_benefit: number;
}

export interface BudgetImpact {
  baseline_net_income: number;
  /** Total budgetary impact = Montana's own fiscal cost (negative =
   *  revenue loss). For a state income-tax cut this equals the state
   *  revenue change; the federal interaction accrues to the federal
   *  government and is shown separately. */
  budgetary_impact: number;
  /** Federal income-tax revenue change from the reform (positive =
   *  federal government collects more, via reduced SALT deductions). */
  federal_tax_revenue_impact: number;
  /** Montana state income-tax revenue change (negative = revenue loss). */
  state_tax_revenue_impact: number;
  /** State revenue change from the rate change alone; null when the
   *  data file predates the provision split. */
  rate_cut_state_revenue_impact: number | null;
  /** State revenue change from the EITC increase alone. */
  eitc_state_revenue_impact: number | null;
  tax_revenue_impact: number;
  households: number;
}

export interface DecileImpact {
  average: Record<string, number>;
  relative: Record<string, number>;
}

export interface IntraDecileAll {
  gain_more_than_5pct: number;
  gain_less_than_5pct: number;
  no_change: number;
  lose_less_than_5pct: number;
  lose_more_than_5pct: number;
}

export interface IntraDecileDeciles {
  gain_more_than_5pct: number[];
  gain_less_than_5pct: number[];
  no_change: number[];
  lose_less_than_5pct: number[];
  lose_more_than_5pct: number[];
}

export interface IntraDecile {
  all: IntraDecileAll;
  deciles: IntraDecileDeciles;
}

export interface PovertyGroup {
  baseline: number;
  reform: number;
}

export interface PovertyCategory {
  all: PovertyGroup;
  child: PovertyGroup;
}

export interface PovertyImpact {
  poverty: PovertyCategory;
  deep_poverty: PovertyCategory;
}

export interface AggregateImpactResponse {
  budget: BudgetImpact;
  decile: DecileImpact;
  intra_decile: IntraDecile;
  poverty: PovertyImpact;
  total_cost: number;
  beneficiaries: number;
  avg_benefit: number;
  winners: number;
  losers: number;
  winners_rate: number;
  losers_rate: number;
  poverty_baseline_rate: number;
  poverty_reform_rate: number;
  poverty_rate_change: number;
  poverty_percent_change: number;
  child_poverty_baseline_rate: number;
  child_poverty_reform_rate: number;
  child_poverty_rate_change: number;
  child_poverty_percent_change: number;
  deep_poverty_baseline_rate: number;
  deep_poverty_reform_rate: number;
  deep_poverty_rate_change: number;
  deep_poverty_percent_change: number;
  deep_child_poverty_baseline_rate: number;
  deep_child_poverty_reform_rate: number;
  deep_child_poverty_rate_change: number;
  deep_child_poverty_percent_change: number;
  by_income_bracket: IncomeBracket[];
}

export interface HealthResponse {
  status: string;
  version: string;
}

/* ──────────────────────────────────────────────────────────────────
 * Validation data (public/data/validation.json, schema_version 4)
 *
 * The pinned Montana runs for each tax year, by provision. The external
 * figures they are compared against (the Governor's budget office
 * estimates) are constants in lib/montana.ts. The frontend renders a
 * "pending pinned run" state while the file is absent (404) or carries
 * an older schema.
 * ────────────────────────────────────────────────────────────────── */

/** One pinned run. Amounts are Montana's own income-tax revenue change
 *  in nominal USD (negative = revenue loss). *_percent_change values
 *  are percent (already x100); negative = reduction. */
export interface ValidationRun {
  year: number;
  state_revenue_impact: number;
  rate_cut_state_revenue_impact: number;
  eitc_state_revenue_impact: number;
  /** Current-law Montana income tax in the pinned run. */
  baseline_state_income_tax?: number;
  poverty_percent_change: number;
  child_poverty_percent_change: number;
}

export interface ValidationProvenance {
  policyengine_us: string;
  dataset: string;
  reform: Record<string, Record<string, boolean | number>>;
  run_timestamp?: string;
}

export interface ValidationData {
  schema_version: number;
  runs: ValidationRun[];
  provenance: ValidationProvenance;
}
