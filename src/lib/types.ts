import { z } from 'zod';
import { type CalculateSampleSizeOutput } from '@/ai/flows/sample-size-calculator';
import { 
  DEFAULT_LOOKBACK_DAYS, 
  DEFAULT_MDE_PERCENT, 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL 
} from '@/lib/constants';

export const SampleSizeFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  mean: z.coerce.number().positive("Mean must be a positive number"),
  variance: z.coerce.number().nonnegative("Variance must be a non-negative number"),
  lookbackDays: z.coerce.number().int().positive("Lookback days must be a positive integer").default(DEFAULT_LOOKBACK_DAYS),
  realEstate: z.string().min(1, "Real Estate is required"),
  numberOfUsers: z.coerce.number().int().positive("Number of users must be a positive integer"),
  minimumDetectableEffect: z.coerce.number().positive("MDE must be a positive number").default(DEFAULT_MDE_PERCENT),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  inputType: z.enum(["platformDefault", "customData"]).default("platformDefault"),
});

export type SampleSizeFormValues = z.infer<typeof SampleSizeFormSchema>;

export type SampleSizeCalculationResults = CalculateSampleSizeOutput;

export const MdeExplorerFormSchema = z.object({
  metric: z.string().min(1, "Metric is required"),
  mean: z.coerce.number().positive("Mean must be a positive number"),
  variance: z.coerce.number().nonnegative("Variance must be a non-negative number"),
  lookbackDays: z.coerce.number().int().positive().default(DEFAULT_LOOKBACK_DAYS),
  realEstate: z.string().min(1, "Real Estate is required"),
  numberOfUsers: z.coerce.number().int().positive("Number of users must be a positive integer"),
  statisticalPower: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_STATISTICAL_POWER),
  significanceLevel: z.coerce.number().min(0.01).max(0.99).default(DEFAULT_SIGNIFICANCE_LEVEL),
  experimentDurations: z.array(z.coerce.number().int().min(1).max(8)).min(1, "Select at least one duration"),
});

export type MdeExplorerFormValues = z.infer<typeof MdeExplorerFormSchema>;

export interface MdeResultRow {
  weeks: number;
  totalUsers: number;
  achievableMde: number; // As percentage
  confidence: number; // As percentage
  power: number; // As percentage
}

export interface MdeExplorerResults {
  tableData: MdeResultRow[];
  chartData: { weeks: number; mde: number }[];
  warnings?: string[];
}
