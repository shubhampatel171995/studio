
import { z } from 'zod';
// Note: CalculateAIFlowOutputInternal from the AI flow is no longer directly used by MdeToSampleSizeCalculationResults
// as the calculation is now done in the action. However, the structure is similar.
// import type { CalculateAIFlowOutput as CalculateAIFlowOutputInternal } from '@/ai/flows/sample-size-calculator';
import { 
  DEFAULT_MDE_PERCENT, 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL,
  DEFAULT_SAMPLE_SIZE_PER_VARIANT,
  METRIC_TYPE_OPTIONS
} from '@/lib/constants';

// Schema for "MDE to Sample Size" flow (Excel/Platform Data Driven)
export const MdeToSampleSizeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }).default(METRIC_TYPE_OPTIONS[1]),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"),
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  realEstate: z.string().min(1, "Real Estate is required"),
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  historicalDailyTraffic: z.coerce.number({invalid_type_error: "Historical daily traffic must be a number"}).positive("Historical daily traffic must be positive if provided.").optional(),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Target duration must be a positive integer").default(14),
  lookbackDays: z.coerce.number().int().positive("Lookback days must be a positive integer").optional(), // Contextual, set by targetExperimentDurationDays when Excel is used
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


// Schema for the new Manual Sample Size Calculator
export const ManualCalculatorFormSchema = z.object({
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"), 
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  historicalDailyTraffic: z.coerce.number({invalid_type_error: "Daily traffic must be a number"}).int().positive("Historical daily traffic must be a positive integer"),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Target duration must be a positive integer").default(14),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
}).refine(data => { 
    if (data.metricType === "Binary") {
      return data.mean >= 0 && data.mean <= 1;
    }
    return true;
  }, {
    message: "For Binary metrics, Mean (proportion) must be between 0 and 1.",
    path: ["mean"],
  }).refine(data => { 
    if (data.metricType === "Continuous") { 
        return data.mean > 0;
    }
    return true;
  }, {
    message: "For Continuous metrics, Mean must be positive.",
    path: ["mean"],
});


export type ManualCalculatorFormValues = z.infer<typeof ManualCalculatorFormSchema>;


// This type is for the direct output from the calculateSampleSizeAction
export interface DirectCalculationOutput {
  requiredSampleSize?: number;
  confidenceLevel?: number;
  powerLevel?: number;
  warnings?: string[];
}

// This is the comprehensive result type for the "MDE to Sample Size" feature, 
// used by both Excel-driven and Manual calculators for displaying results.
export type MdeToSampleSizeCalculationResults = DirectCalculationOutput & {
  // Inputs from form (passed through for reporting and context)
  metric: string; 
  metricType: typeof METRIC_TYPE_OPTIONS[number];
  mean: number;
  variance: number;
  lookbackDays?: number;  // Contextual: for Excel this is targetExperimentDurationDays, for Manual it's targetExperimentDurationDays
  realEstate?: string; 
  minimumDetectableEffect: number; // MDE as decimal for consistency in results
  significanceLevel: number; // Alpha from form
  
  historicalDailyTraffic?: number; // Calculated from Excel or from manual form
  targetExperimentDurationDays: number; // From form
  exposureNeededPercentage?: number; // Calculated in action
};


// Schema for "Sample Size to MDE" flow
export const SampleSizeToMdeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"), // For context
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).positive("Mean must be a positive number"),
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  sampleSizePerVariant: z.coerce.number({invalid_type_error: "Sample size must be a number"}).int().positive("Sample size per variant must be a positive integer").default(DEFAULT_SAMPLE_SIZE_PER_VARIANT),
  realEstate: z.string().min(1, "Real Estate is required"), // For context/reporting
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
});

export type SampleSizeToMdeFormValues = z.infer<typeof SampleSizeToMdeFormSchema>;

// This is the comprehensive result type for the "Sample Size to MDE" feature
export interface SampleSizeToMdeCalculationResults {
  inputs: SampleSizeToMdeFormValues; // To store the form inputs used for this calculation
  achievableMde?: number; // As percentage
  confidenceLevel?: number; // 1 - significanceLevel
  powerLevel?: number; // statisticalPower from input
  warnings?: string[];
}

// Input type for the AI flow (used by "MDE to Sample Size" action if AI was used)
// This type is related to the AI flow, which is being bypassed for direct calculation
export type CalculateAIFlowInput = {
  metric: string; 
  metricType: typeof METRIC_TYPE_OPTIONS[number];
  mean: number;
  variance: number;
  minimumDetectableEffect: number; // MDE as decimal
  statisticalPower: number;
  significanceLevel: number;
};

// Type for rows parsed from Excel/CSV (after mapping)
export interface ExcelDataRow {
  // Standardized keys after mapping
  metric?: string;
  realEstate?: string;
  mean?: number;
  variance?: number;
  totalUsers?: number; 
  lookbackDays?: number;
  [key: string]: any; 
}
