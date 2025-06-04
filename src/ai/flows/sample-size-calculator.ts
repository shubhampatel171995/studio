
'use server';

/**
 * @fileOverview AI Flow for calculating the required sample size for an A/B test based on MDE.
 *
 * - calculateSampleSize - Calculates the required sample size for an A/B test.
 * - CalculateAIFlowInput - The input type for the calculateSampleSize function. (from types.ts)
 * - CalculateAIFlowOutput - The return type for the calculateSampleSize function. (from types.ts)
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { CalculateAIFlowInput, CalculateAIFlowOutput } from '@/lib/types'; 
import { METRIC_TYPE_OPTIONS } from '@/lib/constants';


const CalculateAIFlowInputSchema = z.object({
  metric: z.string().describe('The metric being measured (e.g., conversion rate, average order value).'),
  metricType: z.enum([METRIC_TYPE_OPTIONS[0], ...METRIC_TYPE_OPTIONS.slice(1)]).describe('The type of metric: "Binary" or "Continuous".'),
  mean: z.number().describe('The historical mean of the metric. For Binary, this is the baseline proportion (0-1).'),
  variance: z.number().describe('The historical variance of the metric. For Binary, this might be p*(1-p).'),
  minimumDetectableEffect: z
    .number()
    .describe('The minimum detectable effect (MDE) as a decimal (e.g., 0.05 for 5%) that the experiment aims to detect.'),
  statisticalPower: z.number().default(0.8).describe('The desired statistical power (default: 0.8).'),
  significanceLevel: z.number().default(0.05).describe('The significance level (alpha) (default: 0.05).'),
});

// Zod schema for AI flow output, ensure it aligns with CalculateAIFlowOutput from types.ts
const CalculateAIFlowOutputSchema = z.object({
  requiredSampleSize: z.number().optional().describe('The required sample size per variant.'),
  confidenceLevel: z.number().optional().describe('The confidence level (1 - significance level).'),
  powerLevel: z.number().optional().describe('The statistical power level.'),
  warnings: z.array(z.string()).optional().describe('Any warnings about the input data or calculation (e.g., high variance).'),
});


export async function calculateSampleSize(input: CalculateAIFlowInput): Promise<CalculateAIFlowOutput> {
  return calculateSampleSizeFlow(input);
}

const calculateSampleSizePrompt = ai.definePrompt({
  name: 'calculateSampleSizePrompt',
  input: {schema: CalculateAIFlowInputSchema},
  output: {schema: CalculateAIFlowOutputSchema},
  prompt: `You are an AI-powered statistical reasoning tool that helps experiment owners calculate the required sample size for A/B tests.

  Given the following inputs, calculate the required sample size per variant for an A/B test.
  The formula for sample size per group (N) for a two-sided test is typically:
  N = 2 * (Z_alpha/2 + Z_beta)^2 * variance / MDE_absolute^2
  where MDE_absolute = mean * MDE_relative (if MDE_relative is {{{minimumDetectableEffect}}}).
  If the metric type is "Binary", MDE_absolute is simply {{{minimumDetectableEffect}}} if it represents an absolute change in proportion.
  However, the provided MDE ({{{minimumDetectableEffect}}}) is a relative MDE. So, MDE_absolute = mean * {{{minimumDetectableEffect}}}.
  
  Z_alpha/2 is the Z-score for the significance level (e.g., 1.96 for alpha=0.05).
  Z_beta is the Z-score for statistical power (e.g., 0.84 for power=0.80).

  Inputs:
  Metric Name: {{{metric}}}
  Metric Type: {{{metricType}}}
  Mean: {{{mean}}}
  Variance: {{{variance}}}
  Minimum Detectable Effect (MDE, relative, as decimal): {{{minimumDetectableEffect}}}
  Statistical Power: {{{statisticalPower}}}
  Significance Level (Alpha): {{{significanceLevel}}}

  Perform the calculation and provide the required sample size per variant.
  Also, determine the confidence level (1 - significance level) and echo back the power level.
  
  If Metric Type is "Binary":
  - Confirm if the provided variance ({{{variance}}}) is consistent with mean * (1 - mean). If not, note it but use the provided variance for calculation.
  - Ensure mean is between 0 and 1.
  
  If Metric Type is "Continuous":
  - Ensure mean is positive.

  General Checks:
  - If the provided variance is very high compared to the mean (e.g., variance > 2 * mean if mean is not close to zero and positive) or very low (e.g., variance < 0.01 * mean if mean is not close to zero and positive), include a warning.
  - If MDE is extremely small (e.g. < 0.001 or 0.1%) or very large (e.g. > 0.5 or 50%), note that it might lead to impractical sample sizes.

  Output the results in the following JSON format. Ensure requiredSampleSize is an integer.
  {
    "requiredSampleSize": number, // integer, per variant
    "confidenceLevel": number, // e.g., 0.95 for 95%
    "powerLevel": number, // e.g., 0.8 for 80%
    "warnings": string[] // array of warning strings, if any
  }`,
});

const calculateSampleSizeFlow = ai.defineFlow(
  {
    name: 'calculateSampleSizeFlow',
    inputSchema: CalculateAIFlowInputSchema,
    outputSchema: CalculateAIFlowOutputSchema,
  },
  async (input: CalculateAIFlowInput): Promise<CalculateAIFlowOutput> => {
    const flowSpecificWarnings: string[] = [];

    if (input.metricType === "Binary") {
        if (input.mean < 0 || input.mean > 1) {
            flowSpecificWarnings.push('Warning: For Binary metric, Mean (proportion) should be between 0 and 1.');
        }
        const calculatedVariance = input.mean * (1 - input.mean);
        // Using a tolerance for floating point comparison
        if (Math.abs(input.variance - calculatedVariance) > 1e-9) { 
            flowSpecificWarnings.push(`Warning: Provided variance (${input.variance.toFixed(6)}) for Binary metric differs from calculated (p*(1-p) = ${calculatedVariance.toFixed(6)}). Using provided variance for calculation.`);
        }
    } else if (input.metricType === "Continuous") {
        if (input.mean <= 0) {
            flowSpecificWarnings.push('Warning: For Continuous metric, Mean should be positive.');
        }
    }


    if (input.mean > 0) { 
        if (input.variance > input.mean * 2) {
        flowSpecificWarnings.push('Warning: The provided variance is relatively high compared to the mean. This will increase the required sample size.');
        }
        if (input.variance < input.mean * 0.01 && input.mean > 1e-6) { 
        flowSpecificWarnings.push('Warning: The provided variance is_very_low_compared_to_the_mean.');
        }
    } else if (input.metricType === "Continuous" && input.variance > 1000) { // If mean is 0 or negative for continuous, high variance is just a large number
         flowSpecificWarnings.push('Warning: The provided variance is high, and mean is zero or negative for a continuous metric. Ensure inputs are correct.');
    }
    
    if (input.minimumDetectableEffect < 0.001) { 
        flowSpecificWarnings.push('Warning: The MDE is very small (<0.1%), which may lead to an extremely large required sample size.');
    }
    if (input.minimumDetectableEffect > 0.5) { 
        flowSpecificWarnings.push('Warning: The MDE is very large (>50%). Ensure this is the intended sensitivity.');
    }


    const { output: aiOutput } = await calculateSampleSizePrompt(input);

    if (!aiOutput) {
      throw new Error("AI model did not return a valid output structure for sample size calculation.");
    }
    
    const finalWarnings = Array.from(new Set([...(aiOutput.warnings || []), ...flowSpecificWarnings]));

    return {
      requiredSampleSize: aiOutput.requiredSampleSize !== undefined ? Math.ceil(aiOutput.requiredSampleSize) : undefined,
      confidenceLevel: aiOutput.confidenceLevel !== undefined ? aiOutput.confidenceLevel : (1 - input.significanceLevel),
      powerLevel: aiOutput.powerLevel !== undefined ? aiOutput.powerLevel : input.statisticalPower,
      warnings: finalWarnings.length > 0 ? finalWarnings : undefined,
    };
  }
);
