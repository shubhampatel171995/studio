
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
  FixedDurationCalculatorFormSchema, 
  type FixedDurationCalculatorFormValues, 
  type FixedDurationCalculatorResults,
  type ExcelDataRow,
} from "@/lib/types";
import { calculateFixedDurationParametersAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect, useRef } from "react";
import { Loader2, SettingsIcon, AlertTriangle, Download, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL, 
  METRIC_TYPE_OPTIONS,
} from "@/lib/constants";
import { defaultAbalyticsData } from "@/lib/default-data"; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FixedDurationCalculatorFormProps {
  onResults: (results: FixedDurationCalculatorResults | null) => void;
  onDownload: () => void; 
  currentResults: FixedDurationCalculatorResults | null;
}

export function FixedDurationCalculatorForm({ onResults, onDownload, currentResults }: FixedDurationCalculatorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState<ExcelDataRow[] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([]);
  const [availableRealEstates, setAvailableRealEstates] = useState<string[]>([]);
  const [isHistoricalFieldReadOnly, setIsHistoricalFieldReadOnly] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeInputField, setActiveInputField] = useState<'mde' | 'sampleSize' | null>(null);


  const { toast } = useToast();

  const form = useForm<FixedDurationCalculatorFormValues>({
    resolver: zodResolver(FixedDurationCalculatorFormSchema),
    defaultValues: {
      metric: '',
      metricType: METRIC_TYPE_OPTIONS[1], 
      mean: NaN, 
      variance: NaN, 
      realEstate: '',
      minimumDetectableEffect: undefined, 
      sampleSizePerVariant: undefined, 
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      targetExperimentDurationDays: 14,
      totalUsersInSelectedDuration: NaN,
      numberOfVariants: 2,
    },
  });

  const selectedMetric = form.watch("metric");
  const selectedRealEstate = form.watch("realEstate");
  const selectedMetricType = form.watch("metricType");
  const currentMean = form.watch("mean");
  const targetExperimentDuration = form.watch("targetExperimentDurationDays");

  const mdeValue = form.watch("minimumDetectableEffect");
  const sampleSizeValue = form.watch("sampleSizePerVariant");

  const prevSelectedMetricRef = useRef<string | undefined>();
  const prevSelectedRealEstateRef = useRef<string | undefined>();
  const prevTargetExperimentDurationRef = useRef<number | undefined>();


  useEffect(() => {
    const storedDataString = localStorage.getItem('abalyticsMappedData');
    const storedFileName = localStorage.getItem('abalyticsFileName');
    let dataToUse: ExcelDataRow[];
    let sourceName: string | null = null;

    if (storedDataString && storedFileName) {
      try {
        dataToUse = JSON.parse(storedDataString);
        sourceName = storedFileName;
      } catch (e) {
        console.error("Failed to parse stored data, using default:", e);
        dataToUse = defaultAbalyticsData;
        sourceName = "Default Dataset";
        localStorage.removeItem('abalyticsMappedData');
        localStorage.removeItem('abalyticsFileName');
      }
    } else {
      dataToUse = defaultAbalyticsData;
      sourceName = "Default Dataset";
    }
    
    setParsedExcelData(dataToUse);
    setUploadedFileName(sourceName);
    
    const uniqueMetrics = Array.from(new Set(dataToUse.map(row => row.metric).filter(Boolean) as string[]));
    setAvailableMetrics(uniqueMetrics);
    if (uniqueMetrics.length > 0 && !form.getValues("metric")) {
        form.setValue("metric", uniqueMetrics[0]);
    }
     if (uniqueMetrics.length === 0) { // Should not happen with default data
        form.resetField("metric");
        setAvailableRealEstates([]);
        form.resetField("realEstate");
    }
  }, [form]);


  useEffect(() => {
    if (parsedExcelData && selectedMetric) {
      const filteredByMetric = parsedExcelData.filter(row => row.metric === selectedMetric);
      const uniqueRealEstates = Array.from(new Set(filteredByMetric.map(row => row.realEstate).filter(Boolean) as string[]));
      setAvailableRealEstates(uniqueRealEstates);
      
      const currentFormRealEstate = form.getValues("realEstate");
      if (uniqueRealEstates.length > 0) {
        if (!uniqueRealEstates.includes(currentFormRealEstate) && currentFormRealEstate !== 'platform') { 
          form.setValue("realEstate", uniqueRealEstates[0]);
        } else if (!form.getValues("realEstate") && uniqueRealEstates.length > 0) {
           form.setValue("realEstate", uniqueRealEstates[0]);
        }
      } else {
         form.resetField("realEstate");
      }
    } else if (!selectedMetric) {
        setAvailableRealEstates([]);
        form.resetField("realEstate");
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
        const metricTypeVal = matchedRow.metricType || METRIC_TYPE_OPTIONS[1];
        
        if (form.getValues("mean") !== meanVal && !(isNaN(form.getValues("mean")) && isNaN(meanVal))) {
            form.setValue("mean", isNaN(meanVal) ? NaN : meanVal, { shouldValidate: true });
            valuesActuallyChangedByAutofill = true;
        }
        if (form.getValues("variance") !== varianceVal && !(isNaN(form.getValues("variance")) && isNaN(varianceVal))) {
            form.setValue("variance", isNaN(varianceVal) ? NaN : varianceVal, { shouldValidate: true });
             valuesActuallyChangedByAutofill = true;
        }
        if (form.getValues("metricType") !== metricTypeVal) {
            form.setValue("metricType", metricTypeVal, {shouldValidate: true});
            valuesActuallyChangedByAutofill = true;
        }

        const currentTotalUsersInForm = form.getValues("totalUsersInSelectedDuration");
        if (totalUsersVal !== currentTotalUsersInForm && !(isNaN(totalUsersVal) && isNaN(currentTotalUsersInForm ?? NaN))) {
            form.setValue("totalUsersInSelectedDuration", isNaN(totalUsersVal) ? NaN : totalUsersVal, { shouldValidate: true });
            valuesActuallyChangedByAutofill = true;
        }
        
        setIsHistoricalFieldReadOnly(true);
        if (isUserDrivenSelectorChange && valuesActuallyChangedByAutofill) {
            onResults(null); 
        }
      } else { 
        if(isHistoricalFieldReadOnly || isUserDrivenSelectorChange){ 
            form.setValue("mean", NaN);
            form.setValue("variance", NaN);
            form.setValue("totalUsersInSelectedDuration", NaN);
            // Do not reset metricType here, it should be user-selectable or derived, not blanked
            setIsHistoricalFieldReadOnly(false); 
        }
        if (isUserDrivenSelectorChange && parsedExcelData.length > 0) { 
            onResults(null);
        }
      }
    } else if ((!parsedExcelData || parsedExcelData.length === 0) && isUserDrivenSelectorChange) { 
        if(isHistoricalFieldReadOnly) { 
            form.setValue("mean", NaN);
            form.setValue("variance", NaN);
            form.setValue("totalUsersInSelectedDuration", NaN);
            setIsHistoricalFieldReadOnly(false);
            onResults(null);
        }
    }
    
    prevSelectedMetricRef.current = selectedMetric;
    prevSelectedRealEstateRef.current = selectedRealEstate;
    prevTargetExperimentDurationRef.current = targetExperimentDuration;

  }, [parsedExcelData, selectedMetric, selectedRealEstate, targetExperimentDuration, form, onResults, isHistoricalFieldReadOnly]);


  useEffect(() => {
    if (selectedMetricType === "Binary" && !isNaN(currentMean) && currentMean >= 0 && currentMean <= 1) {
      if (!isHistoricalFieldReadOnly) { 
        const calculatedVariance = currentMean * (1 - currentMean);
        form.setValue("variance", parseFloat(calculatedVariance.toFixed(6)), { shouldValidate: true });
      }
    }
  }, [selectedMetricType, currentMean, form, isHistoricalFieldReadOnly]); 


  const handleMdeFocus = () => setActiveInputField('mde');
  const handleSampleSizeFocus = () => setActiveInputField('sampleSize');

  const handleMdeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    form.setValue("minimumDetectableEffect", value === "" ? undefined : Number(value), {shouldValidate: true});
    if (value !== "" && activeInputField === 'mde') {
      form.setValue("sampleSizePerVariant", undefined, {shouldValidate: false}); 
    }
    onResults(null);
  };

  const handleSampleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    form.setValue("sampleSizePerVariant", value === "" ? undefined : Number(value), {shouldValidate: true});
    if (value !== "" && activeInputField === 'sampleSize') {
      form.setValue("minimumDetectableEffect", undefined, {shouldValidate: false}); 
    }
    onResults(null);
  };


  async function onSubmit(values: FixedDurationCalculatorFormValues) {
    setIsLoading(true);
    onResults(null); 
    
    let submissionValues = { ...values };
    if (activeInputField === 'mde' && values.minimumDetectableEffect && values.minimumDetectableEffect > 0) {
        submissionValues.sampleSizePerVariant = undefined;
    } else if (activeInputField === 'sampleSize' && values.sampleSizePerVariant && values.sampleSizePerVariant > 0) {
        submissionValues.minimumDetectableEffect = undefined;
    } else if (values.minimumDetectableEffect && values.minimumDetectableEffect > 0) { 
        submissionValues.sampleSizePerVariant = undefined;
    } else if (values.sampleSizePerVariant && values.sampleSizePerVariant > 0) {
        submissionValues.minimumDetectableEffect = undefined;
    }


    try {
      const result = await calculateFixedDurationParametersAction(submissionValues);
      onResults(result);

      if (result.calculatedMde !== undefined || result.calculatedSampleSizePerVariant !== undefined) {
        toast({
            title: "Calculation Complete",
            description: result.calculationMode === 'ssToMde' ? "Achievable MDE calculated." : "Required sample size calculated.",
        });
      } else if (result.warnings && result.warnings.length > 0) {
        const errorWarning = result.warnings.find(w => w.startsWith("Error:"));
        toast({
            title: errorWarning ? "Calculation Error" : "Calculation Notice",
            description: errorWarning || result.warnings.join(' ').replace(/_/g, ' ') || "Could not complete calculation. Check inputs.",
            variant: errorWarning ? "destructive" : "default",
        });
      } else {
         toast({
            variant: "destructive",
            title: "Calculation Failed",
            description: "Could not determine output. Please check inputs and try again.",
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

  const calculationTarget = 
    (activeInputField === 'mde' && mdeValue && mdeValue > 0) || (!activeInputField && mdeValue && mdeValue > 0  && (!sampleSizeValue || sampleSizeValue <=0))? "Sample Size" :
    (activeInputField === 'sampleSize' && sampleSizeValue && sampleSizeValue > 0) || (!activeInputField && sampleSizeValue && sampleSizeValue > 0 && (!mdeValue || mdeValue <=0)) ? "MDE" :
    "Output";

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
            <CardTitle className="font-headline text-2xl">Fixed Duration Calculator</CardTitle>
             <CardDescription className="text-xs mt-1">
                {uploadedFileName === "Default Dataset" ? 'Using Default Dataset. Upload your own via "Upload & Map Data" for custom auto-fill.' : `Using data from: ${uploadedFileName}. Select Metric, Real Estate, and Exp Duration to auto-fill.`}
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
                                <Input type="number" placeholder="e.g., 0.8 for 80%" {...field} value={isNaN(field.value ?? NaN) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
                                <Input type="number" placeholder="e.g., 0.05 for 5%" {...field} value={isNaN(field.value ?? NaN) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
        <Form {...form}>
          <FormProvider {...form}> 
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <Separator />
              <p className="text-sm font-medium text-foreground">Experiment Configuration</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="metric" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metric</FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); onResults(null);}} value={field.value} disabled={!availableMetrics.length}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select Metric" /></SelectTrigger></FormControl>
                        <SelectContent>{availableMetrics.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>)} />
                <FormField control={form.control} name="realEstate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Real Estate</FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); onResults(null); }} value={field.value} disabled={!selectedMetric || !availableRealEstates.length}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select Real Estate" /></SelectTrigger></FormControl>
                        <SelectContent>{availableRealEstates.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>)} />
                 <FormField control={form.control} name="metricType" render={({ field }) => (
                  <FormItem>
                      <FormLabel>Metric Type</FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); onResults(null); setIsHistoricalFieldReadOnly(false); form.setValue('variance', NaN); }} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select metric type" /></SelectTrigger></FormControl>
                      <SelectContent>{METRIC_TYPE_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormDescription className="text-xs">{isHistoricalFieldReadOnly ? "Auto-filled from data" : "Select manually"}</FormDescription>
                      <FormMessage />
                  </FormItem>)} />
                <FormField control={form.control} name="targetExperimentDurationDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exp Duration (Days)</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 14" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} /></FormControl>
                      <FormDescription className="text-xs">Drives historical data lookup.</FormDescription>
                      <FormMessage />
                    </FormItem>)} />
                 <FormField control={form.control} name="numberOfVariants" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Variants</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 2" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} /></FormControl>
                      <FormDescription className="text-xs">Incl. control (min 2).</FormDescription>
                      <FormMessage />
                    </FormItem>)} />
              </div>
              
              <Separator />
              <p className="text-sm font-medium text-foreground">
                  Historical Data {isHistoricalFieldReadOnly ? `(auto-filled for ${targetExperimentDuration || form.getValues("targetExperimentDurationDays")} days)` : `(manual input)`}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="mean" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mean (Historical)</FormLabel>
                      <FormControl><Input type="number" placeholder={selectedMetricType === 'Binary' ? "e.g., 0.1 for 10%" : "e.g., 150"} {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isHistoricalFieldReadOnly) {setIsHistoricalFieldReadOnly(false);}}} step="any" readOnly={isHistoricalFieldReadOnly} /></FormControl>
                      {!isHistoricalFieldReadOnly && <FormDescription className="text-xs">{selectedMetricType === 'Binary' ? "Proportion (0-1)." : "Average value."}</FormDescription>}
                      <FormMessage />
                    </FormItem>)} />
                <FormField control={form.control} name="variance" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Variance (Historical)</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 0.1275" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isHistoricalFieldReadOnly) {setIsHistoricalFieldReadOnly(false);}}} step="any" readOnly={isHistoricalFieldReadOnly || isVarianceReadOnlyForBinary} /></FormControl>
                      {!isHistoricalFieldReadOnly && (isVarianceReadOnlyForBinary ? 
                          <FormDescription className="text-xs text-primary">Auto-calculated (p*(1-p))</FormDescription> :
                          <FormDescription className="text-xs">Enter metric variance.</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>)} />
                 <FormField control={form.control} name="totalUsersInSelectedDuration" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Total Users ({targetExperimentDuration || 'N/A'} Days)</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 70000" {...field} value={isNaN(field.value ?? NaN) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if(isHistoricalFieldReadOnly) {setIsHistoricalFieldReadOnly(false);}}} readOnly={isHistoricalFieldReadOnly} /></FormControl>
                          {!isHistoricalFieldReadOnly && <FormDescription className="text-xs">Total unique users for duration.</FormDescription>}
                          <FormMessage />
                      </FormItem>)} />
              </div>

              <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Info size={16} className="text-primary" />
                    <span>Enter either MDE (%) or Sample Size to calculate the other.</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="minimumDetectableEffect"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>MDE (%) <span className="text-xs text-muted-foreground">(Input or Output)</span></FormLabel>
                            <FormControl>
                            <Input 
                                type="number" 
                                placeholder="e.g., 0.5 for 0.5%" 
                                {...field} 
                                value={field.value === undefined ? '' : field.value}
                                onFocus={handleMdeFocus}
                                onChange={handleMdeChange}
                                step="any"
                                className={cn(activeInputField === 'sampleSize' && field.value === undefined && "bg-muted/50", activeInputField === 'mde' && "border-primary ring-1 ring-primary")}
                            />
                            </FormControl>
                            <FormDescription className="text-xs">Desired minimum change to detect.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="sampleSizePerVariant"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Sample Size (per variant) <span className="text-xs text-muted-foreground">(Input or Output)</span></FormLabel>
                            <FormControl>
                            <Input 
                                type="number" 
                                placeholder="e.g., 50000" 
                                {...field} 
                                value={field.value === undefined ? '' : field.value}
                                onFocus={handleSampleSizeFocus}
                                onChange={handleSampleSizeChange}
                                className={cn(activeInputField === 'mde' && field.value === undefined && "bg-muted/50", activeInputField === 'sampleSize' && "border-primary ring-1 ring-primary")}
                            />
                            </FormControl>
                            <FormDescription className="text-xs">Available users per variant.</FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button type="submit" disabled={isLoading || (!mdeValue && !sampleSizeValue)} className="w-full sm:w-auto">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Calculate {calculationTarget}
                </Button>
                 {currentResults && (
                    <Button type="button" variant="outline" onClick={onDownload} className="w-full sm:w-auto" disabled={isLoading}>
                        <Download className="mr-2 h-4 w-4" /> Download Report
                    </Button>
                )}
              </div>
            </form>
          </FormProvider>
        </Form>
      </CardContent>
    </Card>
  );
}


// Results Display Component
interface FixedDurationCalculatorResultsDisplayProps {
  results: FixedDurationCalculatorResults;
}

export function FixedDurationCalculatorResultsDisplay({ results }: FixedDurationCalculatorResultsDisplayProps) {
  const { inputs, calculationMode, calculatedMde, calculatedSampleSizePerVariant, totalCalculatedSampleSizeForExperiment, exposureNeededPercentage, warnings, confidenceLevel, powerLevel } = results;

  const showResultsCard = calculatedMde !== undefined || calculatedSampleSizePerVariant !== undefined;
  const onlyShowWarnings = !showResultsCard && warnings && warnings.length > 0;

  if (!showResultsCard && !onlyShowWarnings) {
    return null; 
  }

  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Fixed Duration Calculator Results</CardTitle>
        <CardDescription>
          Calculated {calculationMode === 'ssToMde' ? 'Achievable MDE' : 'Required Sample Size'} based on your inputs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {onlyShowWarnings && warnings && (
             <div className="mt-4">
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

        {showResultsCard && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6 text-sm mb-6">
            {calculationMode === 'ssToMde' && calculatedMde !== undefined && (
              <div>
                <p className="font-medium text-muted-foreground">Calculated Achievable MDE (%)</p>
                <p className="text-2xl font-semibold text-primary">{calculatedMde.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">Input Sample Size: {inputs.sampleSizePerVariant?.toLocaleString()}</p>
              </div>
            )}
            {calculationMode === 'mdeToSs' && calculatedSampleSizePerVariant !== undefined && (
              <div>
                <p className="font-medium text-muted-foreground">Calculated Sample Size (per variant)</p>
                <p className="text-2xl font-semibold text-primary">{calculatedSampleSizePerVariant.toLocaleString()}</p>
                 {totalCalculatedSampleSizeForExperiment !== undefined && (
                    <p className="text-xs text-muted-foreground">Total for {inputs.numberOfVariants} variants: {totalCalculatedSampleSizeForExperiment.toLocaleString()}</p>
                 )}
                <p className="text-xs text-muted-foreground">Input MDE: {inputs.minimumDetectableEffect?.toFixed(2)}%</p>
              </div>
            )}
            
            {exposureNeededPercentage !== undefined && inputs.targetExperimentDurationDays && inputs.totalUsersInSelectedDuration && inputs.totalUsersInSelectedDuration > 0 && (
                <div>
                    <p className="font-medium text-muted-foreground">Exposure Needed for {inputs.targetExperimentDurationDays} days</p>
                    <p className="text-2xl font-semibold text-primary">
                        {exposureNeededPercentage >=0 && exposureNeededPercentage <= 1000 ? `${exposureNeededPercentage.toFixed(1)}%` : exposureNeededPercentage > 1000 ? '>1000%' : 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">(Based on {Math.round(inputs.totalUsersInSelectedDuration).toLocaleString()} total users)</p>
                </div>
            )}
             {exposureNeededPercentage === undefined && inputs.totalUsersInSelectedDuration && inputs.totalUsersInSelectedDuration <= 0 && (
                <div>
                    <p className="font-medium text-muted-foreground">Exposure Needed</p>
                    <p className="text-lg font-semibold text-destructive">Cannot calculate exposure with zero total users.</p>
                </div>
            )}
          </div>
        )}
        
        {showResultsCard && warnings && warnings.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="font-medium text-lg flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Notices from Calculation
            </h3>
            <ul className="list-disc list-inside space-y-1 pl-2 text-destructive bg-destructive/10 p-3 rounded-md">
              {warnings.map((warning, index) => (
                <li key={index} className="text-sm">{warning.replace(/_/g, ' ')}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

