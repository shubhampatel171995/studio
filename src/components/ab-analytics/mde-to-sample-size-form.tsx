
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
  MdeToSampleSizeFormSchema, 
  type MdeToSampleSizeFormValues, 
  type MdeToSampleSizeCalculationResults,
  type ExcelDataRow,
} from "@/lib/types";
import { calculateSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect, useRef } from "react";
import { Loader2, SettingsIcon, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { METRIC_OPTIONS as DEFAULT_METRIC_OPTIONS, REAL_ESTATE_OPTIONS as DEFAULT_REAL_ESTATE_OPTIONS, DEFAULT_MDE_PERCENT, DEFAULT_STATISTICAL_POWER, DEFAULT_SIGNIFICANCE_LEVEL, METRIC_TYPE_OPTIONS } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [isHistoricalFieldReadOnly, setIsHistoricalFieldReadOnly] = useState(false);


  const { toast } = useToast();

  const form = useForm<MdeToSampleSizeFormValues>({
    resolver: zodResolver(MdeToSampleSizeFormSchema),
    defaultValues: {
      metric: '',
      metricType: METRIC_TYPE_OPTIONS[1], 
      mean: NaN, 
      variance: NaN, 
      realEstate: 'platform',
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      targetExperimentDurationDays: 14,
      totalUsersInSelectedDuration: NaN,
      lookbackDays: 14, 
      numberOfVariants: 2,
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
        
      } catch (e) {
        console.error("Failed to parse stored data:", e);
        localStorage.removeItem('abalyticsMappedData');
        localStorage.removeItem('abalyticsFileName');
        setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
        setIsDataFromExcel(false);
        setIsHistoricalFieldReadOnly(false);
      }
    } else {
        setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
        setIsDataFromExcel(false);
        setIsHistoricalFieldReadOnly(false);
        if (!form.getValues("metric") && DEFAULT_METRIC_OPTIONS.length > 0) form.setValue("metric", DEFAULT_METRIC_OPTIONS[0]);
        if (!form.getValues("realEstate") && DEFAULT_REAL_ESTATE_OPTIONS.length > 0 && !form.getValues("realEstate")) {
             form.setValue("realEstate", "platform"); 
        }
    }
  }, [form, toast]);


  useEffect(() => {
    if (parsedExcelData && selectedMetric) {
      const filteredByMetric = parsedExcelData.filter(row => row.metric === selectedMetric);
      const uniqueRealEstates = Array.from(new Set(filteredByMetric.map(row => row.realEstate).filter(Boolean) as string[]));
      setAvailableRealEstates(uniqueRealEstates.length > 0 ? uniqueRealEstates : DEFAULT_REAL_ESTATE_OPTIONS);
      
      const currentFormRealEstate = form.getValues("realEstate");
      if (uniqueRealEstates.length > 0) {
        if (!uniqueRealEstates.includes(currentFormRealEstate) && currentFormRealEstate !== 'platform') { 
          form.setValue("realEstate", uniqueRealEstates[0]);
        } else if (!currentFormRealEstate && !uniqueRealEstates.includes('platform')) { 
            form.setValue("realEstate", uniqueRealEstates[0]);
        } else if (!currentFormRealEstate && uniqueRealEstates.includes('platform')) {
             form.setValue("realEstate", 'platform');
        }
      } else if (DEFAULT_REAL_ESTATE_OPTIONS.length > 0 && !parsedExcelData?.length) { 
          form.setValue("realEstate", form.getValues("realEstate") || "platform");
      }
    } else if (!parsedExcelData) {
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
         if (DEFAULT_REAL_ESTATE_OPTIONS.length > 0 && !form.getValues("realEstate")) {
            form.setValue("realEstate", "platform");
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
        row.lookbackDays == targetExperimentDuration 
      );

      if (matchedRow) {
        const meanVal = parseFloat(String(matchedRow.mean));
        const varianceVal = parseFloat(String(matchedRow.variance));
        const totalUsersVal = matchedRow.totalUsers ? parseInt(String(matchedRow.totalUsers), 10) : NaN;
        
        if (form.getValues("mean") !== meanVal && !(isNaN(form.getValues("mean")) && isNaN(meanVal))) {
            form.setValue("mean", isNaN(meanVal) ? NaN : meanVal, { shouldValidate: true });
            valuesActuallyChangedByAutofill = true;
        }
        if (form.getValues("variance") !== varianceVal && !(isNaN(form.getValues("variance")) && isNaN(varianceVal))) {
            form.setValue("variance", isNaN(varianceVal) ? NaN : varianceVal, { shouldValidate: true });
             valuesActuallyChangedByAutofill = true;
        }

        const currentTotalUsersInForm = form.getValues("totalUsersInSelectedDuration");
        if (totalUsersVal !== currentTotalUsersInForm && !(isNaN(totalUsersVal) && isNaN(currentTotalUsersInForm ?? NaN))) {
            form.setValue("totalUsersInSelectedDuration", isNaN(totalUsersVal) ? NaN : totalUsersVal, { shouldValidate: true });
            valuesActuallyChangedByAutofill = true;
        }

        form.setValue("lookbackDays", matchedRow.lookbackDays || targetExperimentDuration, { shouldValidate: true }); 
        
        setIsDataFromExcel(true); 
        setIsHistoricalFieldReadOnly(true);
        if (isUserDrivenSelectorChange && valuesActuallyChangedByAutofill) {
            onResults(null); 
        }
      } else { 
        if(isDataFromExcel || isUserDrivenSelectorChange){ 
            form.setValue("mean", NaN);
            form.setValue("variance", NaN);
            form.setValue("totalUsersInSelectedDuration", NaN);
            form.setValue("lookbackDays", targetExperimentDuration); 
            setIsDataFromExcel(false); 
            setIsHistoricalFieldReadOnly(false);
        }
        if (isUserDrivenSelectorChange && parsedExcelData.length > 0) { 
            onResults(null);
        }
      }
    } else if (!parsedExcelData && isUserDrivenSelectorChange) { 
        if(isDataFromExcel) { 
            form.setValue("mean", NaN);
            form.setValue("variance", NaN);
            form.setValue("totalUsersInSelectedDuration", NaN);
            setIsDataFromExcel(false);
            setIsHistoricalFieldReadOnly(false);
            onResults(null);
        }
    }
    
    prevSelectedMetricRef.current = selectedMetric;
    prevSelectedRealEstateRef.current = selectedRealEstate;
    prevTargetExperimentDurationRef.current = targetExperimentDuration;

  }, [parsedExcelData, selectedMetric, selectedRealEstate, targetExperimentDuration, form, onResults, isDataFromExcel]);


  useEffect(() => {
    if (selectedMetricType === "Binary" && !isNaN(currentMean) && currentMean >= 0 && currentMean <= 1) {
      if (!isHistoricalFieldReadOnly) { 
        const calculatedVariance = currentMean * (1 - currentMean);
        form.setValue("variance", parseFloat(calculatedVariance.toFixed(6)), { shouldValidate: true });
      }
    }
  }, [selectedMetricType, currentMean, form, isHistoricalFieldReadOnly]); 


  async function onSubmit(values: MdeToSampleSizeFormValues) {
    setIsLoading(true);
    onResults(null); 
    try {
      const result = await calculateSampleSizeAction(values);
      onResults(result);

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
  
  const isVarianceReadOnlyForBinary = selectedMetricType === "Binary" && !isNaN(currentMean) && currentMean >= 0 && currentMean <= 1 && !isHistoricalFieldReadOnly;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
            <CardTitle className="font-headline text-2xl">MDE to Sample Size</CardTitle>
             <p className="text-muted-foreground text-xs mt-1">
                {uploadedFileName 
                    ? `Using data from "${uploadedFileName}".` 
                    : 'Enter parameters or upload a data file via "Upload & Map Data" for auto-fill.'}
            </p>
        </div>
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                    <SettingsIcon className="h-5 w-5" />
                    <span className="sr-only">Open Statistical Settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Advanced Statistical Settings</DialogTitle>
                    <p className="text-xs text-muted-foreground">
                        Adjust statistical power and significance level (alpha).
                    </p>
                </DialogHeader>
                <FormProvider {...form}> {/* Context for Dialog form fields */}
                  <div className="grid gap-4 py-4">
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
                </FormProvider>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" onClick={() => setIsSettingsDialogOpen(false)}>Done</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Form {...form}> {/* Outer FormProvider */}
          <FormProvider {...form}> {/* Inner FormProvider to reinforce context */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <Separator />
              <p className="text-sm font-medium text-foreground">Experiment Configuration</p>
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
                          <SelectTrigger><SelectValue placeholder={parsedExcelData ? "Select Metric" : "Select a metric"} /></SelectTrigger>
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
                          <SelectTrigger><SelectValue placeholder={parsedExcelData ? "Select Real Estate" : "Select real estate"} /></SelectTrigger>
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
                      <Select onValueChange={(value) => { field.onChange(value); onResults(null); setIsHistoricalFieldReadOnly(false); form.setValue('variance', NaN); }} value={field.value}>
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
                        <Input type="number" placeholder="e.g., 0.5 for 0.5%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any"/>
                      </FormControl>
                      <FormDescription className="text-xs">Enter as a percentage, e.g., 0.5 for 0.5%.</FormDescription>
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
                  name="numberOfVariants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Variants</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 2" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} />
                      </FormControl>
                      <FormDescription className="text-xs">Total variants including control (min 2).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Separator />
              <p className="text-sm font-medium text-foreground">
                  Historical Data {isHistoricalFieldReadOnly ? `(auto-filled)` : `(manual input)`}
              </p>
              {isHistoricalFieldReadOnly && (
                <div className="text-xs p-2 rounded-md bg-accent/10 text-accent">
                  Using data from your file for {targetExperimentDuration || form.getValues("lookbackDays")} days lookback. Mean, Variance, and Total Users for Duration also auto-filled.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="mean"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mean (Historical)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder={selectedMetricType === 'Binary' ? "e.g., 0.1 for 10%" : "e.g., 150"} {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isHistoricalFieldReadOnly) {setIsHistoricalFieldReadOnly(false);}}} step="any" readOnly={isHistoricalFieldReadOnly} />
                      </FormControl>
                      {!isHistoricalFieldReadOnly && <FormDescription className="text-xs">{selectedMetricType === 'Binary' ? "Proportion (0-1)." : "Average value."}</FormDescription>}
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
                        <Input type="number" placeholder="e.g., 0.1275" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isHistoricalFieldReadOnly) {setIsHistoricalFieldReadOnly(false);}}} step="any" readOnly={isHistoricalFieldReadOnly || isVarianceReadOnlyForBinary} />
                      </FormControl>
                      {!isHistoricalFieldReadOnly && (isVarianceReadOnlyForBinary ? 
                          <FormDescription className="text-xs text-primary">Auto-calculated (p*(1-p))</FormDescription> :
                          <FormDescription className="text-xs">Enter metric variance.</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="totalUsersInSelectedDuration"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>
                            Total Users for Target Duration ({targetExperimentDuration || 'N/A'} days)
                          </FormLabel>
                          <FormControl>
                          <Input 
                              type="number" 
                              placeholder="e.g., 70000" 
                              {...field} 
                              value={isNaN(field.value ?? NaN) ? '' : field.value}
                              onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isHistoricalFieldReadOnly) {setIsHistoricalFieldReadOnly(false);}}}
                              readOnly={isHistoricalFieldReadOnly} 
                          />
                          </FormControl>
                          {!isHistoricalFieldReadOnly && 
                              <FormDescription className="text-xs">Enter total unique users for your target experiment duration.</FormDescription>
                          }
                          {isHistoricalFieldReadOnly && 
                              <FormDescription className="text-xs">For the selected {targetExperimentDuration}-day duration.</FormDescription>
                          }
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
      </CardContent>
    </Card>
  );
}

export function MdeToSampleSizeResultsDisplay({ results }: { results: MdeToSampleSizeCalculationResults | null }) {
  if (!results) {
    return null;
  }
  
  const shouldShowCard = results.requiredSampleSizePerVariant !== undefined;

  if (!shouldShowCard && (!results.warnings || results.warnings.length === 0) ) {
     return null; 
  }
  
  const onlyShowWarnings = results.requiredSampleSizePerVariant === undefined && results.warnings && results.warnings.length > 0;

  const totalUsersForDisplay = results.totalUsersInSelectedDuration && results.totalUsersInSelectedDuration > 0 ? results.totalUsersInSelectedDuration : 0;
  const totalRequiredSampleSize = results.requiredSampleSizePerVariant && results.numberOfVariants ? results.requiredSampleSizePerVariant * results.numberOfVariants : undefined;


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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6 text-sm mb-6">
                <div>
                    <p className="font-medium text-muted-foreground">Required Sample Size (per variant)</p>
                    <p className="text-2xl font-semibold text-primary">{results.requiredSampleSizePerVariant?.toLocaleString() || 'N/A'}</p>
                </div>
                {results.numberOfVariants && totalRequiredSampleSize !== undefined && (
                    <div>
                        <p className="font-medium text-muted-foreground">Total Required Sample Size</p>
                        <p className="text-2xl font-semibold text-primary">{totalRequiredSampleSize.toLocaleString()}</p>
                    </div>
                )}
                 {results.exposureNeededPercentage !== undefined && results.targetExperimentDurationDays && totalUsersForDisplay > 0 && (
                    <div>
                        <p className="font-medium text-muted-foreground">Exposure Needed for {results.targetExperimentDurationDays} days</p>
                        <p className="text-2xl font-semibold text-primary">
                            {results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? `${results.exposureNeededPercentage.toFixed(1)}%` : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">(Based on {Math.round(totalUsersForDisplay).toLocaleString()} total users available over {results.targetExperimentDurationDays} days)</p>
                    </div>
                )}
                {results.exposureNeededPercentage === undefined && totalUsersForDisplay <= 0 && results.targetExperimentDurationDays && (
                     <div>
                        <p className="font-medium text-muted-foreground">Exposure Needed</p>
                        <p className="text-lg font-semibold text-destructive">Cannot calculate exposure without total users for the duration.</p>
                    </div>
                )}
            </div>
        )}
        
      </CardContent>
    </Card>
  );
}

