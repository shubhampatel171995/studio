
"use server";

import type { MdeToSampleSizeFormValues, MdeToSampleSizeCalculationResults, SampleSizeToMdeFormValues, SampleSizeToMdeCalculationResults, DirectCalculationOutput } from '@/lib/types';
import { Z_ALPHA_DIV_2, Z_BETA } from '@/lib/constants';

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
    numberOfVariants, // New field
    totalUsersInSelectedDuration, // For Excel-driven or manual entry for MDE->SS
    targetExperimentDurationDays,
    lookbackDays, 
    historicalDailyTraffic, // Only for Manual Calculator flow
  } = formValues;

  const localWarnings: string[] = [];
  let requiredSampleSizePerVariantValue: number | undefined = undefined; // Renamed for clarity
  const mdeDecimal = minimumDetectableEffect / 100; // Convert MDE % to decimal

  // Input validations
  if (metricType === "Binary") {
    if (mean < 0 || mean > 1) {
      localWarnings.push('Warning: For Binary metric, Mean (proportion) should be between 0 and 1.');
    }
    const calculatedVarianceBinary = mean * (1 - mean);
    if (Math.abs(variance - calculatedVarianceBinary) > 1e-9 && !isNaN(calculatedVarianceBinary) && !isNaN(variance)) { 
      localWarnings.push(`Warning: Provided variance (${variance.toFixed(6)}) for Binary metric differs from calculated (p*(1-p) = ${calculatedVarianceBinary.toFixed(6)}). Using provided variance for calculation.`);
    }
  } else if (metricType === "Continuous") {
    if (mean <= 0) {
      localWarnings.push('Warning: For Continuous metric, Mean should be positive for MDE calculation.');
    }
  }

  if (mean > 0) {
    if (variance > mean * 2) { // Heuristic for high variance
      localWarnings.push('Warning: The provided variance is relatively high compared to the mean. This will increase the required sample size per variant.');
    }
    if (variance < mean * 0.01 && mean > 1e-6) { // Heuristic for low variance
      localWarnings.push('Warning: The provided variance is very low compared to the mean.');
    }
  } else if (metricType === "Continuous" && variance > 1000 && mean <= 0) {
     localWarnings.push('Warning: The provided variance is high, and mean is zero or negative for a continuous metric. Ensure inputs are correct.');
  }
  
  if (mdeDecimal < 0.001) { 
    localWarnings.push('Warning: The MDE is very small (<0.1%), which may lead to an extremely large required sample size per variant.');
  }
  if (mdeDecimal > 0.5) { 
    localWarnings.push('Warning: The MDE is very large (>50%). Ensure this is the intended sensitivity.');
  }
  if (isNaN(mean) || isNaN(variance) || isNaN(mdeDecimal) || isNaN(statisticalPower) || isNaN(significanceLevel) || isNaN(numberOfVariants) || numberOfVariants < 2) {
    localWarnings.push('Error: One or more core inputs (Mean, Variance, MDE, Power, Significance, Number of Variants) are invalid numbers or out of range. Cannot calculate sample size.');
  }


  // Perform calculation if no critical errors
  if (!localWarnings.some(w => w.startsWith("Error:"))) {
    const zAlphaDiv2Value = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
    const zBetaValue = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

    if (!zAlphaDiv2Value) localWarnings.push(`Warning: Z-score for significance level ${significanceLevel.toFixed(2)} not found, using default for 0.05.`);
    if (!zBetaValue) localWarnings.push(`Warning: Z-score for statistical power ${statisticalPower.toFixed(2)} not found, using default for 0.80.`);

    const mdeAbsolute = mean * mdeDecimal;

    if (mdeAbsolute === 0 && mean > 0) { 
        localWarnings.push('Warning: MDE is 0%, resulting in an infinite sample size per variant. Please use a non-zero MDE.');
    } else if (mean <= 0 && metricType === "Continuous") {
         localWarnings.push('Warning: Mean is zero or negative for a continuous metric, cannot calculate absolute MDE based on relative MDE. Sample size per variant cannot be determined.');
    } else if (variance < 0) {
        localWarnings.push('Warning: Variance is negative. Sample size per variant cannot be determined.');
    }
     else {
        // Formula for sample size per variant (N_per_group)
        const N = (2 * Math.pow(zAlphaDiv2Value + zBetaValue, 2) * variance) / Math.pow(mdeAbsolute, 2);
        if (!isNaN(N) && N > 0) {
            requiredSampleSizePerVariantValue = Math.ceil(N);
        } else {
            localWarnings.push("Could not calculate a valid required sample size per variant. Check inputs (e.g., non-zero MDE, positive mean for continuous, non-negative variance).");
        }
    }
  }

  let exposureNeededPercentage: number | undefined = undefined;
  if (requiredSampleSizePerVariantValue !== undefined && requiredSampleSizePerVariantValue > 0 && numberOfVariants >= 2) {
    const totalRequiredSampleSizeForExposure = requiredSampleSizePerVariantValue * numberOfVariants;
    
    let effectiveTotalUsersForDuration: number | undefined = undefined;
    if (totalUsersInSelectedDuration !== undefined && !isNaN(totalUsersInSelectedDuration) && totalUsersInSelectedDuration > 0) {
        effectiveTotalUsersForDuration = totalUsersInSelectedDuration;
    } else if (historicalDailyTraffic !== undefined && !isNaN(historicalDailyTraffic) && historicalDailyTraffic > 0 && targetExperimentDurationDays > 0) {
        effectiveTotalUsersForDuration = historicalDailyTraffic * targetExperimentDurationDays;
    }


    if (effectiveTotalUsersForDuration === undefined || effectiveTotalUsersForDuration <= 0) {
      localWarnings.push("Total users for target duration is invalid, zero, or cannot be determined. Cannot calculate exposure percentage.");
    } else {
      exposureNeededPercentage = (totalRequiredSampleSizeForExposure / effectiveTotalUsersForDuration) * 100;
    }
  } else if (!localWarnings.some(w => w.startsWith("Error:"))) {
     localWarnings.push("Required sample size per variant could not be determined. Exposure estimates cannot be calculated.");
  }
  
  const directCalcOutput: DirectCalculationOutput = {
    requiredSampleSizePerVariant: requiredSampleSizePerVariantValue,
    confidenceLevel: 1 - significanceLevel,
    powerLevel: statisticalPower,
    warnings: localWarnings.length > 0 ? Array.from(new Set(localWarnings)) : undefined,
  };
  
  return {
    ...directCalcOutput,
    metric,
    metricType,
    mean,
    variance,
    lookbackDays: lookbackDays || targetExperimentDurationDays,
    realEstate,
    minimumDetectableEffect: mdeDecimal, // MDE as decimal
    significanceLevel,
    numberOfVariants, // Pass through for results
    totalUsersInSelectedDuration: totalUsersInSelectedDuration, // For Excel-driven or primary MDE->SS
    historicalDailyTraffic: historicalDailyTraffic, // For Manual Calc
    targetExperimentDurationDays,
    exposureNeededPercentage,
  };
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
      warnings.push(`Could not calculate a valid MDE. Check inputs (variance, mean > 0, sample size per variant > 0).`);
      return { warnings, achievableMde: undefined, confidenceLevel: 1 - significanceLevel, powerLevel: statisticalPower };
  }

  return { 
    achievableMde: parseFloat(mdeRelative.toFixed(2)), 
    warnings: warnings.length > 0 ? warnings : undefined,
    confidenceLevel: 1 - significanceLevel,
    powerLevel: statisticalPower,
  };
}
