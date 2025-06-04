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
  async input => {
    const warnings: string[] = [];

    if (input.variance > input.mean * 2) {
      warnings.push('Warning: The variance is high compared to the mean, which may affect the accuracy of the sample size calculation.');
    }

    if (input.variance < input.mean * 0.1) {
      warnings.push('Warning: The variance is low compared to the mean, which may affect the accuracy of the sample size calculation.');
    }

    // Estimate test duration based on daily users.
    const dailyUsers = input.numberOfUsers / 30; // Assuming 30-day lookback window.
    const estimatedTestDuration = input.requiredSampleSize / dailyUsers;

    if (dailyUsers <= 0) {
      warnings.push('Warning: Daily user count is zero or negative. Please provide a valid user count.');
    }

    if (estimatedTestDuration > 28) {
      warnings.push('Warning: The user base is insufficient to reach the required sample size in a reasonable timeframe (more than 4 weeks).');
    }

    const {output} = await calculateSampleSizePrompt(input);

    return {
      ...output!,
      estimatedTestDuration,
      confidenceLevel: 1 - input.significanceLevel,
      powerLevel: input.statisticalPower,
      warnings: [...(output?.warnings ?? []), ...warnings],
    };
  }
);
