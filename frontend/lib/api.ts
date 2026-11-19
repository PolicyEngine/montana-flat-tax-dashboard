/**
 * Household impact via the public PolicyEngine API
 * (https://api.policyengine.org/us). Each request runs two
 * calculations per sweep point, current law (baseline) and the
 * governor's proposal (reform), and returns the employment-income
 * sweep plus point values:
 *
 *   impact = reform (governor's proposal) - baseline (current law)
 *
 * A lower Montana income tax or a larger Montana earned income tax
 * credit raises household net income, so a gain shows as a positive
 * net-income change.
 */

import { HouseholdRequest, HouseholdImpactResponse } from "./types";
import { runHouseholdSweep } from "./householdApi";

export const api = {
  async calculateHouseholdImpact(
    request: HouseholdRequest,
  ): Promise<HouseholdImpactResponse> {
    const result = await runHouseholdSweep({
      age_head: request.age_head,
      age_spouse: request.age_spouse,
      dependent_ages: request.dependent_ages,
      income: request.income,
      year: request.year,
      max_earnings: request.max_earnings,
      state_code: request.state_code || "MT",
    });

    return {
      income_range: result.income_range,
      net_income_change: result.net_income_change,
      federalTaxChange: result.income_tax_change,
      stateTaxChange: result.state_income_tax_change,
      netIncomeChange: result.net_income_change,
      provisions: result.provisions,
      provisions_at_income: result.provisions_at_income,
      benefit_at_income: {
        baseline: result.benefit_at_income.baseline,
        reform: result.benefit_at_income.reform,
        difference: result.benefit_at_income.difference,
        federal_tax_change: result.benefit_at_income.federal_tax_change,
        state_tax_change: result.benefit_at_income.state_tax_change,
        net_income_change: result.benefit_at_income.difference,
      },
      x_axis_max: request.max_earnings,
    };
  },
};
