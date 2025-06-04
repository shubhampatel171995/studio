
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form"; // Added FormProvider
import { Button } from "@/components/ui/button";
import {
  Form, // This is already a FormProvider from ShadCN
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ManualCalculatorFormSchema, 
  type ManualCalculatorFormValues, 
  type MdeToSampleSizeCalculationResults 
} from "@/lib/types";
import { calculateSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Download, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
    DEFAULT_MDE_PERCENT, 
    DEFAULT_STATISTICAL_POWER, 
    DEFAULT_SIGNIFICANCE_LEVEL, 
    METRIC_TYPE_OPTIONS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { downloadManualCalculatorReport } from "@/components/ab-analytics/report-download";


export function ManualCalculatorForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MdeToSampleSizeCalculationResults | null>(null);
  const { toast } = useToast();

  const form = useForm<ManualCalculatorFormValues>({
    resolver: zodResolver(ManualCalculatorFormSchema),
    defaultValues: {
      metricType: METRIC_TYPE_OPTIONS[0],
      mean: NaN, 
      variance: NaN, 
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      historicalDailyTraffic: NaN,
      targetExperimentDurationDays: 14, 
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      numberOfVariants: 2,
    },
  });

  const metricType = form.watch("metricType");
  const mean = form.watch("mean");

  useEffect(() => {
    if (metricType === "Binary" && !isNaN(mean) && mean >= 0 && mean <= 1) {
      const calculatedVariance = mean * (1 - mean);
      form.setValue("variance", parseFloat(calculatedVariance.toFixed(6)), { shouldValidate: true });
    }
  }, [metricType, mean, form]);

  async function onSubmit(values: ManualCalculatorFormValues) {
    setIsLoading(true);
    setResults(null); 
    try {
      // Adapt ManualCalculatorFormValues to MdeToSampleSizeFormValues for the action
      const actionInput: MdeToSampleSizeFormValues = {
        metric: `Manual - ${values.metricType}`, // Construct a metric name
        metricType: values.metricType,
        mean: values.mean,
        variance: values.variance,
        minimumDetectableEffect: values.minimumDetectableEffect, 
        statisticalPower: values.statisticalPower,
        significanceLevel: values.significanceLevel,
        numberOfVariants: values.numberOfVariants,
        // For manual calculator, totalUsersInSelectedDuration is calculated from daily traffic and duration
        totalUsersInSelectedDuration: (values.historicalDailyTraffic ?? 0) * values.targetExperimentDurationDays,
        targetExperimentDurationDays: values.targetExperimentDurationDays,
        lookbackDays: values.targetExperimentDurationDays, 
        realEstate: "Manual Input", 
      };

      const result = await calculateSampleSizeAction(actionInput);
      
      const augmentedResult: MdeToSampleSizeCalculationResults = {
        ...result, 
        metric: `Manual - ${values.metricType}`, 
        metricType: values.metricType,
        mean: values.mean,
        variance: values.variance,
        minimumDetectableEffect: values.minimumDetectableEffect / 100, 
        significanceLevel: values.significanceLevel,
        numberOfVariants: values.numberOfVariants,
        totalUsersInSelectedDuration: (values.historicalDailyTraffic ?? 0) * values.targetExperimentDurationDays,
        targetExperimentDurationDays: values.targetExperimentDurationDays,
        lookbackDays: values.targetExperimentDurationDays,
        realEstate: "Manual Input",
        historicalDailyTraffic: values.historicalDailyTraffic,
      };
      
      setResults(augmentedResult);

      if (result.requiredSampleSizePerVariant !== undefined && result.requiredSampleSizePerVariant > 0) {
        toast({
            title: "Calculation Complete",
            description: "Required sample size per variant and exposure calculated.",
        });
      } else if (result.warnings && result.warnings.length > 0) {
        toast({
            title: "Calculation Notice",
            description: result.warnings.join(' ').replace(/_/g, ' ') || "Could not fully determine sample size. See notices for details.",
            variant: "default", 
        });
      } else {
         toast({
            variant: "destructive",
            title: "Calculation Failed",
            description: "Could not determine sample size. Please check inputs and try again.",
        });
      }

    } catch (error) {
      console.error(error);
      setResults(null);
      toast({
        variant: "destructive",
        title: "Calculation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleDownloadReport = () => {
    if (results) {
      const reportData: MdeToSampleSizeCalculationResults = {
          ...results, 
          metricType: form.getValues("metricType"), 
          targetExperimentDurationDays: form.getValues("targetExperimentDurationDays"),
          numberOfVariants: form.getValues("numberOfVariants"),
          historicalDailyTraffic: form.getValues("historicalDailyTraffic"),
          // Pass the derived total users for consistency in reporting
          totalUsersInSelectedDuration: (form.getValues("historicalDailyTraffic") ?? 0) * form.getValues("targetExperimentDurationDays"),
      };
      downloadManualCalculatorReport(reportData);
    } else {
       toast({
        variant: "destructive",
        title: "Cannot Download Report",
        description: "Please calculate results first.",
      });
    }
  };

  return (
    <div className="space-y-6">
        <Form {...form}> {/* Outer FormProvider */}
          <FormProvider {...form}> {/* Inner FormProvider to reinforce context */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="metricType"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Metric Type</FormLabel>
                        <Select onValueChange={(value) => { field.onChange(value); setResults(null); form.setValue('variance', NaN); }} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select metric type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {METRIC_TYPE_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                        </Select>
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
                          <Input type="number" placeholder="e.g., 0.5 for 0.5%" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} step="any" value={isNaN(field.value) ? '' : field.value}/>
                        </FormControl>
                        <FormDescription className="text-xs">Enter as a percentage, e.g., 0.5 for 0.5%.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />
                <p className="text-sm text-muted-foreground">Enter metric parameters:</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="mean"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Mean (Baseline Value / Proportion)</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder={metricType === 'Binary' ? "e.g., 0.1 for 10%" : "e.g., 150"} {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} step="any" />
                        </FormControl>
                        <FormDescription className="text-xs">{metricType === 'Binary' ? "For binary, enter proportion (0-1)." : "Baseline average."}</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="variance"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Variance</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="e.g., 0.09" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} step="any" readOnly={metricType === 'Binary' && !isNaN(mean) && mean >=0 && mean <=1}/>
                        </FormControl>
                        <FormDescription className="text-xs">{metricType === 'Binary' ? "Auto-calculated as p*(1-p) if Mean is valid proportion. Editable." : "Enter metric variance."}</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>

                <Separator />
                <p className="text-sm text-muted-foreground">Enter traffic, duration and variant parameters:</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <FormField
                    control={form.control}
                    name="historicalDailyTraffic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Historical Daily Traffic</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 5000" {...field} value={isNaN(field.value ?? NaN) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} />
                        </FormControl>
                        <FormDescription className="text-xs">Average daily users for traffic estimates.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="targetExperimentDurationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Experiment Duration (days)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 14" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} />
                        </FormControl>
                         <FormDescription className="text-xs">How long you plan to run the experiment.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="numberOfVariants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Variants</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="e.g., 2" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} />
                        </FormControl>
                         <FormDescription className="text-xs">Total variants including control (min 2).</FormDescription>
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
                        <Input type="number" placeholder="e.g., 0.8" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} step="0.01" min="0.01" max="0.99" />
                        </FormControl>
                        <FormDescription className="text-xs">Typically 0.8 (80%). Value between 0.01 and 0.99.</FormDescription>
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
                        <Input type="number" placeholder="e.g., 0.05" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} step="0.01" min="0.01" max="0.99" />
                        </FormControl>
                        <FormDescription className="text-xs">Typically 0.05 (5%). Value between 0.01 and 0.99.</FormDescription>
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
                </div>
            </form>
          </FormProvider>
        </Form>

        {results && <ManualCalculatorResultsDisplay results={results} />}
    </div>
  );
}

interface ManualCalculatorResultsDisplayProps {
    results: MdeToSampleSizeCalculationResults;
}

export function ManualCalculatorResultsDisplay({ results }: ManualCalculatorResultsDisplayProps) {
  const dailyUsers = results.historicalDailyTraffic && results.historicalDailyTraffic > 0 ? results.historicalDailyTraffic : 0;
  const targetDurationDays = results.targetExperimentDurationDays;
  const numberOfVariants = results.numberOfVariants || 2; 
  
  const shouldShowCard = results.requiredSampleSizePerVariant !== undefined;

  if (!shouldShowCard && (!results.warnings || results.warnings.length === 0)) {
     return null; 
  }

  const onlyShowWarnings = results.requiredSampleSizePerVariant === undefined && results.warnings && results.warnings.length > 0;

  const totalRequiredSampleSize = results.requiredSampleSizePerVariant ? results.requiredSampleSizePerVariant * numberOfVariants : undefined;

  let targetDurationInfo: { usersAvailable?: number; isSufficient?: boolean, exposureNeeded?: number } = {};
  if (targetDurationDays && dailyUsers > 0 && results.requiredSampleSizePerVariant && results.requiredSampleSizePerVariant > 0 && results.totalUsersInSelectedDuration) {
    const totalRequiredForExposure = results.requiredSampleSizePerVariant * numberOfVariants;
    targetDurationInfo.usersAvailable = results.totalUsersInSelectedDuration;
    targetDurationInfo.isSufficient = targetDurationInfo.usersAvailable >= totalRequiredForExposure;
    if(targetDurationInfo.usersAvailable > 0) {
        targetDurationInfo.exposureNeeded = results.exposureNeededPercentage;
    }
  }


  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {onlyShowWarnings && results.warnings && (
             <div className="mt-4">
              <h3 className="font-medium text-lg flex items-center text-destructive">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Notices
              </h3>
              <ul className="list-disc list-inside space-y-1 pl-2 text-destructive bg-destructive/10 p-3 rounded-md">
                {results.warnings.map((warning, index) => (
                  <li key={index} className="text-sm">{warning.replace(/_/g, ' ')}</li>
                ))}
              </ul>
            </div>
        )}
        {!onlyShowWarnings && results.requiredSampleSizePerVariant === undefined && (!results.warnings || results.warnings.length === 0) && (
            <p className="text-muted-foreground text-center py-8">Please run the calculation with valid inputs.</p>
        )}
        {!onlyShowWarnings && results.requiredSampleSizePerVariant !== undefined && results.requiredSampleSizePerVariant > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm mb-6">
            <div>
                <p className="font-medium text-muted-foreground">Required Sample Size (per variant)</p>
                <p className="text-2xl font-semibold text-primary">{results.requiredSampleSizePerVariant?.toLocaleString() || 'N/A'}</p>
            </div>
             {totalRequiredSampleSize !== undefined && (
                <div>
                    <p className="font-medium text-muted-foreground">Total Required Sample Size</p>
                    <p className="text-2xl font-semibold text-primary">{totalRequiredSampleSize.toLocaleString()}</p>
                </div>
            )}
             {results.exposureNeededPercentage !== undefined && results.targetExperimentDurationDays && dailyUsers > 0 && (
                <div>
                    <p className="font-medium text-muted-foreground">Exposure Needed for {results.targetExperimentDurationDays} days</p>
                    <p className="text-2xl font-semibold text-primary">
                        {results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? `${results.exposureNeededPercentage.toFixed(1)}%` : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A'}
                    </p>
                     <p className="text-xs text-muted-foreground">(Based on ~{Math.round(dailyUsers).toLocaleString()} daily users)</p>
                </div>
            )}
            </div>
        )}
        
         {!onlyShowWarnings && targetDurationDays && dailyUsers > 0 && results.requiredSampleSizePerVariant && results.requiredSampleSizePerVariant > 0 && targetDurationInfo.usersAvailable !== undefined && totalRequiredSampleSize !== undefined && (
                <div className={cn("text-sm mb-3 p-3 rounded-md shadow", 
                                 targetDurationInfo.isSufficient ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200")}>
                    <h4 className="font-semibold mb-1">For your Target Duration of {targetDurationDays} days:</h4>
                    <p>Estimated total available users: <strong>{Math.round(targetDurationInfo.usersAvailable).toLocaleString()}</strong>.</p>
                    <p>This is {targetDurationInfo.isSufficient ? <strong className="font-semibold">sufficient</strong> : <strong className="font-semibold">not sufficient</strong>} for the total required sample size of {totalRequiredSampleSize.toLocaleString()}.</p>
                    {targetDurationInfo.exposureNeeded !== undefined && (
                        <p>Required exposure of traffic: <strong className="text-primary">{targetDurationInfo.exposureNeeded >=0 && targetDurationInfo.exposureNeeded <= 1000 ? `${targetDurationInfo.exposureNeeded.toFixed(1)}%` : targetDurationInfo.exposureNeeded > 1000 ? '>1000%' : 'N/A'}</strong>.</p>
                    )}
                </div>
            )}
      </CardContent>
    </Card>
  );
}

