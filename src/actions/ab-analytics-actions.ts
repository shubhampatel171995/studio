
"use server";

import type { MdeToSampleSizeFormValues, SampleSizeToMdeFormValues, SampleSizeToMdeCalculationResults, DirectCalculationOutput, MdeToSampleSizeCalculationResults } from '@/lib/types';
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
    numberOfVariants, 
    totalUsersInSelectedDuration, 
    targetExperimentDurationDays,
  } = formValues;

  const localWarnings: string[] = [];
  let requiredSampleSizePerVariantValue: number | undefined = undefined; 
  const mdeDecimal = minimumDetectableEffect / 100; 

  if (metricType === "Binary") {
    if (mean < 0 || mean > 1) {
      localWarnings.push('Warning: For Binary metric, Mean (proportion) should be between 0 and 1.');
    }
    const calculatedVarianceBinary = mean * (1 - mean);
    if (Math.abs(variance - calculatedVarianceBinary) > 1e-9 && !isNaN(calculatedVarianceBinary) && !isNaN(variance)) { 
      localWarnings.push(`Warning: Provided variance (${variance.toFixed(6)}) for Binary metric differs from calculated (p*(1-p) = ${calculatedVarianceBinary.toFixed(6)}). Using provided variance for calculation.`);
    }
  } else if (metricType === "Continuous") {
    if (mean <= 0 && !isNaN(mean)) {
      localWarnings.push('Warning: For Continuous metric, Mean should be positive for MDE calculation.');
    }
  }

  if (!isNaN(mean) && mean > 0) {
    if (variance > mean * 2) { 
      localWarnings.push('Warning: The provided variance is relatively high compared to the mean. This will increase the required sample size per variant.');
    }
    if (variance < mean * 0.01 && mean > 1e-6) { 
      localWarnings.push('Warning: The provided variance is very low compared to the mean.');
    }
  } else if (metricType === "Continuous" && variance > 1000 && (isNaN(mean) || mean <= 0)) {
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


  if (!localWarnings.some(w => w.startsWith("Error:"))) {
    const zAlphaDiv2Value = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
    const zBetaValue = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

    if (!zAlphaDiv2Value) localWarnings.push(`Warning: Z-score for significance level ${significanceLevel.toFixed(2)} not found, using default for 0.05.`);
    if (!zBetaValue) localWarnings.push(`Warning: Z-score for statistical power ${statisticalPower.toFixed(2)} not found, using default for 0.80.`);

    const mdeAbsolute = mean * mdeDecimal;

    if (mdeAbsolute === 0 && mean > 0 && mdeDecimal !== 0) { 
        localWarnings.push('Warning: MDE is 0% (or mean is 0), resulting in an infinite sample size per variant. Please use a non-zero MDE and positive mean for continuous metrics.');
    } else if (mdeDecimal === 0) {
        localWarnings.push('Warning: MDE is 0%. Please use a non-zero MDE.');
    } else if (mean <= 0 && metricType === "Continuous") {
         localWarnings.push('Warning: Mean is zero or negative for a continuous metric, cannot calculate absolute MDE based on relative MDE. Sample size per variant cannot be determined.');
    } else if (variance < 0) {
        localWarnings.push('Warning: Variance is negative. Sample size per variant cannot be determined.');
    }
     else {
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
    const totalRequiredSampleSizeForExperiment = requiredSampleSizePerVariantValue * numberOfVariants;
    
    if (totalUsersInSelectedDuration === undefined || isNaN(totalUsersInSelectedDuration) || totalUsersInSelectedDuration <= 0) {
      localWarnings.push("Total users for target duration is invalid, zero, or cannot be determined. Cannot calculate exposure percentage.");
    } else {
      exposureNeededPercentage = (totalRequiredSampleSizeForExperiment / totalUsersInSelectedDuration) * 100;
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
    lookbackDays: formValues.lookbackDays || targetExperimentDurationDays,
    realEstate,
    minimumDetectableEffect: mdeDecimal, 
    significanceLevel,
    numberOfVariants, 
    totalUsersInSelectedDuration: totalUsersInSelectedDuration, 
    targetExperimentDurationDays,
    exposureNeededPercentage,
  };
}

// Action for "Sample Size to MDE" flow
export async function calculateMdeFromSampleSizeAction(formValues: SampleSizeToMdeFormValues): Promise<Omit<SampleSizeToMdeCalculationResults, 'inputs'>> {
  const {
    metricType, 
    mean,
    variance,
    sampleSizePerVariant,
    statisticalPower,
    significanceLevel,
    numberOfVariants,
    totalUsersInSelectedDuration,
  } = formValues;

  const warnings: string[] = [];

  if (sampleSizePerVariant <= 0 || isNaN(sampleSizePerVariant)) {
    warnings.push("Sample size per variant must be a positive number.");
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
  
  if (metricType === "Binary") {
    if (mean < 0 || mean > 1) {
      warnings.push('Warning: For Binary metric, Mean (proportion) should be between 0 and 1.');
    }
    const calculatedVarianceBinary = mean * (1 - mean);
    if (Math.abs(variance - calculatedVarianceBinary) > 1e-9 && !isNaN(calculatedVarianceBinary) && !isNaN(variance)) {
      warnings.push(`Warning: Provided variance (${variance.toFixed(6)}) for Binary metric differs from calculated (p*(1-p) = ${calculatedVarianceBinary.toFixed(6)}). Using provided variance for calculation.`);
    }
  } else if (metricType === "Continuous") {
    if (mean <= 0 && !isNaN(mean)) {
      warnings.push('Warning: For Continuous metric, Mean should be positive for relative MDE calculation.');
    }
  }
   if (isNaN(mean)) {
      warnings.push("Mean must be a valid number.");
  }


  if (warnings.some(w => w.startsWith("Error:") || (w.startsWith("Warning:") && (w.includes("Mean should be positive") || w.includes("Mean (proportion) should be between 0 and 1")) ))) {
     return { warnings, achievableMde: undefined, confidenceLevel: 1 - significanceLevel, powerLevel: statisticalPower };
  }


  const zAlphaDiv2Value = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
  const zBetaValue = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

  if (!zAlphaDiv2Value) warnings.push(`Warning: Z-score for significance level ${significanceLevel.toFixed(2)} not found, using default for 0.05.`);
  if (!zBetaValue) warnings.push(`Warning: Z-score for statistical power ${statisticalPower.toFixed(2)} not found, using default for 0.80.`);


  const mdeAbsolute = (zAlphaDiv2Value + zBetaValue) * Math.sqrt((2 * variance) / sampleSizePerVariant);
  
  let mdeRelative = NaN;
  if (mean > 0) { 
    mdeRelative = (mdeAbsolute / mean) * 100; // As percentage
  } else {
    warnings.push("Mean is zero or negative, cannot calculate relative MDE. Absolute MDE calculated: " + mdeAbsolute.toFixed(4));
  }
  
  if (isNaN(mdeRelative) || !isFinite(mdeRelative)) {
      if (!warnings.some(w => w.includes("Mean is zero or negative"))) { 
        warnings.push(`Could not calculate a valid relative MDE. Check inputs (variance, mean > 0, sample size per variant > 0).`);
      }
      return { 
        warnings: Array.from(new Set(warnings)), 
        achievableMde: undefined, 
        confidenceLevel: 1 - significanceLevel, 
        powerLevel: statisticalPower 
      };
  }

  let exposureNeededPercentage: number | undefined = undefined;
  if (sampleSizePerVariant > 0 && numberOfVariants >= 2) {
    const totalRequiredSampleSizeForExperiment = sampleSizePerVariant * numberOfVariants;
    if (totalUsersInSelectedDuration === undefined || isNaN(totalUsersInSelectedDuration) || totalUsersInSelectedDuration <= 0) {
      warnings.push("Total users for target duration is invalid or zero. Cannot calculate exposure percentage.");
    } else {
      exposureNeededPercentage = (totalRequiredSampleSizeForExperiment / totalUsersInSelectedDuration) * 100;
    }
  } else if (sampleSizePerVariant <=0) {
    warnings.push("Sample size per variant is not positive. Exposure estimates cannot be calculated.");
  }


  return { 
    achievableMde: parseFloat(mdeRelative.toFixed(2)), 
    warnings: warnings.length > 0 ? Array.from(new Set(warnings)) : undefined,
    confidenceLevel: 1 - significanceLevel,
    powerLevel: statisticalPower,
    exposureNeededPercentage,
  };
}

