
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ManualCalculatorFormSchema, 
  type ManualCalculatorFormValues, 
  type MdeToSampleSizeCalculationResults 
} from "@/lib/types";
import { calculateSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
    DEFAULT_MDE_PERCENT, 
    DEFAULT_STATISTICAL_POWER, 
    DEFAULT_SIGNIFICANCE_LEVEL, 
    METRIC_TYPE_OPTIONS,
} from "@/lib/constants";
// Table related imports are removed
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      const actionInput = {
        metric: `Manual - ${values.metricType}`, 
        metricType: values.metricType,
        mean: values.mean,
        variance: values.variance,
        minimumDetectableEffect: values.minimumDetectableEffect, 
        statisticalPower: values.statisticalPower,
        significanceLevel: values.significanceLevel,
        historicalDailyTraffic: values.historicalDailyTraffic, 
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
        historicalDailyTraffic: values.historicalDailyTraffic,
        targetExperimentDurationDays: values.targetExperimentDurationDays,
        lookbackDays: values.targetExperimentDurationDays,
        realEstate: "Manual Input",
      };
      
      setResults(augmentedResult);

      if (result.requiredSampleSize !== undefined && result.requiredSampleSize > 0) {
        toast({
            title: "Calculation Complete",
            description: "Required sample size and exposure calculated.",
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
      const reportData = {
          ...results,
          metricType: form.getValues("metricType"), 
          targetExperimentDurationDays: form.getValues("targetExperimentDurationDays"),
          historicalDailyTraffic: form.getValues("historicalDailyTraffic"),
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
        <Form {...form}>
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
                      <Input type="number" placeholder="e.g., 2 for 2%" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} step="any"/>
                    </FormControl>
                    <FormDescription>Enter as a percentage, e.g., 2 for 2%.</FormDescription>
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
                    <FormDescription>{metricType === 'Binary' ? "For binary, enter proportion (0-1)." : "Baseline average."}</FormDescription>
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
                    <FormDescription>{metricType === 'Binary' ? "Auto-calculated as p*(1-p) if Mean is valid proportion. Editable." : "Enter metric variance."}</FormDescription>
                    <FormMessage />
                </FormItem>
                )}
            />
            </div>

            <Separator />
            <p className="text-sm text-muted-foreground">Enter traffic and duration parameters:</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FormField
                control={form.control}
                name="historicalDailyTraffic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Historical Daily Traffic</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 5000" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} />
                    </FormControl>
                    <FormDescription>Average daily users for traffic estimates.</FormDescription>
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
                     <FormDescription>How long you plan to run the experiment.</FormDescription>
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
                    <Input type="number" placeholder="e.g., 0.05" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); setResults(null);}} step="0.01" min="0.01" max="0.99" />
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
            {results && (results.requiredSampleSize !== undefined || (results.warnings && results.warnings.length > 0)) && (
                <Button type="button" variant="outline" onClick={handleDownloadReport} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" /> Download Report
                </Button>
            )}
            </div>
        </form>
        </Form>

        {results && <ManualCalculatorResultsDisplay results={results} targetDurationDays={form.getValues("targetExperimentDurationDays")} />}
    </div>
  );
}

interface ManualCalculatorResultsDisplayProps {
    results: MdeToSampleSizeCalculationResults;
    targetDurationDays?: number;
}

export function ManualCalculatorResultsDisplay({ results, targetDurationDays }: ManualCalculatorResultsDisplayProps) {
  const dailyUsers = results.historicalDailyTraffic || 0; 
  
  const shouldShowCard = results.requiredSampleSize !== undefined || (results.warnings && results.warnings.length > 0);

  if (!shouldShowCard) {
     return null; 
  }

  let targetDurationInfo: { usersAvailable?: number; isSufficient?: boolean, exposureNeeded?: number } = {};
  if (targetDurationDays && dailyUsers > 0 && results.requiredSampleSize && results.requiredSampleSize > 0) {
    const totalRequiredForExposure = results.requiredSampleSize * 2;
    targetDurationInfo.usersAvailable = dailyUsers * targetDurationDays;
    targetDurationInfo.isSufficient = targetDurationInfo.usersAvailable >= totalRequiredForExposure;
    if(targetDurationInfo.usersAvailable > 0) {
        targetDurationInfo.exposureNeeded = (totalRequiredForExposure / targetDurationInfo.usersAvailable) * 100;
    }
  }

  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Calculation Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {results.requiredSampleSize === undefined && (!results.warnings || results.warnings.length === 0) && (
            <p className="text-muted-foreground text-center py-8">Please run the calculation with valid inputs.</p>
        )}
        {results.requiredSampleSize !== undefined && results.requiredSampleSize > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 text-sm mb-6">
            <div>
                <p className="font-medium text-muted-foreground">Required Sample Size (per variant)</p>
                <p className="text-2xl font-semibold text-primary">{results.requiredSampleSize?.toLocaleString() || 'N/A'}</p>
            </div>
             {results.exposureNeededPercentage !== undefined && results.targetExperimentDurationDays && dailyUsers > 0 && (
                <div>
                    <p className="font-medium text-muted-foreground">Exposure Needed for {results.targetExperimentDurationDays} days</p>
                    <p className="text-2xl font-semibold text-accent">
                        {results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? `${results.exposureNeededPercentage.toFixed(1)}%` : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A'}
                    </p>
                     <p className="text-xs text-muted-foreground">(Based on ~{Math.round(dailyUsers).toLocaleString()} daily users)</p>
                </div>
            )}
            <div>
                <p className="font-medium text-muted-foreground">Confidence Level</p>
                <p className="text-lg text-accent">{(results.confidenceLevel && results.confidenceLevel * 100)?.toFixed(0) || 'N/A'}%</p>
            </div>
            <div>
                <p className="font-medium text-muted-foreground">Power Level</p>
                <p className="text-lg text-accent">{(results.powerLevel && results.powerLevel * 100)?.toFixed(0) || 'N/A'}%</p>
            </div>
            </div>
        )}
        
        {/* Duration vs. Traffic Availability Table Removed */}
         {targetDurationDays && dailyUsers > 0 && results.requiredSampleSize && results.requiredSampleSize > 0 && targetDurationInfo.usersAvailable !== undefined && (
                <div className={cn("text-sm mb-3 p-3 rounded-md shadow", 
                                 targetDurationInfo.isSufficient ? "bg-green-100 text-green-800 border border-green-200" : "bg-red-100 text-red-800 border border-red-200")}>
                    <h4 className="font-semibold mb-1">For your Target Duration of {targetDurationDays} days:</h4>
                    <p>Estimated total available users: <strong>{Math.round(targetDurationInfo.usersAvailable).toLocaleString()}</strong>.</p>
                    <p>This is {targetDurationInfo.isSufficient ? <strong className="font-semibold">sufficient</strong> : <strong className="font-semibold">not sufficient</strong>} for the total required sample size of {(results.requiredSampleSize * 2).toLocaleString()}.</p>
                    {targetDurationInfo.exposureNeeded !== undefined && (
                        <p>Required exposure of daily traffic: <strong>{targetDurationInfo.exposureNeeded >=0 && targetDurationInfo.exposureNeeded <= 1000 ? `${targetDurationInfo.exposureNeeded.toFixed(1)}%` : targetDurationInfo.exposureNeeded > 1000 ? '>1000%' : 'N/A'}</strong>.</p>
                    )}
                </div>
            )}


        {results.warnings && results.warnings.length > 0 && (
          <div className={`mt-4 ${results.requiredSampleSize === undefined || results.requiredSampleSize <=0 ? '' : 'pt-4 border-t'}`}>
            <h3 className="font-medium text-lg flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Notices from Calculation
            </h3>
            <ul className="list-disc list-inside space-y-1 pl-2 text-destructive-foreground bg-destructive/10 p-3 rounded-md">
              {results.warnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
       <CardFooter>
        <p className="text-xs text-muted-foreground">
          Note: These are estimates. Actual test duration may vary based on real-time traffic and achieved effect size. Required sample size is for two variants (A/B).
        </p>
      </CardFooter>
    </Card>
  );
}
