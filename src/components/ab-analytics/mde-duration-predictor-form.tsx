
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
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
  MdeDurationPredictorFormSchema, 
  type MdeDurationPredictorFormValues, 
  type MdeDurationPredictorResultRow,
  type ExcelDataRow,
} from "@/lib/types";
import { calculateSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect, useRef } from "react";
import { Loader2, SettingsIcon, AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  METRIC_OPTIONS as DEFAULT_METRIC_OPTIONS, 
  REAL_ESTATE_OPTIONS as DEFAULT_REAL_ESTATE_OPTIONS, 
  DEFAULT_MDE_PERCENT, 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL, 
  METRIC_TYPE_OPTIONS,
  PREDICTION_DURATIONS
} from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { downloadMdeDurationPredictorReport } from "@/components/ab-analytics/report-download";

interface MdeDurationPredictorFormProps {
  onResults: (results: MdeDurationPredictorResultRow[] | null) => void;
  currentResults: MdeDurationPredictorResultRow[] | null;
}

export function MdeDurationPredictorForm({ onResults, currentResults }: MdeDurationPredictorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState<ExcelDataRow[] | null>(null);
  
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(DEFAULT_METRIC_OPTIONS);
  const [availableRealEstates, setAvailableRealEstates] = useState<string[]>(DEFAULT_REAL_ESTATE_OPTIONS);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const { toast } = useToast();

  const form = useForm<MdeDurationPredictorFormValues>({
    resolver: zodResolver(MdeDurationPredictorFormSchema),
    defaultValues: {
      metric: '',
      realEstate: 'platform',
      metricType: METRIC_TYPE_OPTIONS[1], 
      meanBaseline: NaN, 
      varianceBaseline: NaN, 
      historicalDailyTrafficBaseline: NaN,
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      numberOfVariants: 2,
    },
  });

  const selectedMetric = form.watch("metric");
  const selectedRealEstate = form.watch("realEstate");
  const selectedMetricType = form.watch("metricType");
  const meanBaseline = form.watch("meanBaseline");

  useEffect(() => {
    const storedData = localStorage.getItem('abalyticsMappedData');
    if (storedData) {
      try {
        const data: ExcelDataRow[] = JSON.parse(storedData);
        setParsedExcelData(data);
        const uniqueMetrics = Array.from(new Set(data.map(row => row.metric).filter(Boolean) as string[]));
        setAvailableMetrics(uniqueMetrics.length > 0 ? uniqueMetrics : DEFAULT_METRIC_OPTIONS);
        if (uniqueMetrics.length > 0 && !form.getValues("metric")) {
            form.setValue("metric", uniqueMetrics[0]);
        }
      } catch (e) { console.error("Failed to parse stored data:", e); setParsedExcelData(null); }
    }
  }, [form]);

  useEffect(() => {
    if (parsedExcelData && selectedMetric) {
      const filteredByMetric = parsedExcelData.filter(row => row.metric === selectedMetric);
      const uniqueRealEstates = Array.from(new Set(filteredByMetric.map(row => row.realEstate).filter(Boolean) as string[]));
      setAvailableRealEstates(uniqueRealEstates.length > 0 ? uniqueRealEstates : DEFAULT_REAL_ESTATE_OPTIONS);
      
      const currentFormRealEstate = form.getValues("realEstate");
      if (uniqueRealEstates.length > 0) {
        if (!uniqueRealEstates.includes(currentFormRealEstate) && currentFormRealEstate !== 'platform') { 
          form.setValue("realEstate", uniqueRealEstates[0]);
        } else if (!currentFormRealEstate && uniqueRealEstates.includes('platform')) {
             form.setValue("realEstate", 'platform');
        }
      }
    } else if (!parsedExcelData) {
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
    }
  }, [parsedExcelData, selectedMetric, form]);
  
  useEffect(() => {
    if (selectedMetricType === "Binary" && !isNaN(meanBaseline) && meanBaseline >= 0 && meanBaseline <= 1) {
      const calculatedVariance = meanBaseline * (1 - meanBaseline);
      form.setValue("varianceBaseline", parseFloat(calculatedVariance.toFixed(6)), { shouldValidate: true });
    }
  }, [selectedMetricType, meanBaseline, form]);


  async function onSubmit(values: MdeDurationPredictorFormValues) {
    setIsLoading(true);
    onResults(null);
    const aggregatedResults: MdeDurationPredictorResultRow[] = [];

    for (const duration of PREDICTION_DURATIONS) {
      let meanForCalc: number = values.meanBaseline;
      let varianceForCalc: number = values.varianceBaseline;
      let totalUsersForDuration: number | undefined = values.historicalDailyTrafficBaseline 
                                                      ? values.historicalDailyTrafficBaseline * duration 
                                                      : undefined;
      let warningsForThisRow: string[] = [];

      if (parsedExcelData && values.metric && values.realEstate) {
        const matchedRow = parsedExcelData.find(row => 
          row.metric === values.metric &&
          row.realEstate === values.realEstate &&
          row.lookbackDays == duration && // Ensure exact match for duration
          row.mean !== undefined && row.variance !== undefined && row.totalUsers !== undefined
        );

        if (matchedRow) {
          meanForCalc = matchedRow.mean!;
          varianceForCalc = matchedRow.variance!;
          totalUsersForDuration = matchedRow.totalUsers!;
          warningsForThisRow.push(`Using specific Excel data for ${duration} days.`);
        } else {
          warningsForThisRow.push(`Using baseline data for ${duration} days projection.`);
          if (totalUsersForDuration === undefined && values.historicalDailyTrafficBaseline === undefined) {
            warningsForThisRow.push("Baseline daily traffic not provided; cannot estimate total users or exposure.");
          }
        }
      } else {
         warningsForThisRow.push(`No Excel data loaded. Using baseline data for ${duration} days projection.`);
         if (totalUsersForDuration === undefined && values.historicalDailyTrafficBaseline === undefined) {
            warningsForThisRow.push("Baseline daily traffic not provided; cannot estimate total users or exposure.");
          }
      }
      
      try {
        const actionInput = {
          metric: values.metric,
          metricType: values.metricType,
          mean: meanForCalc,
          variance: varianceForCalc,
          minimumDetectableEffect: values.minimumDetectableEffect, // Already in %
          statisticalPower: values.statisticalPower,
          significanceLevel: values.significanceLevel,
          numberOfVariants: values.numberOfVariants,
          realEstate: values.realEstate,
          targetExperimentDurationDays: duration,
          totalUsersInSelectedDuration: totalUsersForDuration,
        };

        const result = await calculateSampleSizeAction(actionInput);
        aggregatedResults.push({
          duration,
          meanUsed: meanForCalc,
          varianceUsed: varianceForCalc,
          totalUsersAvailable: totalUsersForDuration,
          requiredSampleSizePerVariant: result.requiredSampleSizePerVariant,
          totalRequiredSampleSize: result.requiredSampleSizePerVariant && values.numberOfVariants ? result.requiredSampleSizePerVariant * values.numberOfVariants : undefined,
          exposureNeededPercentage: result.exposureNeededPercentage,
          warnings: [...warningsForThisRow, ...(result.warnings || [])],
        });

      } catch (error) {
        console.error(`Error calculating for duration ${duration}:`, error);
        aggregatedResults.push({
          duration,
          meanUsed: meanForCalc,
          varianceUsed: varianceForCalc,
          totalUsersAvailable: totalUsersForDuration,
          requiredSampleSizePerVariant: 'Error',
          totalRequiredSampleSize: 'Error',
          exposureNeededPercentage: 'Error',
          warnings: [...warningsForThisRow, `Calculation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        });
      }
    }
    onResults(aggregatedResults);
    setIsLoading(false);
    toast({ title: "Duration Prediction Complete", description: "Results table updated below." });
  }
  
  const handleDownloadReport = () => {
    if (currentResults && form.formState.isValid) {
      downloadMdeDurationPredictorReport(form.getValues(), currentResults);
    } else {
       toast({ variant: "destructive", title: "Cannot Download Report", description: "Please calculate results first or ensure form inputs are valid." });
    }
  };
  
  const isVarianceBaselineReadOnly = selectedMetricType === "Binary" && !isNaN(meanBaseline) && meanBaseline >= 0 && meanBaseline <= 1;

  // Function to clear results when key inputs change
  const clearResultsOnInputChange = () => {
    onResults(null);
  };


  return (
    <div className="space-y-6">
      <Form {...form}>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex justify-end">
                <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <SettingsIcon className="mr-2 h-4 w-4" /> Statistical Settings
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <FormProvider {...form}>
                            <DialogHeader>
                                <DialogTitle>Advanced Statistical Settings</DialogTitle>
                                <p className="text-xs text-muted-foreground">Adjust statistical power and significance level (alpha).</p>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <FormField control={form.control} name="statisticalPower" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Statistical Power (1 - β)</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 0.8" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); clearResultsOnInputChange();}} step="0.01" min="0.01" max="0.99" /></FormControl>
                                    <FormDescription className="text-xs">Typically 0.8 (80%).</FormDescription><FormMessage />
                                </FormItem>)} />
                                <FormField control={form.control} name="significanceLevel" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Significance Level (α)</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 0.05" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); clearResultsOnInputChange();}} step="0.01" min="0.01" max="0.99" /></FormControl>
                                    <FormDescription className="text-xs">Typically 0.05 (5%).</FormDescription><FormMessage />
                                </FormItem>)} />
                            </div>
                            <DialogFooter><DialogClose asChild><Button type="button">Done</Button></DialogClose></DialogFooter>
                        </FormProvider>
                    </DialogContent>
                </Dialog>
            </div>
            
            <Separator />
            <p className="text-sm font-medium text-foreground">Experiment Configuration</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="metric" render={({ field }) => (
                <FormItem>
                  <FormLabel>Metric</FormLabel>
                  <Select onValueChange={(value) => { field.onChange(value); clearResultsOnInputChange();}} value={field.value} disabled={!availableMetrics.length}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Metric" /></SelectTrigger></FormControl>
                    <SelectContent>{availableMetrics.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>)} />
              <FormField control={form.control} name="realEstate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Real Estate</FormLabel>
                  <Select onValueChange={(value) => { field.onChange(value); clearResultsOnInputChange(); }} value={field.value} disabled={!selectedMetric || !availableRealEstates.length}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select Real Estate" /></SelectTrigger></FormControl>
                    <SelectContent>{availableRealEstates.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>)} />
              <FormField control={form.control} name="metricType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Metric Type</FormLabel>
                  <Select onValueChange={(value) => { field.onChange(value); clearResultsOnInputChange(); form.setValue('varianceBaseline', NaN); }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select metric type" /></SelectTrigger></FormControl>
                    <SelectContent>{METRIC_TYPE_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>)} />
              <FormField control={form.control} name="minimumDetectableEffect" render={({ field }) => (
                <FormItem>
                  <FormLabel>MDE (%)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 0.5" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); clearResultsOnInputChange();}} step="any"/></FormControl>
                  <FormDescription className="text-xs">Minimum change you want to detect.</FormDescription>
                  <FormMessage />
                </FormItem>)} />
              <FormField control={form.control} name="numberOfVariants" render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Variants</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 2" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); clearResultsOnInputChange();}} /></FormControl>
                  <FormDescription className="text-xs">Incl. control (min 2).</FormDescription>
                  <FormMessage />
                </FormItem>)} />
            </div>
            
            <Separator />
            <p className="text-sm font-medium text-foreground">Baseline Historical Data (used if specific duration data isn't in uploaded file)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="meanBaseline" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mean (Baseline/Default)</FormLabel>
                  <FormControl><Input type="number" placeholder={selectedMetricType === 'Binary' ? "e.g., 0.1" : "e.g., 150"} {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); clearResultsOnInputChange();}} step="any" /></FormControl>
                  <FormDescription className="text-xs">{selectedMetricType === 'Binary' ? "Proportion (0-1)." : "Average value."}</FormDescription>
                  <FormMessage />
                </FormItem>)} />
              <FormField control={form.control} name="varianceBaseline" render={({ field }) => (
                <FormItem>
                  <FormLabel>Variance (Baseline/Default)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 0.1275" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); clearResultsOnInputChange();}} step="any" readOnly={isVarianceBaselineReadOnly} /></FormControl>
                  {isVarianceBaselineReadOnly ? 
                      <FormDescription className="text-xs text-primary">Auto-calculated (p*(1-p))</FormDescription> :
                      <FormDescription className="text-xs">Enter metric variance.</FormDescription>
                  }
                  <FormMessage />
                </FormItem>)} />
              <FormField control={form.control} name="historicalDailyTrafficBaseline" render={({ field }) => (
                <FormItem>
                  <FormLabel>Historical Daily Traffic (Baseline)</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g., 10000" {...field} value={isNaN(field.value ?? NaN) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); clearResultsOnInputChange();}} /></FormControl>
                  <FormDescription className="text-xs">Avg daily users. Used if specific duration data not found.</FormDescription>
                  <FormMessage />
                </FormItem>)} />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Predict Durations
              </Button>
              {currentResults && (
                 <Button type="button" variant="outline" onClick={handleDownloadReport} className="w-full sm:w-auto" disabled={isLoading}>
                    <Download className="mr-2 h-4 w-4" /> Download Report
                 </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </Form>
    </div>
  );
}

interface MdeDurationPredictorResultsDisplayProps {
  results: MdeDurationPredictorResultRow[];
}

export function MdeDurationPredictorResultsDisplay({ results }: MdeDurationPredictorResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

  const formatCell = (value: number | string | undefined, isPercentage = false, isLargeNumber = false) => {
    if (value === undefined || value === null || value === 'N/A' || value === 'Error' || (typeof value === 'number' && isNaN(value))) {
      return <span className="text-muted-foreground">{value === undefined || (typeof value === 'number' && isNaN(value)) ? 'N/A' : String(value)}</span>;
    }
    if (typeof value === 'number') {
      if (isLargeNumber) return value.toLocaleString();
      const numStr = isPercentage ? `${value.toFixed(1)}%` : value.toFixed(4);
      return value > 1000 && isPercentage ? '>1000%' : numStr;
    }
    return String(value);
  };


  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Duration Predictions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Duration (Days)</TableHead>
              <TableHead>Mean Used</TableHead>
              <TableHead>Variance Used</TableHead>
              <TableHead>Total Users Available</TableHead>
              <TableHead>Req. Sample Size (per variant)</TableHead>
              <TableHead>Total Req. Sample Size</TableHead>
              <TableHead>Exposure Needed (%)</TableHead>
              <TableHead>Notices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((row, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{row.duration}</TableCell>
                <TableCell>{formatCell(row.meanUsed, false)}</TableCell>
                <TableCell>{formatCell(row.varianceUsed, false)}</TableCell>
                <TableCell>{formatCell(row.totalUsersAvailable, false, true)}</TableCell>
                <TableCell className="text-primary font-semibold">{formatCell(row.requiredSampleSizePerVariant, false, true)}</TableCell>
                <TableCell className="text-primary font-semibold">{formatCell(row.totalRequiredSampleSize, false, true)}</TableCell>
                <TableCell className="text-primary font-semibold">{formatCell(row.exposureNeededPercentage, true)}</TableCell>
                <TableCell>
                  {row.warnings && row.warnings.length > 0 && (
                    <ul className="list-disc list-inside text-xs">
                      {row.warnings.map((warn, i) => (
                        <li key={i} className={warn.toLowerCase().includes("error") || warn.toLowerCase().includes("cannot estimate") ? "text-destructive" : "text-muted-foreground"}>
                          {warn.replace(/_/g, ' ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
