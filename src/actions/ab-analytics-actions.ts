
"use server";

import type { 
    MdeToSampleSizeFormValues, 
    SampleSizeToMdeFormValues, 
    SampleSizeToMdeCalculationResults, 
    DirectCalculationOutput, 
    MdeToSampleSizeCalculationResults,
    FixedDurationCalculatorFormValues,
    FixedDurationCalculatorResults,
    FixedDurationCalculatorActionInput
} from '@/lib/types';
import { Z_ALPHA_DIV_2, Z_BETA } from '@/lib/constants';

// Internal helper for sample size calculation logic
function calculateSampleSizeLogic(
    mean: number, 
    variance: number, 
    mdeDecimal: number, // MDE as decimal
    statisticalPower: number, 
    significanceLevel: number
): { requiredSampleSizePerVariant?: number; localWarnings: string[] } {
    const localWarnings: string[] = [];
    let requiredSampleSizePerVariantValue: number | undefined = undefined;

    if (mdeDecimal === 0) {
        localWarnings.push('Warning:_MDE_is_0%._Please_use_a_non-zero_MDE.');
        return { requiredSampleSizePerVariant: undefined, localWarnings };
    }
    if (mean <= 0 && mdeDecimal > 0 && !isNaN(mean)) { // Assuming mdeDecimal is relative if mean is relevant
         localWarnings.push('Warning:_Mean_is_zero_or_negative_for_a_continuous_metric,_cannot_calculate_absolute_MDE_based_on_relative_MDE.');
    }
     if (variance < 0) {
        localWarnings.push('Warning:_Variance_is_negative.');
        return { requiredSampleSizePerVariant: undefined, localWarnings };
    }

    const zAlphaDiv2Value = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
    const zBetaValue = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

    if (!zAlphaDiv2Value) localWarnings.push(`Warning:_Z-score_for_significance_level_${significanceLevel.toFixed(2)}_not_found,_using_default_for_0.05.`);
    if (!zBetaValue) localWarnings.push(`Warning:_Z-score_for_statistical_power_${statisticalPower.toFixed(2)}_not_found,_using_default_for_0.80.`);
    
    const mdeAbsolute = mean * mdeDecimal;

    if (mdeAbsolute === 0 && mean > 0 && mdeDecimal !== 0) { 
        localWarnings.push('Warning:_Calculated_absolute_MDE_is_0_(mean_is_positive_but_mde_or_mean*mde_is_0),_resulting_in_an_infinite_sample_size_per_variant.');
    } else if (mdeAbsolute !== 0) { // Ensure mdeAbsolute is not zero to avoid division by zero
        const N = (2 * Math.pow(zAlphaDiv2Value + zBetaValue, 2) * variance) / Math.pow(mdeAbsolute, 2);
        if (!isNaN(N) && N > 0) {
            requiredSampleSizePerVariantValue = Math.ceil(N);
        } else {
            localWarnings.push("Could_not_calculate_a_valid_required_sample_size_per_variant._Check_inputs_(e.g.,_non-zero_MDE,_positive_mean_for_continuous,_non-negative_variance).");
        }
    } else {
        localWarnings.push("Could_not_calculate_sample_size_as_absolute_MDE_is_zero_and_mean_is_not_positive_or_MDE_is_zero.");
    }
    return { requiredSampleSizePerVariant: requiredSampleSizePerVariantValue, localWarnings };
}

// Internal helper for MDE calculation logic
function calculateMdeLogic(
    mean: number,
    variance: number,
    sampleSizePerVariant: number,
    statisticalPower: number,
    significanceLevel: number
): { achievableMde?: number; localWarnings: string[] } { // MDE as percentage
    const localWarnings: string[] = [];
    let mdeRelative: number | undefined = undefined;

    if (sampleSizePerVariant <= 0 || isNaN(sampleSizePerVariant)) {
        localWarnings.push("Error:_Sample_size_per_variant_must_be_a_positive_number.");
         return { achievableMde: undefined, localWarnings };
    }
    if (variance < 0 || isNaN(variance)) { 
        localWarnings.push("Error:_Variance_must_be_a_non-negative_number.");
         return { achievableMde: undefined, localWarnings };
    }
     if (mean <= 0 && !isNaN(mean)) {
         localWarnings.push('Warning:_Mean_is_zero_or_negative_for_a_continuous_metric,_cannot_calculate_relative_MDE.');
    }


    const zAlphaDiv2Value = Z_ALPHA_DIV_2[significanceLevel.toFixed(2)] || Z_ALPHA_DIV_2["0.05"];
    const zBetaValue = Z_BETA[statisticalPower.toFixed(2)] || Z_BETA["0.80"];

    if (!zAlphaDiv2Value) localWarnings.push(`Warning:_Z-score_for_significance_level_${significanceLevel.toFixed(2)}_not_found,_using_default_for_0.05.`);
    if (!zBetaValue) localWarnings.push(`Warning:_Z-score_for_statistical_power_${statisticalPower.toFixed(2)}_not_found,_using_default_for_0.80.`);

    const mdeAbsolute = (zAlphaDiv2Value + zBetaValue) * Math.sqrt((2 * variance) / sampleSizePerVariant);
  
    if (mean > 0) { 
        mdeRelative = (mdeAbsolute / mean) * 100; // As percentage
    } else {
        localWarnings.push("Mean_is_zero_or_negative,_cannot_calculate_relative_MDE._Absolute_MDE_calculated:_" + mdeAbsolute.toFixed(4));
    }
    
    if (isNaN(mdeRelative) || !isFinite(mdeRelative)) {
        if (!localWarnings.some(w => w.includes("Mean_is_zero_or_negative"))) { 
            localWarnings.push(`Could_not_calculate_a_valid_relative_MDE._Check_inputs.`);
        }
        mdeRelative = undefined;
    }
    
    return { achievableMde: mdeRelative, localWarnings };
}


// Action for "MDE to Sample Size" flow (still used by Dynamic Duration Calculator and Manual Calculator)
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
  
  const mdeDecimal = minimumDetectableEffect / 100; // Convert percentage to decimal for calculation

  if (metricType === "Binary") {
    if (mean < 0 || mean > 1) {
      localWarnings.push('Warning:_For_Binary_metric,_Mean_(proportion)_should_be_between_0_and_1.');
    }
    const calculatedVarianceBinary = mean * (1 - mean);
    if (Math.abs(variance - calculatedVarianceBinary) > 1e-9 && !isNaN(calculatedVarianceBinary) && !isNaN(variance)) { 
      localWarnings.push(`Warning:_Provided_variance_(${variance.toFixed(6)})_for_Binary_metric_differs_from_calculated_(p*(1-p)_=_${calculatedVarianceBinary.toFixed(6)})._Using_provided_variance_for_calculation.`);
    }
  } else if (metricType === "Continuous") {
    if (mean <= 0 && !isNaN(mean)) {
      localWarnings.push('Warning:_For_Continuous_metric,_Mean_should_be_positive_for_MDE_calculation.');
    }
  }

  if (!isNaN(mean) && mean > 0) {
    if (variance > mean * 2) { 
      localWarnings.push('Warning:_The_provided_variance_is_relatively_high_compared_to_the_mean.');
    }
    if (variance < mean * 0.01 && mean > 1e-6) { 
      localWarnings.push('Warning:_The_provided_variance_is_very_low_compared_to_the_mean.');
    }
  } else if (metricType === "Continuous" && variance > 1000 && (isNaN(mean) || mean <= 0)) {
     localWarnings.push('Warning:_The_provided_variance_is_high,_and_mean_is_zero_or_negative_for_a_continuous_metric.');
  }
  
  if (mdeDecimal < 0.0001 && mdeDecimal !==0) { // Adjusted for very small MDE, relative to decimal form
    localWarnings.push('Warning:_The_MDE_is_very_small_(<0.01%),_which_may_lead_to_an_extremely_large_required_sample_size.');
  }
  if (mdeDecimal > 0.5) { 
    localWarnings.push('Warning:_The_MDE_is_very_large_(>50%)._Ensure_this_is_the_intended_sensitivity.');
  }
   if (isNaN(mean) || isNaN(variance) || isNaN(mdeDecimal) || isNaN(statisticalPower) || isNaN(significanceLevel) || isNaN(numberOfVariants) || numberOfVariants < 2) {
    localWarnings.push('Error:_One_or_more_core_inputs_are_invalid._Cannot_calculate_sample_size.');
  }

  let requiredSampleSizePerVariantValue: number | undefined = undefined;
  if (!localWarnings.some(w => w.startsWith("Error:"))) {
      const {requiredSampleSizePerVariant, localWarnings: calcWarnings} = calculateSampleSizeLogic(mean, variance, mdeDecimal, statisticalPower, significanceLevel);
      requiredSampleSizePerVariantValue = requiredSampleSizePerVariant;
      localWarnings.push(...calcWarnings);
  }


  let exposureNeededPercentage: number | undefined = undefined;
  if (requiredSampleSizePerVariantValue !== undefined && requiredSampleSizePerVariantValue > 0 && numberOfVariants >= 2) {
    const totalRequiredSampleSizeForExperiment = requiredSampleSizePerVariantValue * numberOfVariants;
    
    if (totalUsersInSelectedDuration === undefined || isNaN(totalUsersInSelectedDuration) || totalUsersInSelectedDuration <= 0) {
      if (totalUsersInSelectedDuration !== undefined) localWarnings.push("Total_users_for_target_duration_is_invalid_or_zero._Cannot_calculate_exposure_percentage.");
    } else {
      exposureNeededPercentage = (totalRequiredSampleSizeForExperiment / totalUsersInSelectedDuration) * 100;
    }
  } else if (!localWarnings.some(w => w.startsWith("Error:"))) {
     // localWarnings.push("Required_sample_size_per_variant_could_not_be_determined._Exposure_estimates_cannot_be_calculated.");
  }
  
  const directCalcOutput: DirectCalculationOutput = {
    requiredSampleSizePerVariant: requiredSampleSizePerVariantValue,
    confidenceLevel: 1 - significanceLevel,
    powerLevel: statisticalPower,
    warnings: localWarnings.length > 0 ? Array.from(new Set(localWarnings)) : undefined,
    exposureNeededPercentage: exposureNeededPercentage
  };
  
  return {
    ...directCalcOutput,
    metric,
    metricType,
    mean,
    variance,
    realEstate,
    minimumDetectableEffect: mdeDecimal, // Store as decimal
    significanceLevel,
    numberOfVariants, 
    totalUsersInSelectedDuration: totalUsersInSelectedDuration, 
    targetExperimentDurationDays,
  };
}

// Action for "Sample Size to MDE" flow (Can be deprecated if new combined action is used exclusively)
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

  let localWarnings: string[] = [];

  if (metricType === "Binary") {
    if (mean < 0 || mean > 1) {
      localWarnings.push('Warning:_For_Binary_metric,_Mean_(proportion)_should_be_between_0_and_1.');
    }
    const calculatedVarianceBinary = mean * (1 - mean);
    if (Math.abs(variance - calculatedVarianceBinary) > 1e-9 && !isNaN(calculatedVarianceBinary) && !isNaN(variance)) {
      localWarnings.push(`Warning:_Provided_variance_(${variance.toFixed(6)})_for_Binary_metric_differs_from_calculated_(p*(1-p)_=_${calculatedVarianceBinary.toFixed(6)}).`);
    }
  } else if (metricType === "Continuous") {
    // Warning for mean <= 0 handled in calculateMdeLogic
  }
   if (isNaN(mean)) {
      localWarnings.push("Error:_Mean_must_be_a_valid_number.");
  }
   if (isNaN(statisticalPower) || statisticalPower <=0 || statisticalPower >=1 ) {
    localWarnings.push("Error:_Statistical_power_must_be_between_0_and_1_(exclusive).");
  }
  if (isNaN(significanceLevel) || significanceLevel <=0 || significanceLevel >=1) {
    localWarnings.push("Error:_Significance_level_must_be_between_0_and_1_(exclusive).");
  }


  let mdeAchievable: number | undefined = undefined;
   if (!localWarnings.some(w => w.startsWith("Error:"))) {
        const { achievableMde, localWarnings: calcWarnings } = calculateMdeLogic(mean, variance, sampleSizePerVariant, statisticalPower, significanceLevel);
        mdeAchievable = achievableMde;
        localWarnings.push(...calcWarnings);
   }


  let exposureNeededPercentage: number | undefined = undefined;
  if (sampleSizePerVariant > 0 && numberOfVariants >= 2) {
    const totalRequiredSampleSizeForExperiment = sampleSizePerVariant * numberOfVariants;
    if (totalUsersInSelectedDuration === undefined || isNaN(totalUsersInSelectedDuration) || totalUsersInSelectedDuration <= 0) {
      if (totalUsersInSelectedDuration !== undefined) localWarnings.push("Total_users_for_target_duration_is_invalid_or_zero._Cannot_calculate_exposure_percentage.");
    } else {
      exposureNeededPercentage = (totalRequiredSampleSizeForExperiment / totalUsersInSelectedDuration) * 100;
    }
  } else if (sampleSizePerVariant <=0) {
    localWarnings.push("Sample_size_per_variant_is_not_positive._Exposure_estimates_cannot_be_calculated.");
  }


  return { 
    achievableMde: mdeAchievable !== undefined ? parseFloat(mdeAchievable.toFixed(2)) : undefined, 
    warnings: localWarnings.length > 0 ? Array.from(new Set(localWarnings)) : undefined,
    // confidenceLevel: 1 - significanceLevel, // This is already part of form values, not needed in return if result is lean
    // powerLevel: statisticalPower, // Same as above
    exposureNeededPercentage,
  };
}

// New action for the combined "Fixed Duration Calculator"
export async function calculateFixedDurationParametersAction(
  formValues: FixedDurationCalculatorActionInput
): Promise<FixedDurationCalculatorResults> {
  const {
    metricType,
    mean,
    variance,
    statisticalPower,
    significanceLevel,
    numberOfVariants,
    totalUsersInSelectedDuration,
    minimumDetectableEffect, // MDE as % from form
    sampleSizePerVariant
  } = formValues;

  let allWarnings: string[] = [];
  let calculationMode: 'mdeToSs' | 'ssToMde' = 'mdeToSs'; // Default
  let calculatedMde: number | undefined = undefined;
  let calculatedSampleSizePerVariant: number | undefined = undefined;
  let exposureNeededPercentageVal: number | undefined = undefined;

  // Common Validations
  if (metricType === "Binary") {
    if (mean < 0 || mean > 1) {
      allWarnings.push('Warning:_For_Binary_metric,_Mean_(proportion)_should_be_between_0_and_1.');
    }
    const calculatedVarianceBinary = mean * (1 - mean);
    if (Math.abs(variance - calculatedVarianceBinary) > 1e-9 && !isNaN(calculatedVarianceBinary) && !isNaN(variance)) {
      allWarnings.push(`Warning:_Provided_variance_(${variance.toFixed(6)})_for_Binary_metric_differs_from_calculated_(p*(1-p)_=_${calculatedVarianceBinary.toFixed(6)}).`);
    }
  } else if (metricType === "Continuous") {
    // Mean positivity check will be handled by specific logic paths
  }
  if (isNaN(mean)) allWarnings.push("Error:_Mean_must_be_a_valid_number.");
  if (isNaN(variance) || variance < 0) allWarnings.push("Error:_Variance_must_be_a_non-negative_number.");
  if (isNaN(statisticalPower) || statisticalPower <= 0 || statisticalPower >= 1) allWarnings.push("Error:_Statistical_power_must_be_between_0_and_1_(exclusive).");
  if (isNaN(significanceLevel) || significanceLevel <= 0 || significanceLevel >= 1) allWarnings.push("Error:_Significance_level_must_be_between_0_and_1_(exclusive).");
  if (isNaN(numberOfVariants) || numberOfVariants < 2) allWarnings.push("Error:_Number_of_variants_must_be_at_least_2.");

  const mdeProvided = typeof minimumDetectableEffect === 'number' && minimumDetectableEffect > 0;
  const ssProvided = typeof sampleSizePerVariant === 'number' && sampleSizePerVariant > 0;

  if (mdeProvided) {
    calculationMode = 'mdeToSs';
    const mdeDecimal = minimumDetectableEffect / 100;
     if (metricType === "Continuous" && mean <= 0 && !isNaN(mean)) {
        allWarnings.push('Warning:_For_Continuous_metric_Mean_should_be_positive_for_MDE_to_Sample_Size_calculation.');
    }
    if (mdeDecimal < 0.0001 && mdeDecimal !==0) allWarnings.push('Warning:_The_MDE_is_very_small_(<0.01%),_may_lead_to_very_large_sample_size.');
    if (mdeDecimal > 0.5) allWarnings.push('Warning:_The_MDE_is_very_large_(>50%).');
    
    if (!allWarnings.some(w => w.startsWith("Error:"))) {
        const { requiredSampleSizePerVariant: ss, localWarnings: calcWarn } = calculateSampleSizeLogic(mean, variance, mdeDecimal, statisticalPower, significanceLevel);
        calculatedSampleSizePerVariant = ss;
        allWarnings.push(...calcWarn);
    }
  } else if (ssProvided) {
    calculationMode = 'ssToMde';
    if (metricType === "Continuous" && mean <= 0 && !isNaN(mean)) {
        allWarnings.push('Warning:_For_Continuous_metric_Mean_should_be_positive_for_Sample_Size_to_MDE_calculation.');
    }
    if (!allWarnings.some(w => w.startsWith("Error:"))) {
        const { achievableMde: mde, localWarnings: calcWarn } = calculateMdeLogic(mean, variance, sampleSizePerVariant, statisticalPower, significanceLevel);
        calculatedMde = mde;
        allWarnings.push(...calcWarn);
    }
  } else {
    allWarnings.push("Error:_Please_provide_either_a_valid_MDE_or_Sample_Size_per_Variant.");
  }
  
  const finalSampleSizeForExposureCalc = calculationMode === 'mdeToSs' ? calculatedSampleSizePerVariant : sampleSizePerVariant;

  if (finalSampleSizeForExposureCalc !== undefined && finalSampleSizeForExposureCalc > 0 && numberOfVariants >= 2) {
    const totalRequiredSampleSizeForExperiment = finalSampleSizeForExposureCalc * numberOfVariants;
    if (totalUsersInSelectedDuration === undefined || isNaN(totalUsersInSelectedDuration) || totalUsersInSelectedDuration <= 0) {
       if (totalUsersInSelectedDuration !== undefined) allWarnings.push("Total_users_for_target_duration_is_invalid_or_zero._Cannot_calculate_exposure.");
    } else {
      exposureNeededPercentageVal = (totalRequiredSampleSizeForExperiment / totalUsersInSelectedDuration) * 100;
    }
  }

  const totalCalculatedSampleSizeForExperiment = calculatedSampleSizePerVariant ? calculatedSampleSizePerVariant * numberOfVariants : undefined;

  return {
    inputs: formValues,
    calculationMode,
    calculatedMde: calculatedMde !== undefined ? parseFloat(calculatedMde.toFixed(2)) : undefined,
    calculatedSampleSizePerVariant,
    totalCalculatedSampleSizeForExperiment,
    exposureNeededPercentage: exposureNeededPercentageVal,
    warnings: allWarnings.length > 0 ? Array.from(new Set(allWarnings)) : undefined,
    confidenceLevel: 1 - significanceLevel,
    powerLevel: statisticalPower,
  };
}
