
import { z } from 'zod';
import { type CalculateSampleSizeOutput as CalculateSampleSizeAIFlowOutput } from '@/ai/flows/sample-size-calculator';
import { 
  DEFAULT_LOOKBACK_DAYS, 
  DEFAULT_MDE_PERCENT, 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL 
} from '@/lib/constants';

// Schema for "MDE to Sample Size" flow (formerly SampleSizeCalculator)
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
  inputType: z.enum(["platformDefault", "customData"]).default("customData"), // Retained for potential future use
});

export type MdeToSampleSizeFormValues = z.infer<typeof MdeToSampleSizeFormSchema>;

export interface DurationEstimateRow {
  weeks: number;
  totalUsersAvailable: number;
  isSufficient: boolean;
}

export type MdeToSampleSizeCalculationResults = CalculateSampleSizeAIFlowOutput & {
  metric: string;
  mean: number;
  variance: number;
  numberOfUsers: number; // From form, for daily traffic calculation
  lookbackDays: number; // From form, for daily traffic calculation
  realEstate: string;
  minimumDetectableEffect: number; // MDE from form (decimal)
  significanceLevel: number; // Alpha from form
  durationEstimates?: DurationEstimateRow[];
};


// Schema for "Sample Size to MDE" flow (formerly MdeExplorer)
export const SampleSizeToMdeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  mean: z.coerce.number({invalid_type_error: "Mean must be a number"}).positive("Mean must be a positive number"),
  variance: z.coerce.number({invalid_type_error: "Variance must be a number"}).nonnegative("Variance must be a non-negative number"),
  sampleSizePerVariant: z.coerce.number({invalid_type_error: "Sample size must be a number"}).int().positive("Sample size per variant must be a positive integer"),
  // experimentDurationDays: z.coerce.number().int().positive("Experiment duration must be a positive integer"), // No longer needed for MDE calculation from sample size directly
  realEstate: z.string().min(1, "Real Estate is required"), // For context/reporting
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
});

export type SampleSizeToMdeFormValues = z.infer<typeof SampleSizeToMdeFormSchema>;

export interface SampleSizeToMdeCalculationResults {
  inputs: SampleSizeToMdeFormValues;
  achievableMde?: number; // As percentage
  confidenceLevel?: number; // 1 - significanceLevel
  powerLevel?: number; // statisticalPower
  warnings?: string[];
}

// Retaining original names for AI flow types for now to minimize AI flow code changes if possible,
// though the AI flow's responsibility is being reduced.
export type CalculateAIFlowInput = {
  metric: string;
  mean: number;
  variance: number;
  minimumDetectableEffect: number; // MDE as decimal
  statisticalPower: number;
  significanceLevel: number;
};

export type CalculateAIFlowOutput = {
  requiredSampleSize?: number; // Per variant
  confidenceLevel?: number;
  powerLevel?: number;
  warnings?: string[];
};
