
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
  MdeToSampleSizeFormSchema, 
  type MdeToSampleSizeFormValues, 
  type MdeToSampleSizeCalculationResults,
  type ExcelDataRow,
} from "@/lib/types";
import { calculateSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect, useRef } from "react";
import { Loader2, AlertTriangle, Download, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { METRIC_OPTIONS as DEFAULT_METRIC_OPTIONS, REAL_ESTATE_OPTIONS as DEFAULT_REAL_ESTATE_OPTIONS, DEFAULT_MDE_PERCENT, DEFAULT_STATISTICAL_POWER, DEFAULT_SIGNIFICANCE_LEVEL, METRIC_TYPE_OPTIONS } from "@/lib/constants";


interface MdeToSampleSizeFormProps {
  onResults: (results: MdeToSampleSizeCalculationResults | null) => void;
  onDownload: (results: MdeToSampleSizeCalculationResults) => void;
  currentResults: MdeToSampleSizeCalculationResults | null;
}

export function MdeToSampleSizeForm({ onResults, onDownload, currentResults }: MdeToSampleSizeFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState<ExcelDataRow[] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(DEFAULT_METRIC_OPTIONS);
  const [availableRealEstates, setAvailableRealEstates] = useState<string[]>(DEFAULT_REAL_ESTATE_OPTIONS);
  const [isDataFromExcel, setIsDataFromExcel] = useState(false); 
  const { toast } = useToast();

  const form = useForm<MdeToSampleSizeFormValues>({
    resolver: zodResolver(MdeToSampleSizeFormSchema),
    defaultValues: {
      metric: '',
      metricType: METRIC_TYPE_OPTIONS[1], 
      mean: NaN, 
      variance: NaN, 
      realEstate: '',
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      historicalDailyTraffic: NaN, 
      targetExperimentDurationDays: 14,
      lookbackDays: 14, 
    },
  });

  const selectedMetric = form.watch("metric");
  const selectedRealEstate = form.watch("realEstate");
  const selectedMetricType = form.watch("metricType");
  const currentMean = form.watch("mean");
  const targetExperimentDuration = form.watch("targetExperimentDurationDays");

  const prevSelectedMetricRef = useRef<string | undefined>();
  const prevSelectedRealEstateRef = useRef<string | undefined>();
  const prevTargetExperimentDurationRef = useRef<number | undefined>();


  useEffect(() => {
    const storedData = localStorage.getItem('abalyticsMappedData');
    const storedFileName = localStorage.getItem('abalyticsFileName');
    if (storedData && storedFileName) {
      try {
        const data: ExcelDataRow[] = JSON.parse(storedData);
        setParsedExcelData(data);
        setUploadedFileName(storedFileName);
        
        const uniqueMetrics = Array.from(new Set(data.map(row => row.metric).filter(Boolean) as string[]));
        setAvailableMetrics(uniqueMetrics.length > 0 ? uniqueMetrics : DEFAULT_METRIC_OPTIONS);
        if (uniqueMetrics.length > 0 && !form.getValues("metric")) {
            form.setValue("metric", uniqueMetrics[0]);
        }
        
        toast({ title: "Loaded previously uploaded data", description: `Using data from ${storedFileName}. Select Metric, Real Estate, and set Target Duration.`, variant: "default" });
      } catch (e) {
        console.error("Failed to parse stored data:", e);
        localStorage.removeItem('abalyticsMappedData');
        localStorage.removeItem('abalyticsFileName');
        setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
        setIsDataFromExcel(false);
      }
    } else {
        setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
        setIsDataFromExcel(false);
        if (!form.getValues("metric") && DEFAULT_METRIC_OPTIONS.length > 0) form.setValue("metric", DEFAULT_METRIC_OPTIONS[0]);
        if (!form.getValues("realEstate") && DEFAULT_REAL_ESTATE_OPTIONS.length > 0) form.setValue("realEstate", DEFAULT_REAL_ESTATE_OPTIONS[0]);
    }
  }, [form, toast]);


  useEffect(() => {
    if (parsedExcelData && selectedMetric) {
      const filteredByMetric = parsedExcelData.filter(row => row.metric === selectedMetric);
      const uniqueRealEstates = Array.from(new Set(filteredByMetric.map(row => row.realEstate).filter(Boolean) as string[]));
      setAvailableRealEstates(uniqueRealEstates.length > 0 ? uniqueRealEstates : DEFAULT_REAL_ESTATE_OPTIONS);
      
      const currentFormRealEstate = form.getValues("realEstate");
      if (uniqueRealEstates.length > 0) {
        if (!uniqueRealEstates.includes(currentFormRealEstate)) {
          form.setValue("realEstate", uniqueRealEstates[0]);
        }
      } else if (DEFAULT_REAL_ESTATE_OPTIONS.length > 0 && !parsedExcelData.length) { 
          form.setValue("realEstate", DEFAULT_REAL_ESTATE_OPTIONS[0]);
      }
    } else if (!parsedExcelData) {
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
        if (DEFAULT_REAL_ESTATE_OPTIONS.length > 0 && !form.getValues("realEstate")) {
            form.setValue("realEstate", DEFAULT_REAL_ESTATE_OPTIONS[0]);
        }
    }
  }, [parsedExcelData, selectedMetric, form]);


  useEffect(() => {
    const userActuallyChangedMetric = prevSelectedMetricRef.current !== selectedMetric && prevSelectedMetricRef.current !== undefined;
    const userActuallyChangedRealEstate = prevSelectedRealEstateRef.current !== selectedRealEstate && prevSelectedRealEstateRef.current !== undefined;
    const userActuallyChangedTargetDuration = prevTargetExperimentDurationRef.current !== targetExperimentDuration && prevTargetExperimentDurationRef.current !== undefined;
    
    const isUserDrivenSelectorChange = userActuallyChangedMetric || userActuallyChangedRealEstate || userActuallyChangedTargetDuration;

    let valuesActuallyChangedByAutofill = false;

    if (parsedExcelData && selectedMetric && selectedRealEstate && targetExperimentDuration !== undefined && !isNaN(targetExperimentDuration) && targetExperimentDuration > 0) {
      const matchedRow = parsedExcelData.find(row => 
        row.metric === selectedMetric &&
        row.realEstate === selectedRealEstate &&
        row.lookbackDays === targetExperimentDuration 
      );

      if (matchedRow) {
        const meanVal = parseFloat(String(matchedRow.mean));
        const varianceVal = parseFloat(String(matchedRow.variance));
        const totalUsersVal = parseInt(String(matchedRow.totalUsers), 10); // Total users over lookback
        
        let dailyTrafficToSet: number | undefined = undefined;
        if (!isNaN(totalUsersVal) && matchedRow.lookbackDays && matchedRow.lookbackDays > 0) { // Use targetExperimentDuration for daily traffic calculation
          dailyTrafficToSet = totalUsersVal / matchedRow.lookbackDays;
        }

        if (form.getValues("mean") !== meanVal && !(isNaN(form.getValues("mean")) && isNaN(meanVal))) {
            form.setValue("mean", isNaN(meanVal) ? NaN : meanVal, { shouldValidate: true });
            valuesActuallyChangedByAutofill = true;
        }
        if (form.getValues("variance") !== varianceVal && !(isNaN(form.getValues("variance")) && isNaN(varianceVal))) {
            form.setValue("variance", isNaN(varianceVal) ? NaN : varianceVal, { shouldValidate: true });
             valuesActuallyChangedByAutofill = true;
        }
        if (dailyTrafficToSet !== undefined && form.getValues("historicalDailyTraffic") !== dailyTrafficToSet) {
            form.setValue("historicalDailyTraffic", parseFloat(dailyTrafficToSet.toFixed(2)), {shouldValidate: true});
            valuesActuallyChangedByAutofill = true;
        }
        form.setValue("lookbackDays", matchedRow.lookbackDays, { shouldValidate: true }); // Set lookbackDays from the matched row
        
        setIsDataFromExcel(true); 
        if (isUserDrivenSelectorChange && valuesActuallyChangedByAutofill) {
            onResults(null); 
            toast({ title: "Data auto-filled from file", description: `Values for ${selectedMetric} on ${selectedRealEstate} for ${targetExperimentDuration} days lookback applied. Daily traffic ~${Math.round(dailyTrafficToSet || 0)}.`, variant: "default" });
        }
      } else { 
        if(isDataFromExcel || isUserDrivenSelectorChange){ 
            form.setValue("mean", NaN);
            form.setValue("variance", NaN);
            form.setValue("historicalDailyTraffic", NaN);
            form.setValue("lookbackDays", targetExperimentDuration); 
            setIsDataFromExcel(false); 
        }
        if (isUserDrivenSelectorChange && parsedExcelData.length > 0) { 
            onResults(null);
            toast({ title: "No matching historical data for target duration", description: `No data found in file for ${targetExperimentDuration} days lookback for ${selectedMetric} on ${selectedRealEstate}. Input parameters manually.`, variant: "default" });
        }
      }
    } else if (!parsedExcelData && isUserDrivenSelectorChange) { 
        if(isDataFromExcel) { 
            form.setValue("mean", NaN);
            form.setValue("variance", NaN);
            form.setValue("historicalDailyTraffic", NaN);
            setIsDataFromExcel(false);
            onResults(null);
        }
    }
    
    prevSelectedMetricRef.current = selectedMetric;
    prevSelectedRealEstateRef.current = selectedRealEstate;
    prevTargetExperimentDurationRef.current = targetExperimentDuration;

  }, [parsedExcelData, selectedMetric, selectedRealEstate, targetExperimentDuration, form, toast, onResults, isDataFromExcel]);


  useEffect(() => {
    if (selectedMetricType === "Binary" && !isNaN(currentMean) && currentMean >= 0 && currentMean <= 1) {
      if (!isDataFromExcel) { 
        const calculatedVariance = currentMean * (1 - currentMean);
        form.setValue("variance", parseFloat(calculatedVariance.toFixed(6)), { shouldValidate: true });
      }
    }
  }, [selectedMetricType, currentMean, form, isDataFromExcel]); 


  async function onSubmit(values: MdeToSampleSizeFormValues) {
    setIsLoading(true);
    onResults(null); 
    try {
      const result = await calculateSampleSizeAction(values);
      onResults(result);

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
      }
       else {
         toast({
            variant: "destructive",
            title: "Calculation Failed",
            description: "Could not determine sample size. Please check inputs and try again.",
        });
      }

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
  
  const isVarianceReadOnlyForBinary = selectedMetricType === "Binary" && !isNaN(currentMean) && currentMean >= 0 && currentMean <= 1 && !isDataFromExcel;
  const isHistoricalFieldReadOnly = isDataFromExcel;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">MDE to Sample Size Inputs</CardTitle>
        <p className="text-muted-foreground">
          {uploadedFileName 
            ? `Using data from "${uploadedFileName}". Select Metric, Real Estate, and set Target Experiment Duration to auto-fill historical data.`
            : 'Enter parameters manually or upload a data file via the "Upload & Map Data" page for auto-fill options.'
          }
        </p>
         {uploadedFileName && parsedExcelData && (
            <div className="text-sm text-muted-foreground pt-2">
                Using data from: <span className="font-medium text-primary">{uploadedFileName}</span>
            </div>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="metric"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metric</FormLabel>
                    <Select 
                        onValueChange={(value) => { field.onChange(value); onResults(null);}} 
                        value={field.value}
                        disabled={!availableMetrics.length}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={parsedExcelData ? "Select Metric from file" : "Select a metric"} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableMetrics.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!parsedExcelData && <FormDescription className="text-xs">Upload a file for more options.</FormDescription>}
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
                    <Select 
                        onValueChange={(value) => { field.onChange(value); onResults(null); }} 
                        value={field.value}
                        disabled={!selectedMetric || !availableRealEstates.length}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder={parsedExcelData ? "Select Real Estate from file" : "Select real estate"} /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRealEstates.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="metricType"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Metric Type</FormLabel>
                    <Select onValueChange={(value) => { field.onChange(value); onResults(null); setIsDataFromExcel(false); form.setValue('variance', NaN); }} value={field.value}>
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
            </div>
            
            <Separator />
            <p className="text-sm text-muted-foreground">
              {isHistoricalFieldReadOnly 
                ? 'Historical data auto-filled from your file based on Target Duration. Input MDE.' 
                : (uploadedFileName && (!selectedMetric || !selectedRealEstate || targetExperimentDuration === undefined || isNaN(targetExperimentDuration))) 
                    ? 'Select Metric, Real Estate, and set Target Duration to auto-fill historical data, or input all parameters manually.' 
                    : 'Input all parameters manually.'
              }
            </p>
             {form.getValues("historicalDailyTraffic") > 0 && isHistoricalFieldReadOnly && (
                <div className="p-3 bg-accent/10 rounded-md text-sm text-accent-foreground flex items-center gap-2">
                    <Info className="h-5 w-5 text-accent" />
                    Using historical daily traffic of ~{Math.round(form.getValues("historicalDailyTraffic") || 0).toLocaleString()} (derived from selected Excel row's total users over {targetExperimentDuration} days lookback).
                </div>
            )}


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <FormField
                control={form.control}
                name="minimumDetectableEffect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Detectable Effect (MDE %)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 2 for 2%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any"/>
                    </FormControl>
                    <FormDescription className="text-xs">Enter as a percentage, e.g., 2 for 2%.</FormDescription>
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
                      <Input type="number" placeholder="e.g., 14" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} />
                    </FormControl>
                    <FormDescription className="text-xs">Drives historical data lookup from file if available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mean"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mean (Historical)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder={selectedMetricType === 'Binary' ? "e.g., 0.1 for 10%" : "e.g., 150"} {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isDataFromExcel) setIsDataFromExcel(false);}} step="any" readOnly={isHistoricalFieldReadOnly} />
                    </FormControl>
                    {isHistoricalFieldReadOnly && <FormDescription className="text-xs text-primary">Value from file for {targetExperimentDuration}-day lookback</FormDescription>}
                    <FormDescription className="text-xs">{selectedMetricType === 'Binary' ? "Proportion (0-1)." : "Average value."}</FormDescription>
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
                      <Input type="number" placeholder="e.g., 0.1275" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isDataFromExcel) setIsDataFromExcel(false);}} step="any" readOnly={isHistoricalFieldReadOnly || isVarianceReadOnlyForBinary} />
                    </FormControl>
                    {(isHistoricalFieldReadOnly ) && <FormDescription className="text-xs text-primary">Value from file for {targetExperimentDuration}-day lookback</FormDescription>}
                    {(isVarianceReadOnlyForBinary && !isHistoricalFieldReadOnly) && <FormDescription className="text-xs text-primary">Auto-calculated (p*(1-p))</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="historicalDailyTraffic"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Historical Daily Traffic</FormLabel>
                        <FormControl>
                        <Input 
                            type="number" 
                            placeholder="e.g., 5000" 
                            {...field} 
                            value={isNaN(field.value ?? NaN) ? '' : field.value}
                            onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isDataFromExcel) setIsDataFromExcel(false);}}
                            readOnly={isHistoricalFieldReadOnly} 
                        />
                        </FormControl>
                        {isHistoricalFieldReadOnly ? 
                            <FormDescription className="text-xs text-primary">Auto-derived daily average from total users in file for the {targetExperimentDuration}-day lookback.</FormDescription> :
                            <FormDescription className="text-xs">Enter average daily users. If using file, ensure Metric, Real Estate, and Target Duration match a row.</FormDescription>
                        }
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
                       <Input type="number" placeholder="e.g., 0.8 for 80%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
                      <Input type="number" placeholder="e.g., 0.05 for 5%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
              {currentResults && (currentResults.requiredSampleSize !== undefined || (currentResults.warnings && currentResults.warnings.length > 0)) && (
                 <Button type="button" variant="outline" onClick={() => currentResults && onDownload(currentResults)} className="w-full sm:w-auto">
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

export function MdeToSampleSizeResultsDisplay({ results }: { results: MdeToSampleSizeCalculationResults | null }) {
  if (!results) {
    return null;
  }
  
  const shouldShowCard = results.requiredSampleSize !== undefined || (results.warnings && results.warnings.length > 0);

  if (!shouldShowCard) {
     return null; 
  }

  const dailyTrafficForDisplay = results.historicalDailyTraffic && results.historicalDailyTraffic > 0 ? results.historicalDailyTraffic : 0;


  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">MDE to Sample Size Results</CardTitle>
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
                 {results.exposureNeededPercentage !== undefined && results.targetExperimentDurationDays && dailyTrafficForDisplay > 0 && (
                    <div>
                        <p className="font-medium text-muted-foreground">Exposure Needed for {results.targetExperimentDurationDays} days</p>
                        <p className="text-2xl font-semibold text-accent">
                            {results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? `${results.exposureNeededPercentage.toFixed(1)}%` : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">(Based on ~{Math.round(dailyTrafficForDisplay).toLocaleString()} daily users)</p>
                    </div>
                )}
                {results.exposureNeededPercentage === undefined && dailyTrafficForDisplay <= 0 && results.targetExperimentDurationDays && (
                     <div>
                        <p className="font-medium text-muted-foreground">Exposure Needed</p>
                        <p className="text-lg font-semibold text-destructive">Cannot calculate exposure without daily traffic data.</p>
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

