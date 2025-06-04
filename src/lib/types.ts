
import { z } from 'zod';
import { type CalculateAIFlowOutput as CalculateAIFlowOutputInternal } from '@/ai/flows/sample-size-calculator'; // Renamed for clarity
import { 
  DEFAULT_LOOKBACK_DAYS, 
  DEFAULT_MDE_PERCENT, 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL,
  DEFAULT_SAMPLE_SIZE_PER_VARIANT,
} from '@/lib/constants';

// Schema for "MDE to Sample Size" flow
export const MdeToSampleSizeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).positive("Mean must be a positive number"),
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  numberOfUsers: z.coerce.number({invalid_type_error: "Number of users must be a number"}).int().positive("Number of users must be a positive integer"),
  lookbackDays: z.coerce.number().int().positive("Lookback days must be a positive integer").default(DEFAULT_LOOKBACK_DAYS),
  realEstate: z.string().min(1, "Real Estate is required"),
  minimumDetectableEffect: z.coerce.number({invalid_type_error: "MDE must be a number"}).positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  inputType: z.enum(["platformDefault", "customData", "excelData"]).default("customData"), 
});

export type MdeToSampleSizeFormValues = z.infer<typeof MdeToSampleSizeFormSchema>;

export interface DurationEstimateRow {
  weeks: number;
  totalUsersAvailable: number;
  isSufficient: boolean;
}

// This type is for the AI output specifically for the MDE to Sample Size calculation part
export type CalculateAIFlowOutput = CalculateAIFlowOutputInternal;


// This is the comprehensive result type for the "MDE to Sample Size" feature, including form inputs and duration estimates
export type MdeToSampleSizeCalculationResults = CalculateAIFlowOutput & {
  // Inputs from form (passed through for reporting and context)
  metric: string;
  mean: number;
  variance: number;
  numberOfUsers: number; 
  lookbackDays: number; 
  realEstate: string;
  minimumDetectableEffect: number; // MDE from form (decimal, used in action)
  significanceLevel: number; // Alpha from form
  // Calculated duration estimates
  durationEstimates?: DurationEstimateRow[];
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

// Input type for the AI flow (used by "MDE to Sample Size" action)
export type CalculateAIFlowInput = {
  metric: string; // For AI context if needed, though not directly used in formula
  mean: number;
  variance: number;
  minimumDetectableEffect: number; // MDE as decimal
  statisticalPower: number;
  significanceLevel: number;
};


// Type for rows parsed from Excel/CSV
export interface ExcelDataRow {
  [key: string]: any; // Allow any string keys
  metric?: string;
  realEstate?: string;
  mean?: number;
  variance?: number;
  numberOfUsers?: number;
  lookbackDays?: number;
}
