
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SampleSizeFormSchema, type SampleSizeFormValues, type SampleSizeCalculationResults } from "@/lib/types";
import { calculateSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { METRIC_OPTIONS, REAL_ESTATE_OPTIONS, DEFAULT_LOOKBACK_DAYS, DEFAULT_MDE_PERCENT, DEFAULT_STATISTICAL_POWER, DEFAULT_SIGNIFICANCE_LEVEL } from "@/lib/constants";

interface SampleSizeCalculatorFormProps {
  onResults: (results: SampleSizeCalculationResults | null) => void;
  onDownload: (results: SampleSizeCalculationResults) => void;
  currentResults: SampleSizeCalculationResults | null;
}

export function SampleSizeCalculatorForm({ onResults, onDownload, currentResults }: SampleSizeCalculatorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SampleSizeFormValues>({
    resolver: zodResolver(SampleSizeFormSchema),
    defaultValues: {
      metric: METRIC_OPTIONS[0],
      mean: undefined, // User must input
      variance: undefined, // User must input
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
      realEstate: REAL_ESTATE_OPTIONS[0],
      numberOfUsers: undefined, // User must input
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      inputType: "customData", // Default to custom as platform default is not implemented
    },
  });

  async function onSubmit(values: SampleSizeFormValues) {
    setIsLoading(true);
    onResults(null); // Clear previous results
    try {
      // Map form values to CalculateSampleSizeInput for the AI flow
      const inputForAI = {
        metric: values.metric,
        mean: values.mean,
        variance: values.variance,
        // lookbackDays is not directly in CalculateSampleSizeInput schema, but used for context
        realEstate: values.realEstate,
        numberOfUsers: values.numberOfUsers, // This is total users over lookback
        minimumDetectableEffect: values.minimumDetectableEffect / 100, // Convert percentage to decimal for AI
        statisticalPower: values.statisticalPower,
        significanceLevel: values.significanceLevel,
      };
      const result = await calculateSampleSizeAction(inputForAI);
      onResults(result);
      toast({
        title: "Calculation Successful",
        description: "Sample size and test duration estimated.",
      });
    } catch (error) {
      console.error(error);
      onResults(null);
      toast({
        variant: "destructive",
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Calculator Inputs</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="metric"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metric</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a metric" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METRIC_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="realEstate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Real Estate</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select real estate" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REAL_ESTATE_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="inputType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Input Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="platformDefault" disabled />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Platform Default (coming soon)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="customData" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Custom User Data
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            <p className="text-sm text-muted-foreground">Enter custom data below:</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="mean"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mean (Historical)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 0.15 for 15% CR" {...field} step="any"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="variance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variance (Historical)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 0.1275" {...field} step="any"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numberOfUsers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Users (in Lookback)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 100000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lookbackDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lookback Days</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 30" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minimumDetectableEffect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Detectable Effect (MDE %)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 2 for 2%" {...field} step="any"/>
                    </FormControl>
                    <FormDescription>Enter as a percentage, e.g., 2 for 2%.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <p className="text-sm text-muted-foreground">Adjust statistical parameters if needed:</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="statisticalPower"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statistical Power (1 - β)</FormLabel>
                    <FormControl>
                       <Input type="number" placeholder="e.g., 0.8 for 80%" {...field} step="0.01" min="0.01" max="0.99" />
                    </FormControl>
                     <FormDescription>Typically 0.8 (80%). Value between 0.01 and 0.99.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="significanceLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Significance Level (α)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 0.05 for 5%" {...field} step="0.01" min="0.01" max="0.99" />
                    </FormControl>
                    <FormDescription>Typically 0.05 (5%). Value between 0.01 and 0.99.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Calculate Sample Size
              </Button>
              {currentResults && (
                 <Button type="button" variant="outline" onClick={() => onDownload(currentResults)} className="w-full sm:w-auto">
                    Download Report
                 </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function SampleSizeResultsDisplay({ results }: { results: SampleSizeCalculationResults | null }) {
  if (!results) {
    return null;
  }

  const dailyUsers = results.numberOfUsers && results.lookbackDays ? results.numberOfUsers / results.lookbackDays : 0;
  const trafficSufficient = results.estimatedTestDuration && dailyUsers > 0 && (results.requiredSampleSize / dailyUsers) <= results.estimatedTestDuration;


  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Calculation Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-muted-foreground">Required Sample Size (per variant)</p>
            <p className="text-2xl font-semibold text-primary">{results.requiredSampleSize?.toLocaleString() || 'N/A'}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Estimated Test Duration</p>
            <p className="text-2xl font-semibold text-primary">{results.estimatedTestDuration ? `${results.estimatedTestDuration} days` : 'N/A'}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Confidence Level</p>
            <p className="text-lg text-accent">{(results.confidenceLevel * 100).toFixed(0)}%</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground">Power Level</p>
            <p className="text-lg text-accent">{(results.powerLevel * 100).toFixed(0)}%</p>
          </div>
        </div>
        
        {dailyUsers > 0 && results.estimatedTestDuration && (
            <div className={`p-3 rounded-md ${ trafficSufficient ? 'bg-green-100 border-green-300' : 'bg-yellow-100 border-yellow-300'} border`}>
                <p className={`font-medium ${trafficSufficient? 'text-green-700': 'text-yellow-700'}`}>
                    Traffic Recommendation: Based on historical daily traffic of ~{Math.round(dailyUsers).toLocaleString()} users for this real estate, 
                    current traffic is likely {trafficSufficient ? 'sufficient' : 'insufficient'} to complete the test within the estimated duration.
                </p>
            </div>
        )}

        {results.warnings && results.warnings.length > 0 && (
          <div>
            <h3 className="font-medium text-lg flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Warnings
            </h3>
            <ul className="list-disc list-inside space-y-1 pl-2 text-destructive-foreground bg-destructive/10 p-3 rounded-md">
              {results.warnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
       <CardFooter>
        <p className="text-xs text-muted-foreground">
          Note: These are estimates. Actual test duration may vary based on real-time traffic and achieved effect size.
        </p>
      </CardFooter>
    </Card>
  );
}

