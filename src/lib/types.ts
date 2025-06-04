
import { z } from 'zod';
import { 
  DEFAULT_MDE_PERCENT, 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL,
  DEFAULT_SAMPLE_SIZE_PER_VARIANT,
  METRIC_TYPE_OPTIONS
} from '@/lib/constants';

// Schema for "MDE to Sample Size" flow (Excel/Platform Data Driven) - RETAINED FOR REFERENCE OR POTENTIAL DIRECT USE ELSEWHERE BUT NOT FOR MAIN TAB
export const MdeToSampleSizeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }).default(METRIC_TYPE_OPTIONS[1]),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"),
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  realEstate: z.string().min(1, "Real Estate is required").default("platform"),
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Exp Duration must be a positive integer").default(14),
  totalUsersInSelectedDuration: z.coerce.number({invalid_type_error: "Total users must be a number"}).int().nonnegative("Total users for duration must be a non-negative integer.").optional(),
  numberOfVariants: z.coerce.number().int().min(2, "Must have at least 2 variants (e.g., Control + Treatment)").default(2),
}).refine(data => {
    if (data.metricType === "Binary") {
      return data.mean >= 0 && data.mean <= 1;
    }
    return true;
  }, {
    message: "For Binary metrics, Mean (proportion) must be between 0 and 1.",
    path: ["mean"],
  }).refine(data => {
    if (data.metricType === "Continuous" && data.mean <=0 && !isNaN(data.mean)) { 
        return false;
    }
    return true;
  }, {
    message: "For Continuous metrics, Mean must be positive.",
    path: ["mean"],
  });

export type MdeToSampleSizeFormValues = z.infer<typeof MdeToSampleSizeFormSchema>;

// Schema for "Sample Size to MDE" flow - RETAINED FOR REFERENCE OR POTENTIAL DIRECT USE ELSEWHERE BUT NOT FOR MAIN TAB
export const SampleSizeToMdeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }).default(METRIC_TYPE_OPTIONS[1]),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"), 
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  sampleSizePerVariant: z.coerce.number({invalid_type_error: "Sample size must be a number"}).int().positive("Sample size per variant must be a positive integer").default(DEFAULT_SAMPLE_SIZE_PER_VARIANT),
  realEstate: z.string().min(1, "Real Estate is required").default("platform"),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Exp Duration must be a positive integer").default(14), // For historical data lookup context
  totalUsersInSelectedDuration: z.coerce.number({invalid_type_error: "Total users must be a number"}).int().nonnegative("Total users for duration must be a non-negative integer.").optional(), // For exposure context
  numberOfVariants: z.coerce.number().int().min(2, "Must have at least 2 variants").default(2), 
}).refine(data => {
    if (data.metricType === "Binary") {
      return data.mean >= 0 && data.mean <= 1;
    }
    return true;
  }, {
    message: "For Binary metrics, Mean (proportion) must be between 0 and 1.",
    path: ["mean"],
  }).refine(data => {
    if (data.metricType === "Continuous" && data.mean <=0 && !isNaN(data.mean)) { 
        return false;
    }
    return true;
  }, {
    message: "For Continuous metrics, Mean must be positive.",
    path: ["mean"],
  });

export type SampleSizeToMdeFormValues = z.infer<typeof SampleSizeToMdeFormSchema>;


// Schema for the new Manual Sample Size Calculator
export const ManualCalculatorFormSchema = z.object({
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"), 
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  historicalDailyTraffic: z.coerce.number({invalid_type_error: "Daily traffic must be a number"}).int().nonnegative("Historical daily traffic must be a non-negative integer").optional(),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Exp Duration must be a positive integer").default(14),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  numberOfVariants: z.coerce.number().int().min(2, "Must have at least 2 variants").default(2),
}).refine(data => { 
    if (data.metricType === "Binary") {
      return data.mean >= 0 && data.mean <= 1;
    }
    return true;
  }, {
    message: "For Binary metrics, Mean (proportion) must be between 0 and 1.",
    path: ["mean"],
  }).refine(data => { 
    if (data.metricType === "Continuous" && data.mean <=0 && !isNaN(data.mean)) { 
        return false;
    }
    return true;
  }, {
    message: "For Continuous metrics, Mean must be positive.",
    path: ["mean"],
});

export type ManualCalculatorFormValues = z.infer<typeof ManualCalculatorFormSchema>;

// This type is for the direct output from the calculateSampleSizeAction or MDE calculation
export interface DirectCalculationOutput {
  requiredSampleSizePerVariant?: number; 
  achievableMde?: number; // As percentage for MDE calculation
  confidenceLevel?: number; 
  powerLevel?: number; 
  warnings?: string[];
  exposureNeededPercentage?: number;
}

// This is the comprehensive result type for the MDE to Sample Size feature, 
// used by both Excel-driven and Manual calculators for displaying results.
// It can be adapted for the new combined calculator.
export type MdeToSampleSizeCalculationResults = DirectCalculationOutput & {
  metric: string; 
  metricType: typeof METRIC_TYPE_OPTIONS[number];
  mean: number;
  variance: number;
  realEstate?: string; 
  minimumDetectableEffect: number; // MDE as decimal for consistency in results
  significanceLevel: number; // Alpha from form
  numberOfVariants: number;
  historicalDailyTraffic?: number; // For Manual Calc
  totalUsersInSelectedDuration?: number; // Total users for the targetExperimentDurationDays
  targetExperimentDurationDays: number; 
};

// Result type for SampleSizeToMde - used for reference
export interface SampleSizeToMdeCalculationResults {
  inputs: SampleSizeToMdeFormValues; 
  achievableMde?: number; // As percentage
  warnings?: string[];
  exposureNeededPercentage?: number; 
}


// Schema for the new "Fixed Duration Calculator"
export const FixedDurationCalculatorFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }).default(METRIC_TYPE_OPTIONS[1]),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"),
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  realEstate: z.string().min(1, "Real Estate is required").default("platform"),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Exp Duration must be a positive integer").default(14),
  totalUsersInSelectedDuration: z.coerce.number({invalid_type_error: "Total users must be a number"}).int().nonnegative("Total users for duration must be a non-negative integer.").optional(),
  numberOfVariants: z.coerce.number().int().min(2, "Must have at least 2 variants").default(2),
  
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be positive if provided").optional(), // MDE as %
  sampleSizePerVariant: z.coerce.number({invalid_type_error: "Sample size must be a number"}).int().positive("Sample size must be positive if provided").optional(),

  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
}).refine(data => {
    const mdeProvided = typeof data.minimumDetectableEffect === 'number' && data.minimumDetectableEffect > 0;
    const ssProvided = typeof data.sampleSizePerVariant === 'number' && data.sampleSizePerVariant > 0;
    if (mdeProvided && ssProvided) return false; // Cannot provide both
    return mdeProvided || ssProvided; // At least one must be provided
  }, {
    message: "Please provide either MDE (%) or Sample Size (per variant), but not both.",
    path: ["minimumDetectableEffect"], 
  })
  .refine(data => {
    if (data.metricType === "Binary") {
      return data.mean >= 0 && data.mean <= 1;
    }
    return true;
  }, {
    message: "For Binary metrics, Mean (proportion) must be between 0 and 1.",
    path: ["mean"],
  })
  .refine(data => {
    if (data.metricType === "Continuous" && data.mean <=0 && !isNaN(data.mean)) { 
        return false;
    }
    return true;
  }, {
    message: "For Continuous metrics, Mean must be positive.",
    path: ["mean"],
  });

export type FixedDurationCalculatorFormValues = z.infer<typeof FixedDurationCalculatorFormSchema>;

export interface FixedDurationCalculatorActionInput extends FixedDurationCalculatorFormValues {
}

export interface FixedDurationCalculatorResults {
  inputs: FixedDurationCalculatorFormValues;
  calculationMode: 'mdeToSs' | 'ssToMde';
  calculatedMde?: number; // As percentage
  calculatedSampleSizePerVariant?: number;
  totalCalculatedSampleSizeForExperiment?: number;
  exposureNeededPercentage?: number;
  warnings?: string[];
  confidenceLevel: number;
  powerLevel: number;
}


// Schema for "Dynamic Duration Calculator"
export const MdeDurationPredictorFormSchema = z.object({
  metric: z.string().min(1, "Metric is required. Please upload an Excel file with historical data."),
  realEstate: z.string().min(1, "Real Estate is required. Please upload an Excel file with historical data.").default("platform"),
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }).default(METRIC_TYPE_OPTIONS[1]),
  
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be positive if provided").optional(),
  sampleSizePerVariant: z.coerce.number({invalid_type_error: "Sample size must be a number"}).int().positive("Sample size must be positive if provided").optional(),

  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  numberOfVariants: z.coerce.number().int().min(2, "Must have at least 2 variants").default(2),
}).refine(data => {
    const mdeProvided = typeof data.minimumDetectableEffect === 'number' && data.minimumDetectableEffect > 0;
    const ssProvided = typeof data.sampleSizePerVariant === 'number' && data.sampleSizePerVariant > 0;
    if (mdeProvided && ssProvided) return false; // Cannot provide both for calculation
    return mdeProvided || ssProvided; // At least one must be provided for calculation
  }, {
    message: "Please provide either MDE (%) or Sample Size (per variant), but not both.",
    path: ["minimumDetectableEffect"], 
  });

export type MdeDurationPredictorFormValues = z.infer<typeof MdeDurationPredictorFormSchema>;

export interface MdeDurationPredictorResultRow {
  duration: number;
  calculationMode: 'mdeToSs' | 'ssToMde';
  totalUsersAvailable?: number | string;
  totalRequiredSampleSize?: number | string; // Output if mode is 'mdeToSs'
  achievableMde?: number | string; // Output if mode is 'ssToMde', as percentage
  exposureNeededPercentage?: number | string;
  warnings?: string[]; 
}

export type MdeDurationPredictorResults = MdeDurationPredictorResultRow[];


export type CalculateAIFlowInput = {
  metric: string; 
  metricType: typeof METRIC_TYPE_OPTIONS[number];
  mean: number;
  variance: number;
  minimumDetectableEffect: number; // MDE as decimal
  statisticalPower: number;
  significanceLevel: number;
};


export interface ExcelDataRow {
  metric?: string;
  realEstate?: string;
  mean?: number;
  variance?: number;
  totalUsers?: number; 
  lookbackDays?: number;
  [key: string]: any; 
}
