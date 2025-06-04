
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
import { SampleSizeToMdeFormSchema, type SampleSizeToMdeFormValues, type SampleSizeToMdeCalculationResults } from "@/lib/types";
import { calculateMdeFromSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState } from "react";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { METRIC_OPTIONS, REAL_ESTATE_OPTIONS, DEFAULT_STATISTICAL_POWER, DEFAULT_SIGNIFICANCE_LEVEL, DEFAULT_SAMPLE_SIZE_PER_VARIANT } from "@/lib/constants";


interface SampleSizeToMdeFormProps {
  onResults: (results: SampleSizeToMdeCalculationResults | null) => void;
  onDownload: (results: SampleSizeToMdeCalculationResults) => void;
  currentResults: SampleSizeToMdeCalculationResults | null;
}


export function SampleSizeToMdeForm({ onResults, onDownload, currentResults }: SampleSizeToMdeFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SampleSizeToMdeFormValues>({
    resolver: zodResolver(SampleSizeToMdeFormSchema),
    defaultValues: {
      metric: METRIC_OPTIONS[0],
      mean: NaN,
      variance: NaN,
      sampleSizePerVariant: DEFAULT_SAMPLE_SIZE_PER_VARIANT,
      realEstate: REAL_ESTATE_OPTIONS[0],
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
    },
  });

  async function onSubmit(values: SampleSizeToMdeFormValues) {
    setIsLoading(true);
    onResults(null);
    try {
      const resultAction = await calculateMdeFromSampleSizeAction(values);
      const fullResults = { inputs: values, ...resultAction };
      onResults(fullResults);

      if (resultAction.achievableMde !== undefined) {
        toast({
          title: "MDE Calculation Complete",
          description: "Achievable MDE calculated based on your inputs.",
        });
      } else if (resultAction.warnings && resultAction.warnings.length > 0) {
         toast({
          title: "Calculation Notice",
          description: resultAction.warnings.join(' ').replace(/_/g, ' '),
        });
      } else {
         toast({
          variant: "destructive",
          title: "No MDE Calculated",
          description: "Please check your inputs and try again.",
        });
      }
    } catch (error) {
      console.error(error);
      onResults(null); // Clear results on error
      toast({
        variant: "destructive",
        title: "MDE Calculation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleDownloadReport = () => {
    if (currentResults) { // currentResults already includes 'inputs'
      onDownload(currentResults);
    } else {
       toast({
        variant: "destructive",
        title: "Cannot Download Report",
        description: "Please calculate MDE results first.",
      });
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Sample Size to MDE Inputs</CardTitle>
        <p className="text-muted-foreground text-xs">Enter your available sample size and other parameters to find the achievable MDE.</p>
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
                    <FormLabel>Real Estate (for context)</FormLabel>
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

            <Separator />
            <p className="text-sm text-muted-foreground">Enter parameters for MDE calculation:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="sampleSizePerVariant" render={({ field }) => (
                  <FormItem><FormLabel>Sample Size (per variant)</FormLabel><FormControl><Input type="number" placeholder="e.g., 50000" {...field} value={isNaN(field.value) ? '' : field.value} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="mean" render={({ field }) => (
                  <FormItem><FormLabel>Mean (Historical)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.15" {...field} step="any" value={isNaN(field.value) ? '' : field.value}/></FormControl><FormDescription className="text-xs">Needed for relative MDE.</FormDescription><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="variance" render={({ field }) => (
                  <FormItem><FormLabel>Variance (Historical)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.1275" {...field} step="any" value={isNaN(field.value) ? '' : field.value}/></FormControl><FormMessage /></FormItem>
              )}/>
            </div>

            <Separator />
            <p className="text-sm text-muted-foreground">Adjust statistical parameters if needed:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="statisticalPower" render={({ field }) => (
                  <FormItem><FormLabel>Statistical Power (1 - β)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.8" {...field} step="0.01" min="0.01" max="0.99" value={isNaN(field.value) ? '' : field.value} /></FormControl><FormDescription className="text-xs">Typically 0.8 (80%).</FormDescription><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="significanceLevel" render={({ field }) => (
                  <FormItem><FormLabel>Significance Level (α)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.05" {...field} step="0.01" min="0.01" max="0.99" value={isNaN(field.value) ? '' : field.value} /></FormControl><FormDescription className="text-xs">Typically 0.05 (5%).</FormDescription><FormMessage /></FormItem>
              )}/>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Calculate Achievable MDE
              </Button>
               {currentResults && (currentResults.achievableMde !== undefined || (currentResults.warnings && currentResults.warnings.length > 0)) && (
                  <Button type="button" variant="outline" onClick={handleDownloadReport} className="w-full sm:w-auto">
                      <Download className="mr-2 h-4 w-4" /> Download Report
                  </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function SampleSizeToMdeResultsDisplay({ results }: { results: SampleSizeToMdeCalculationResults | null }) {
  if (!results) return null;

  const { achievableMde, warnings, confidenceLevel, powerLevel } = results;

  const shouldShowCard = achievableMde !== undefined || (warnings && warnings.length > 0);

  if (!shouldShowCard) {
     return null; 
  }


  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Sample Size to MDE Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {achievableMde === undefined && warnings && warnings.length === 0 && (
             <p className="text-muted-foreground text-center py-8">Please run the calculation.</p>
        )}

        {achievableMde !== undefined && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Achievable MDE (Relative)</p>
              <p className="text-2xl font-semibold text-primary">{achievableMde.toFixed(2)}%</p>
            </div>
            {confidenceLevel !== undefined && (
              <div>
                <p className="font-medium text-muted-foreground">Confidence Level</p>
                <p className="text-lg text-accent">{(confidenceLevel * 100).toFixed(0)}%</p>
              </div>
            )}
            {powerLevel !== undefined && (
             <div>
                <p className="font-medium text-muted-foreground">Power Level</p>
                <p className="text-lg text-accent">{(powerLevel * 100).toFixed(0)}%</p>
              </div>
            )}
          </div>
        )}

        {warnings && warnings.length > 0 && (
          <div className={`mt-4 ${achievableMde === undefined ? '' : 'pt-4 border-t'}`}>
            <h3 className="font-medium text-lg flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Notices
            </h3>
            <ul className="list-disc list-inside space-y-1 pl-2 text-destructive bg-destructive/10 p-3 rounded-md">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          MDE values are estimates. This MDE is the smallest relative change you can reliably detect with the given parameters.
        </p>
      </CardFooter>
    </Card>
  );
}

