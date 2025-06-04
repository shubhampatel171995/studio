
"use server";

import { calculateSampleSize as calculateSampleSizeFlow, type CalculateAIFlowInput, type CalculateAIFlowOutput } from '@/ai/flows/sample-size-calculator';
import type { MdeToSampleSizeFormValues, MdeToSampleSizeCalculationResults, SampleSizeToMdeFormValues, SampleSizeToMdeCalculationResults, DurationEstimateRow } from '@/lib/types';
import { Z_ALPHA_DIV_2, Z_BETA, DURATION_OPTIONS_WEEKS } from '@/lib/constants';

// Action for "MDE to Sample Size" flow
export async function calculateSampleSizeAction(formValues: MdeToSampleSizeFormValues): Promise<MdeToSampleSizeCalculationResults> {
  const { 
    metric, 
    mean, 
    variance, 
    numberOfUsers, 
    lookbackDays, 
    realEstate, 
    minimumDetectableEffect, // This is MDE % from form
    statisticalPower, 
    significanceLevel 
  } = formValues;

  try {
    const aiInput: CalculateAIFlowInput = {
      metric,
      mean,
      variance,
      minimumDetectableEffect: minimumDetectableEffect / 100, // Convert MDE % to decimal for AI
      statisticalPower,
      significanceLevel,
    };

    const aiResult: CalculateAIFlowOutput = await calculateSampleSizeFlow(aiInput);
    
    let durationEstimates: DurationEstimateRow[] = [];
    const warnings: string[] = aiResult.warnings ? [...aiResult.warnings] : [];

    if (aiResult.requiredSampleSize === undefined || aiResult.requiredSampleSize <=0) {
        warnings.push("AI could not determine a valid required sample size. Duration estimates cannot be calculated.");
    } else {
        const dailyUsers = numberOfUsers / lookbackDays;
        if (dailyUsers <= 0) {
            warnings.push("Daily user count (from lookback data) is zero or negative. Cannot estimate test duration achievability.");
        } else {
            const requiredTotalSampleSize = aiResult.requiredSampleSize * 2; // Assuming 2 variants

            DURATION_OPTIONS_WEEKS.forEach(weeks => {
                const durationInDays = weeks * 7;
                const totalUsersAvailable = dailyUsers * durationInDays;
                durationEstimates.push({
                    weeks,
                    totalUsersAvailable: Math.round(totalUsersAvailable),
                    isSufficient: totalUsersAvailable >= requiredTotalSampleSize,
                });
            });
        }
    }
    
    return {
      requiredSampleSize: aiResult.requiredSampleSize,
      confidenceLevel: aiResult.confidenceLevel !== undefined ? aiResult.confidenceLevel : (1 - significanceLevel),
      powerLevel: aiResult.powerLevel !== undefined ? aiResult.powerLevel : statisticalPower,
      warnings: warnings.length > 0 ? warnings : undefined,
      durationEstimates: durationEstimates.length > 0 ? durationEstimates : undefined,
      // Pass through original form values for comprehensive report
      metric,
      mean,
      variance,
      numberOfUsers,
      lookbackDays,
      realEstate,
      minimumDetectableEffect: minimumDetectableEffect / 100, // MDE as decimal
      significanceLevel,
    };

  } catch (error) {
    console.error("Error in calculateSampleSizeAction:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to calculate sample size.");
  }
}

// Action for "Sample Size to MDE" flow
export async function calculateMdeFromSampleSizeAction(formValues: SampleSizeToMdeFormValues): Promise<Omit<SampleSizeToMdeCalculationResults, 'inputs'>> {
  const {
    mean,
    variance,
    sampleSizePerVariant,
    statisticalPower,
    significanceLevel,
  } = formValues;

  const warnings: string[] = [];

  if (sampleSizePerVariant <= 0) {
    warnings.push("Sample size per variant must be positive.");
  }
  if (mean <= 0) {
    warnings.push("Mean must be positive to calculate relative MDE.");
  }
  if (variance < 0) { // Variance can be 0 for some theoretical cases, but usually non-negative
    warnings.push("Variance must be non-negative.");
  }

  if (warnings.length > 0) {
    return { warnings, achievableMde: undefined, confidenceLevel: 1 - significanceLevel, powerLevel: statisticalPower };
  }

  const zAlphaDiv2 = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
  const zBeta = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

  // MDE_abs = (Z_alpha/2 + Z_beta) * sqrt(2 * variance / N_per_group)
  const mdeAbsolute = (zAlphaDiv2 + zBeta) * Math.sqrt((2 * variance) / sampleSizePerVariant);
  
  // MDE_rel = MDE_abs / mean
  let mdeRelative = NaN;
  if (mean > 0) {
    mdeRelative = (mdeAbsolute / mean) * 100; // As percentage
  } else {
    warnings.push("Mean is zero or negative, cannot calculate relative MDE. Absolute MDE calculated.");
    // Optionally, you could return mdeAbsolute here if relative MDE is not possible.
  }
  
  if (isNaN(mdeRelative) || !isFinite(mdeRelative)) {
      warnings.push(`Could not calculate a valid MDE. Check inputs (variance, mean > 0, sample size > 0).`);
      return { warnings, achievableMde: undefined, confidenceLevel: 1 - significanceLevel, powerLevel: statisticalPower };
  }

  return { 
    achievableMde: parseFloat(mdeRelative.toFixed(2)), 
    warnings: warnings.length > 0 ? warnings : undefined,
    confidenceLevel: 1 - significanceLevel,
    powerLevel: statisticalPower,
  };
}
