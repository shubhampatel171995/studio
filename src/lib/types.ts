
import { z } from 'zod';
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
  realEstate: z.string().min(1, "Real Estate is required").default("platform"),
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Target duration must be a positive integer").default(14),
  totalUsersInSelectedDuration: z.coerce.number({invalid_type_error: "Total users must be a number"}).int().positive("Total users for duration must be a positive integer.").optional(),
  lookbackDays: z.coerce.number().int().positive("Lookback days must be a positive integer").optional(), 
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


// Schema for the new Manual Sample Size Calculator
export const ManualCalculatorFormSchema = z.object({
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"), 
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  historicalDailyTraffic: z.coerce.number({invalid_type_error: "Daily traffic must be a number"}).int().positive("Historical daily traffic must be a positive integer").optional(),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Target duration must be a positive integer").default(14),
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
  requiredSampleSizePerVariant?: number; 
  confidenceLevel?: number;
  powerLevel?: number;
  warnings?: string[];
}

// This is the comprehensive result type for the "MDE to Sample Size" feature, 
// used by both Excel-driven and Manual calculators for displaying results.
export type MdeToSampleSizeCalculationResults = DirectCalculationOutput & {
  metric: string; 
  metricType: typeof METRIC_TYPE_OPTIONS[number];
  mean: number;
  variance: number;
  lookbackDays?: number; 
  realEstate?: string; 
  minimumDetectableEffect: number; // MDE as decimal for consistency in results
  significanceLevel: number; // Alpha from form
  numberOfVariants: number;
  
  historicalDailyTraffic?: number; // For Manual Calc
  totalUsersInSelectedDuration?: number; 

  targetExperimentDurationDays: number; 
  exposureNeededPercentage?: number; 
};


// Schema for "Sample Size to MDE" flow
export const SampleSizeToMdeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)], { errorMap: () => ({ message: "Metric Type is required" }) }).default(METRIC_TYPE_OPTIONS[1]),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).refine(val => !isNaN(val), "Mean must be a valid number"), // For relative MDE and binary variance
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  sampleSizePerVariant: z.coerce.number({invalid_type_error: "Sample size must be a number"}).int().positive("Sample size per variant must be a positive integer").default(DEFAULT_SAMPLE_SIZE_PER_VARIANT),
  realEstate: z.string().min(1, "Real Estate is required").default("platform"),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  targetExperimentDurationDays: z.coerce.number({invalid_type_error: "Duration must be a number"}).int().positive("Target duration must be a positive integer").default(14),
  totalUsersInSelectedDuration: z.coerce.number({invalid_type_error: "Total users must be a number"}).int().positive("Total users for duration must be a positive integer.").optional(),
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

// This is the comprehensive result type for the "Sample Size to MDE" feature
export interface SampleSizeToMdeCalculationResults {
  inputs: SampleSizeToMdeFormValues; 
  achievableMde?: number; // As percentage
  confidenceLevel?: number; 
  powerLevel?: number; 
  warnings?: string[];
  exposureNeededPercentage?: number;
}


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

