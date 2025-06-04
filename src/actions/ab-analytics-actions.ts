
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

  const localWarnings: string[] = [];

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
    
    let finalRequiredSampleSize: number | undefined = aiResult.requiredSampleSize;

    if (finalRequiredSampleSize !== undefined) {
      if (isNaN(finalRequiredSampleSize)) {
        finalRequiredSampleSize = undefined; // Treat NaN as undefined
      } else {
        finalRequiredSampleSize = Math.ceil(finalRequiredSampleSize); // Ensure integer if it's a valid number
      }
    }

    let durationEstimates: DurationEstimateRow[] | undefined = undefined;

    if (finalRequiredSampleSize === undefined || finalRequiredSampleSize <= 0) {
      localWarnings.push("AI could not determine a valid required sample size. Duration estimates cannot be calculated.");
      finalRequiredSampleSize = undefined; // Ensure it's explicitly undefined for the result
    } else {
        // Only calculate duration estimates if sample size is valid
        const dailyUsers = numberOfUsers / lookbackDays;
        if (isNaN(dailyUsers) || dailyUsers <= 0) {
            localWarnings.push("Daily user count (from lookback data) is zero, negative, or could not be calculated. Cannot estimate test duration achievability.");
        } else {
            durationEstimates = []; // Initialize as empty array
            const requiredTotalSampleSize = finalRequiredSampleSize * 2; // Assuming 2 variants

            DURATION_OPTIONS_WEEKS.forEach(weeks => {
                const durationInDays = weeks * 7;
                const totalUsersAvailable = dailyUsers * durationInDays;
                durationEstimates!.push({ // Use non-null assertion as we initialized it
                    weeks,
                    totalUsersAvailable: Math.round(totalUsersAvailable),
                    isSufficient: totalUsersAvailable >= requiredTotalSampleSize,
                });
            });
            if (durationEstimates.length === 0) { // Should not happen if DURATION_OPTIONS_WEEKS is not empty
                durationEstimates = undefined;
            }
        }
    }
    
    const combinedWarnings = Array.from(new Set([...(aiResult.warnings || []), ...localWarnings]));
    
    return {
      requiredSampleSize: finalRequiredSampleSize,
      confidenceLevel: aiResult.confidenceLevel !== undefined ? aiResult.confidenceLevel : (1 - significanceLevel),
      powerLevel: aiResult.powerLevel !== undefined ? aiResult.powerLevel : statisticalPower,
      warnings: combinedWarnings.length > 0 ? combinedWarnings : undefined,
      durationEstimates: durationEstimates,
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
    // The form's onSubmit will catch this and show a generic error toast.
    // If specific error information needs to be passed back, this would need to return a result object with an error field.
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

  if (sampleSizePerVariant <= 0 || isNaN(sampleSizePerVariant)) {
    warnings.push("Sample size per variant must be a positive number.");
  }
  if (mean <= 0 || isNaN(mean)) {
    warnings.push("Mean must be a positive number to calculate relative MDE.");
  }
  if (variance < 0 || isNaN(variance)) { 
    warnings.push("Variance must be a non-negative number.");
  }
   if (isNaN(statisticalPower) || statisticalPower <=0 || statisticalPower >=1 ) {
    warnings.push("Statistical power must be between 0 and 1 (exclusive).");
  }
  if (isNaN(significanceLevel) || significanceLevel <=0 || significanceLevel >=1) {
    warnings.push("Significance level must be between 0 and 1 (exclusive).");
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
  if (mean > 0) { // This check is technically redundant due to validation above, but good for clarity
    mdeRelative = (mdeAbsolute / mean) * 100; // As percentage
  } else {
    // This case should be caught by validation now
    warnings.push("Mean is zero or negative, cannot calculate relative MDE. Absolute MDE calculated.");
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

