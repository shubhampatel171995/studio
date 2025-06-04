
"use server";

import { calculateSampleSize as calculateSampleSizeFlow, type CalculateSampleSizeInput, type CalculateSampleSizeOutput } from '@/ai/flows/sample-size-calculator';
import type { MdeExplorerFormValues, MdeExplorerResults, MdeResultRow } from '@/lib/types';
import { Z_ALPHA_DIV_2, Z_BETA } from '@/lib/constants';

export async function calculateSampleSizeAction(input: CalculateSampleSizeInput): Promise<CalculateSampleSizeOutput> {
  try {
    const result = await calculateSampleSizeFlow(input);
    // Ensure estimatedTestDuration is rounded nicely
    if (result.estimatedTestDuration) {
      result.estimatedTestDuration = Math.ceil(result.estimatedTestDuration);
    }
    return result;
  } catch (error) {
    console.error("Error in calculateSampleSizeAction:", error);
    // It's better to throw a custom error or return an error structure
    // For now, re-throwing but you might want to shape this for the client
    throw new Error("Failed to calculate sample size via AI flow.");
  }
}

export async function calculateMdeDataAction(input: MdeExplorerFormValues): Promise<MdeExplorerResults> {
  const {
    mean,
    variance,
    numberOfUsers,
    lookbackDays,
    statisticalPower,
    significanceLevel,
    experimentDurations,
  } = input;

  const warnings: string[] = [];
  const dailyUsers = numberOfUsers / lookbackDays;

  if (dailyUsers <= 0) {
    warnings.push("Daily user count is zero or negative. Cannot calculate MDE.");
    return { tableData: [], chartData: [], warnings };
  }
  
  if (mean <= 0) {
    warnings.push("Mean must be positive to calculate relative MDE.");
     return { tableData: [], chartData: [], warnings };
  }


  const zAlphaDiv2 = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
  const zBeta = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

  const tableData: MdeResultRow[] = [];

  for (const weeks of experimentDurations) {
    const durationInDays = weeks * 7;
    const totalUsersForDuration = dailyUsers * durationInDays;
    const nPerGroup = totalUsersForDuration / 2; // Assuming 2 variants (A/B test)

    if (nPerGroup <= 0) {
      warnings.push(`Insufficient users for ${weeks}-week duration to calculate MDE.`);
      continue;
    }

    // MDE_abs = (Z_alpha/2 + Z_beta) * sqrt(2 * variance / N_per_group)
    const mdeAbsolute = (zAlphaDiv2 + zBeta) * Math.sqrt((2 * variance) / nPerGroup);
    // MDE_rel = MDE_abs / mean
    const mdeRelative = (mdeAbsolute / mean) * 100; // As percentage

    if (isNaN(mdeRelative) || !isFinite(mdeRelative)) {
        warnings.push(`Could not calculate a valid MDE for ${weeks}-week duration. Check inputs (variance, mean > 0).`);
        continue;
    }

    tableData.push({
      weeks,
      totalUsers: Math.round(totalUsersForDuration),
      achievableMde: parseFloat(mdeRelative.toFixed(2)),
      confidence: (1 - significanceLevel) * 100,
      power: statisticalPower * 100,
    });
  }

  const chartData = tableData.map(row => ({ weeks: row.weeks, mde: row.achievableMde }));
  
  tableData.sort((a,b) => a.weeks - b.weeks);
  chartData.sort((a,b) => a.weeks - b.weeks);

  return { tableData, chartData, warnings: warnings.length > 0 ? warnings : undefined };
}
