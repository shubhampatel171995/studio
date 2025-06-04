
'use server';

/**
 * @fileOverview Flow for calculating the required sample size for an A/B test.
 *
 * - calculateSampleSize - Calculates the required sample size for an A/B test.
 * - CalculateSampleSizeInput - The input type for the calculateSampleSize function.
 * - CalculateSampleSizeOutput - The return type for the calculateSampleSize function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CalculateSampleSizeInputSchema = z.object({
  metric: z.string().describe('The metric being measured (e.g., conversion rate, average order value).'),
  mean: z.number().describe('The historical mean of the metric.'),
  variance: z.number().describe('The historical variance of the metric.'),
  realEstate: z.string().describe('The real estate where the experiment is conducted (e.g., Home Page, PDP).'),
  numberOfUsers: z.number().describe('The number of users exposed to the real estate during the lookback window.'),
  minimumDetectableEffect: z
    .number()
    .describe('The minimum detectable effect (MDE) that the experiment aims to detect.'),
  statisticalPower: z.number().default(0.8).describe('The desired statistical power (default: 0.8).'),
  significanceLevel: z.number().default(0.05).describe('The significance level (alpha) (default: 0.05).'),
});

export type CalculateSampleSizeInput = z.infer<typeof CalculateSampleSizeInputSchema>;

const CalculateSampleSizeOutputSchema = z.object({
  requiredSampleSize: z.number().describe('The required sample size per variant.'),
  estimatedTestDuration: z
    .number()
    .describe('The estimated test duration in days, based on the number of users.'),
  confidenceLevel: z.number().describe('The confidence level (1 - significance level).'),
  powerLevel: z.number().describe('The statistical power level.'),
  warnings: z.array(z.string()).describe('Any warnings about the input data (e.g., high variance, insufficient user base).'),
});

export type CalculateSampleSizeOutput = z.infer<typeof CalculateSampleSizeOutputSchema>;

export async function calculateSampleSize(input: CalculateSampleSizeInput): Promise<CalculateSampleSizeOutput> {
  return calculateSampleSizeFlow(input);
}

const calculateSampleSizePrompt = ai.definePrompt({
  name: 'calculateSampleSizePrompt',
  input: {schema: CalculateSampleSizeInputSchema},
  output: {schema: CalculateSampleSizeOutputSchema},
  prompt: `You are an AI-powered statistical reasoning tool that helps experiment owners calculate the required sample size for A/B tests.

  Given the following inputs, calculate the required sample size per variant for an A/B test.

  Metric: {{{metric}}}
  Mean: {{{mean}}}
  Variance: {{{variance}}}
  Real Estate: {{{realEstate}}}
  Number of Users: {{{numberOfUsers}}}
  Minimum Detectable Effect (MDE): {{{minimumDetectableEffect}}}
  Statistical Power: {{{statisticalPower}}}
  Significance Level: {{{significanceLevel}}}

  Consider the following:
  - Factor in the real estate (e.g., Home Page, PDP), statistical power, and significance level into the sample size estimation.
  - If the provided variance is too high or too low, include a warning in the 'warnings' array.
  - If the user base is insufficient to reach the required sample size in a reasonable timeframe (e.g., more than 4 weeks), include a warning in the 'warnings' array.

  Output the results in the following JSON format:
  {
    "requiredSampleSize": number,
    "estimatedTestDuration": number,
    "confidenceLevel": number,
    "powerLevel": number,
    "warnings": string[]
  }`,
});

const calculateSampleSizeFlow = ai.defineFlow(
  {
    name: 'calculateSampleSizeFlow',
    inputSchema: CalculateSampleSizeInputSchema,
    outputSchema: CalculateSampleSizeOutputSchema,
  },
  async (input: CalculateSampleSizeInput): Promise<CalculateSampleSizeOutput> => {
    const flowSpecificWarnings: string[] = [];

    if (input.variance > input.mean * 2) {
      flowSpecificWarnings.push('Warning: The variance is high compared to the mean, which may affect the accuracy of the sample size calculation.');
    }
    if (input.variance < input.mean * 0.1) {
      flowSpecificWarnings.push('Warning: The variance is low compared to the mean, which may affect the accuracy of the sample size calculation.');
    }

    const { output: aiOutput } = await calculateSampleSizePrompt(input);

    if (!aiOutput) {
      // This case should ideally be handled by Genkit/AI plugin error mechanisms,
      // but as a defensive measure if it somehow results in a null/undefined output object.
      throw new Error("AI model did not return a valid output structure for sample size calculation.");
    }
    
    // Use requiredSampleSize from AI for duration calculation.
    // Default to 0 if not a valid number to prevent NaN issues in calculations.
    const requiredSampleSizeFromAI = typeof aiOutput.requiredSampleSize === 'number' && isFinite(aiOutput.requiredSampleSize) 
                                     ? aiOutput.requiredSampleSize 
                                     : 0;

    let calculatedEstimatedTestDuration: number;

    if (requiredSampleSizeFromAI > 0) {
      // Assumption: input.numberOfUsers is total users over a 30-day period,
      // consistent with how duration warnings were intended in original flow.
      const dailyUsers = input.numberOfUsers / 30; 

      if (dailyUsers > 0) {
        calculatedEstimatedTestDuration = requiredSampleSizeFromAI / dailyUsers;
        if (calculatedEstimatedTestDuration > 28) { // More than 4 weeks
          flowSpecificWarnings.push('Warning: Based on the provided user count (assumed over 30 days), the estimated test duration to reach the required sample size is more than 4 weeks.');
        }
      } else {
        flowSpecificWarnings.push('Warning: Daily user count (derived from input over 30 days) is zero or negative. Cannot accurately estimate test duration using flow logic.');
        // Fallback to AI's estimatedTestDuration if available and valid, otherwise default to 0.
        calculatedEstimatedTestDuration = typeof aiOutput.estimatedTestDuration === 'number' && isFinite(aiOutput.estimatedTestDuration) 
                                          ? aiOutput.estimatedTestDuration 
                                          : 0; 
      }
    } else {
      flowSpecificWarnings.push('Warning: Required sample size from AI is zero, missing, or invalid. Cannot accurately estimate test duration using flow logic.');
      // Fallback to AI's estimatedTestDuration if available and valid, otherwise default to 0.
      calculatedEstimatedTestDuration = typeof aiOutput.estimatedTestDuration === 'number' && isFinite(aiOutput.estimatedTestDuration) 
                                        ? aiOutput.estimatedTestDuration 
                                        : 0;
      if (requiredSampleSizeFromAI === 0 && aiOutput.requiredSampleSize === undefined) {
        flowSpecificWarnings.push('Info: Required sample size from AI is missing.');
      }
    }
    
    // Ensure the final duration is a finite number to match the schema (z.number()).
    const finalEstimatedTestDuration = isFinite(calculatedEstimatedTestDuration) ? calculatedEstimatedTestDuration : 0;

    return {
      ...aiOutput, // Spread AI output first (includes its original warnings, requiredSampleSize, estimatedTestDuration etc.)
      requiredSampleSize: requiredSampleSizeFromAI, // Use the validated/defaulted one from AI
      estimatedTestDuration: finalEstimatedTestDuration, // Override with potentially more refined flow calculation or fallback
      confidenceLevel: 1 - input.significanceLevel, // This is correctly calculated from input
      powerLevel: input.statisticalPower, // This is correctly taken from input
      // Merge warnings from AI and flow, then deduplicate
      warnings: Array.from(new Set([...(aiOutput.warnings || []), ...flowSpecificWarnings])), 
    };
  }
);

