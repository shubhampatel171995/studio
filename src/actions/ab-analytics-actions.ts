
"use server";

import { calculateSampleSize as calculateSampleSizeFlow, type CalculateAIFlowInput, type CalculateAIFlowOutput } from '@/ai/flows/sample-size-calculator';
import type { MdeToSampleSizeFormValues, MdeToSampleSizeCalculationResults, SampleSizeToMdeFormValues, SampleSizeToMdeCalculationResults, DurationEstimateRow } from '@/lib/types';
import { Z_ALPHA_DIV_2, Z_BETA, DURATION_OPTIONS_WEEKS } from '@/lib/constants';

// Action for "MDE to Sample Size" flow
export async function calculateSampleSizeAction(formValues: MdeToSampleSizeFormValues): Promise<MdeToSampleSizeCalculationResults> {
  const { 
    metric, 
    metricType,
    mean, 
    variance, 
    realEstate,    
    minimumDetectableEffect, // This is MDE % from form
    statisticalPower, 
    significanceLevel,
    historicalDailyTraffic, 
    targetExperimentDurationDays,
    lookbackDays, // Contextual: For Excel this is targetExperimentDurationDays, for Manual it's targetExperimentDurationDays. Used for reporting.
  } = formValues;

  const localWarnings: string[] = [];
  let exposureNeededPercentage: number | undefined = undefined;

  try {
    const aiInput: CalculateAIFlowInput = {
      metric, 
      metricType,
      mean,
      variance,
      minimumDetectableEffect: minimumDetectableEffect / 100, // Convert MDE % to decimal for AI
      statisticalPower,
      significanceLevel,
    };

    const aiResult: CalculateAIFlowOutput = await calculateSampleSizeFlow(aiInput);
    
    let finalRequiredSampleSize: number | undefined = aiResult.requiredSampleSize;

    if (finalRequiredSampleSize !== undefined) {
      if (isNaN(finalRequiredSampleSize) || finalRequiredSampleSize <=0) {
        finalRequiredSampleSize = undefined; 
      } else {
        finalRequiredSampleSize = Math.ceil(finalRequiredSampleSize);
      }
    }
    
    let durationEstimates: DurationEstimateRow[] | undefined = undefined;
    
    if (finalRequiredSampleSize === undefined || finalRequiredSampleSize <= 0) {
      localWarnings.push("AI could not determine a valid required sample size. Exposure and duration estimates cannot be calculated.");
      finalRequiredSampleSize = undefined; 
    } else {
        if (historicalDailyTraffic === undefined || isNaN(historicalDailyTraffic) || historicalDailyTraffic <= 0) {
            localWarnings.push("Historical daily traffic is invalid or missing. Cannot calculate exposure percentage or duration estimates.");
        } else {
            // Calculate exposure needed for the target experiment duration
            const totalRequiredSampleSizeForExposure = finalRequiredSampleSize * 2; // Assuming 2 variants
            const totalAvailableTrafficInTargetDuration = historicalDailyTraffic * targetExperimentDurationDays;

            if (totalAvailableTrafficInTargetDuration > 0) {
                exposureNeededPercentage = (totalRequiredSampleSizeForExposure / totalAvailableTrafficInTargetDuration) * 100;
            } else {
                localWarnings.push("Total available traffic for target duration is zero or historical daily traffic is too low. Cannot calculate exposure percentage.");
            }
            
            // Calculate duration estimates table (based on 100% exposure of historical daily traffic)
            durationEstimates = []; 
            const requiredTotalSampleSizeForTable = finalRequiredSampleSize * 2; 

            DURATION_OPTIONS_WEEKS.forEach(weeks => {
                const durationInDaysForTableOption = weeks * 7;
                const totalUsersAvailable = historicalDailyTraffic * durationInDaysForTableOption;
                durationEstimates!.push({ 
                    weeks,
                    totalUsersAvailable: Math.round(totalUsersAvailable),
                    isSufficient: totalUsersAvailable >= requiredTotalSampleSizeForTable,
                });
            });
            if (durationEstimates.length === 0) { 
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
      exposureNeededPercentage: exposureNeededPercentage,
      // Pass through original form values for comprehensive report
      metric,
      metricType,
      mean,
      variance,
      lookbackDays: lookbackDays || targetExperimentDurationDays, // For report context, use target duration if lookbackDays wasn't explicitly set (e.g. manual calc)
      realEstate,
      minimumDetectableEffect: minimumDetectableEffect / 100, // MDE as decimal
      significanceLevel,
      historicalDailyTraffic, 
      targetExperimentDurationDays,
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

  const zAlphaDiv2Value = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
  const zBetaValue = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

  // MDE_abs = (Z_alpha/2 + Z_beta) * sqrt(2 * variance / N_per_group)
  const mdeAbsolute = (zAlphaDiv2Value + zBetaValue) * Math.sqrt((2 * variance) / sampleSizePerVariant);
  
  // MDE_rel = MDE_abs / mean
  let mdeRelative = NaN;
  if (mean > 0) { 
    mdeRelative = (mdeAbsolute / mean) * 100; // As percentage
  } else {
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
