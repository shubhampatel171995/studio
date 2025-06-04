
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
import { useState, useEffect } from "react";
import { Loader2, SettingsIcon, Download, AlertTriangle } from "lucide-react"; // Added AlertTriangle
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { downloadMdeDurationPredictorReport } from "@/components/ab-analytics/report-download";
import { cn } from "@/lib/utils";

interface MdeDurationPredictorFormProps {
  onResults: (results: MdeDurationPredictorResultRow[] | null) => void;
  currentResults: MdeDurationPredictorResultRow[] | null;
}

export function MdeDurationPredictorForm({ onResults, currentResults }: MdeDurationPredictorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState<ExcelDataRow[] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
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
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      numberOfVariants: 2,
    },
  });

  const selectedMetric = form.watch("metric");

  useEffect(() => {
    const storedData = localStorage.getItem('abalyticsMappedData');
    const storedFileName = localStorage.getItem('abalyticsFileName');
    if (storedData) {
      try {
        const data: ExcelDataRow[] = JSON.parse(storedData);
        setParsedExcelData(data);
        if(storedFileName) setUploadedFileName(storedFileName);

        const uniqueMetrics = Array.from(new Set(data.map(row => row.metric).filter(Boolean) as string[]));
        setAvailableMetrics(uniqueMetrics.length > 0 ? uniqueMetrics : DEFAULT_METRIC_OPTIONS);
        if (uniqueMetrics.length > 0 && !form.getValues("metric")) {
            form.setValue("metric", uniqueMetrics[0]);
        }
      } catch (e) { 
          console.error("Failed to parse stored data:", e); 
          setParsedExcelData(null); 
          setUploadedFileName(null);
          setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
          form.resetField("metric");
        }
    } else {
        setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
        setParsedExcelData(null);
        setUploadedFileName(null);
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
  
  async function onSubmit(values: MdeDurationPredictorFormValues) {
    if (!parsedExcelData || parsedExcelData.length === 0) {
        toast({
            variant: "destructive",
            title: "No Data Uploaded",
            description: "Please upload an Excel file with historical data using the 'Upload & Map Data' button on the main page.",
        });
        onResults(null);
        return;
    }

    setIsLoading(true);
    onResults(null);
    const aggregatedResults: MdeDurationPredictorResultRow[] = [];
    let allCalculationWarnings: string[] = []; 

    for (const duration of PREDICTION_DURATIONS) {
      let meanForCalc: number | undefined = undefined;
      let varianceForCalc: number | undefined = undefined;
      let totalUsersForDuration: number | undefined = undefined;
      let rowSpecificWarnings: string[] = [];

      const matchedRow = parsedExcelData.find(row => 
        row.metric === values.metric &&
        row.realEstate === values.realEstate &&
        row.lookbackDays == duration && // Ensure lookbackDays matches the current duration
        row.mean !== undefined && !isNaN(Number(row.mean)) &&
        row.variance !== undefined && !isNaN(Number(row.variance)) &&
        row.totalUsers !== undefined && !isNaN(Number(row.totalUsers))
      );

      if (matchedRow) {
        meanForCalc = Number(matchedRow.mean);
        varianceForCalc = Number(matchedRow.variance);
        totalUsersForDuration = Number(matchedRow.totalUsers);
      } else {
        rowSpecificWarnings.push(`Data_not_found_in_uploaded_file_for_${duration}-day_duration.`);
      }
      
      if (meanForCalc !== undefined && varianceForCalc !== undefined) { // Only proceed if mean/variance found
        try {
          const actionInput = {
            metric: values.metric, // Passed for context
            metricType: values.metricType,
            mean: meanForCalc,
            variance: varianceForCalc,
            minimumDetectableEffect: values.minimumDetectableEffect, 
            statisticalPower: values.statisticalPower,
            significanceLevel: values.significanceLevel,
            numberOfVariants: values.numberOfVariants,
            realEstate: values.realEstate, // Passed for context
            targetExperimentDurationDays: duration,
            totalUsersInSelectedDuration: totalUsersForDuration, // This can be undefined if not found
          };

          // This result is MdeToSampleSizeCalculationResults
          const result = await calculateSampleSizeAction(actionInput as any); // Cast as any to satisfy MdeToSampleSizeFormValues temporarily
          
          aggregatedResults.push({
            duration,
            totalUsersAvailable: totalUsersForDuration, // Use found or undefined
            totalRequiredSampleSize: result.requiredSampleSizePerVariant && values.numberOfVariants ? result.requiredSampleSizePerVariant * values.numberOfVariants : undefined,
            exposureNeededPercentage: result.exposureNeededPercentage,
            warnings: [...rowSpecificWarnings, ...(result.warnings || [])], 
          });
          if (result.warnings) allCalculationWarnings.push(...result.warnings.map(w => `${duration}-day: ${w.replace(/_/g, ' ')}`));

        } catch (error) {
          console.error(`Error calculating for duration ${duration}:`, error);
          const errorMsg = `Calculation_error_for_${duration}-day:_${error instanceof Error ? error.message : 'Unknown_error'}`;
          aggregatedResults.push({
            duration,
            totalUsersAvailable: 'Error',
            totalRequiredSampleSize: 'Error',
            exposureNeededPercentage: 'Error',
            warnings: [...rowSpecificWarnings, errorMsg],
          });
          allCalculationWarnings.push(errorMsg.replace(/_/g, ' '));
        }
      } else {
         aggregatedResults.push({
            duration,
            totalUsersAvailable: 'N/A',
            totalRequiredSampleSize: 'N/A',
            exposureNeededPercentage: 'N/A',
            warnings: rowSpecificWarnings, 
          });
          if (rowSpecificWarnings.length > 0) allCalculationWarnings.push(...rowSpecificWarnings.map(w => `${duration}-day: ${w.replace(/_/g, ' ')}`));
      }
    }
    onResults(aggregatedResults);
    setIsLoading(false);
    
    if (allCalculationWarnings.length > 0) {
        const uniqueWarnings = Array.from(new Set(allCalculationWarnings));
        const warningSummary = uniqueWarnings.slice(0, 2).join('; ') + (uniqueWarnings.length > 2 ? '...' : '');
        toast({ 
            title: "Dynamic Duration Calculation Complete with Notices", 
            description: `Some calculations had issues or missing data. ${warningSummary}. Full details in downloaded report.`,
            duration: 7000,
        });
    } else {
        toast({ title: "Dynamic Duration Calculation Complete", description: "Results table updated below." });
    }
  }
  
  const handleDownloadReport = () => {
    if (currentResults && form.formState.isValid) {
      downloadMdeDurationPredictorReport(form.getValues(), currentResults);
    } else if (!parsedExcelData || parsedExcelData.length === 0) {
        toast({ variant: "destructive", title: "Cannot Download Report", description: "Please upload data first." });
    }
    else {
       toast({ variant: "destructive", title: "Cannot Download Report", description: "Please calculate results first or ensure form inputs are valid." });
    }
  };
  
  const clearResultsOnInputChange = () => {
    onResults(null);
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="font-headline text-2xl">Dynamic Duration Calculator</CardTitle>
          <CardDescription>
            Predict sample size needed across different durations.
          </CardDescription>
        </div>
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <SettingsIcon className="h-5 w-5" />
              <span className="sr-only">Open Statistical Settings</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <FormProvider {...form}>
              <DialogHeader>
                <DialogTitle>Advanced Statistical Settings</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Adjust statistical power and significance level (alpha).
                </p>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="statisticalPower"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statistical Power (1 - β)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 0.8 for 80%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => { field.onChange(Number(e.target.value)); clearResultsOnInputChange(); }} step="0.01" min="0.01" max="0.99" />
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
                        <Input type="number" placeholder="e.g., 0.05 for 5%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => { field.onChange(Number(e.target.value)); clearResultsOnInputChange(); }} step="0.01" min="0.01" max="0.99" />
                      </FormControl>
                      <FormDescription className="text-xs">Typically 0.05 (5%). Value between 0.01 and 0.99.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" onClick={() => setIsSettingsDialogOpen(false)}>Done</Button>
                </DialogClose>
              </DialogFooter>
            </FormProvider>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Separator />
              <p className="text-sm font-medium text-foreground">Experiment Configuration</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="metric" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metric</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); clearResultsOnInputChange(); }} value={field.value} disabled={!availableMetrics.length || !parsedExcelData}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Metric" /></SelectTrigger></FormControl>
                      <SelectContent>{availableMetrics.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>)} />
                <FormField control={form.control} name="realEstate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Real Estate</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); clearResultsOnInputChange(); }} value={field.value} disabled={!selectedMetric || !availableRealEstates.length || !parsedExcelData}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Real Estate" /></SelectTrigger></FormControl>
                      <SelectContent>{availableRealEstates.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>)} />
                <FormField control={form.control} name="metricType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metric Type</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); clearResultsOnInputChange(); }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select metric type" /></SelectTrigger></FormControl>
                      <SelectContent>{METRIC_TYPE_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>)} />
                <FormField control={form.control} name="minimumDetectableEffect" render={({ field }) => (
                  <FormItem>
                    <FormLabel>MDE (%)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 0.5" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => { field.onChange(Number(e.target.value)); clearResultsOnInputChange(); }} step="any" /></FormControl>
                    <FormDescription className="text-xs">Minimum change you want to detect.</FormDescription>
                    <FormMessage />
                  </FormItem>)} />
                <FormField control={form.control} name="numberOfVariants" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Variants</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 2" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => { field.onChange(Number(e.target.value)); clearResultsOnInputChange(); }} /></FormControl>
                    <FormDescription className="text-xs">Incl. control (min 2).</FormDescription>
                    <FormMessage />
                  </FormItem>)} />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button type="submit" disabled={isLoading || !parsedExcelData} className="w-full sm:w-auto">
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
          </Form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}

interface MdeDurationPredictorResultsDisplayProps {
  results: MdeDurationPredictorResultRow[];
}

export function MdeDurationPredictorResultsDisplay({ results }: MdeDurationPredictorResultsDisplayProps) {
  if (!results || results.length === 0) {
    return null;
  }

 const formatCell = (value: number | string | undefined, isPercentage = false, isLargeNumber = false, precision = isPercentage ? 1 : (isLargeNumber ? 0 : 2) ) => {
    if (value === undefined || value === null) return <span className="text-muted-foreground">-</span>;
    if (typeof value === 'string') {
        if (value === 'N/A') return <span className="text-muted-foreground">N/A</span>;
        if (value === 'Error') return <span className="text-destructive font-semibold">Error</span>;
        const parsedNum = parseFloat(value);
         if (isNaN(parsedNum)) return <span className="text-muted-foreground">{String(value)}</span>; 
        value = parsedNum;
    }
    
    if (typeof value === 'number' && isNaN(value)) return <span className="text-muted-foreground">N/A</span>;


    if (typeof value === 'number') {
      if (isPercentage) {
        if (value === Infinity) return <span className="text-primary font-semibold">∞%</span>;
        if (value > 1000) return <span className="text-primary font-semibold">&gt;1000%</span>;
        return <span className="text-primary font-semibold">{value.toFixed(precision)}%</span>;
      }
      return <span className={cn(isLargeNumber && "font-semibold", typeof value === 'number' ? "text-primary" : "text-foreground")}>{value.toLocaleString(undefined, {minimumFractionDigits: isLargeNumber ? 0 : precision, maximumFractionDigits: precision})}</span>;
    }
    return <span className="text-muted-foreground">{String(value)}</span>; 
  };

  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Dynamic Duration Calculator Predictions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Duration (Days)</TableHead>
                <TableHead className="min-w-[150px]">Total Users Available</TableHead>
                <TableHead className="min-w-[180px]">Total Req. Sample Size</TableHead>
                <TableHead className="min-w-[150px]">Exposure Needed (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row.duration}</TableCell>
                  <TableCell>{formatCell(row.totalUsersAvailable, false, true)}</TableCell>
                  <TableCell>{formatCell(row.totalRequiredSampleSize, false, true)}</TableCell>
                  <TableCell>{formatCell(row.exposureNeededPercentage, true)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
         {results.some(row => row.warnings && row.warnings.length > 0) && (
            <div className="mt-4">
              <h3 className="font-medium text-sm flex items-center text-muted-foreground">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Some durations may have notices. Download report for details.
              </h3>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
