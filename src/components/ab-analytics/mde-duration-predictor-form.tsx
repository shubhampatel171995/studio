
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
  type SampleSizeToMdeFormValues, 
} from "@/lib/types";
import { calculateSampleSizeAction, calculateMdeFromSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect } from "react";
import { Loader2, SettingsIcon, Download, AlertTriangle, Info } from "lucide-react"; 
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  METRIC_OPTIONS as DEFAULT_METRIC_OPTIONS, 
  REAL_ESTATE_OPTIONS as DEFAULT_REAL_ESTATE_OPTIONS, 
  DEFAULT_STATISTICAL_POWER, 
  DEFAULT_SIGNIFICANCE_LEVEL, 
  METRIC_TYPE_OPTIONS,
  PREDICTION_DURATIONS,
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
  const [activeInputField, setActiveInputField] = useState<'mde' | 'sampleSize' | null>(null);


  const { toast } = useToast();

  const form = useForm<MdeDurationPredictorFormValues>({
    resolver: zodResolver(MdeDurationPredictorFormSchema),
    defaultValues: {
      metric: '',
      realEstate: 'platform',
      metricType: METRIC_TYPE_OPTIONS[1], 
      minimumDetectableEffect: undefined, 
      sampleSizePerVariant: undefined,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      numberOfVariants: 2,
    },
  });

  const selectedMetric = form.watch("metric");
  const mdeValue = form.watch("minimumDetectableEffect");
  const sampleSizeValue = form.watch("sampleSizePerVariant");

  useEffect(() => {
    const storedData = localStorage.getItem('abalyticsMappedData');
    const storedFileName = localStorage.getItem('abalyticsFileName');
    if (storedData) {
      try {
        const data: ExcelDataRow[] = JSON.parse(storedData);
        setParsedExcelData(data);
        setUploadedFileName(storedFileName || null);

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

  async function onSubmit(values: MdeDurationPredictorFormValues) {
    if (!parsedExcelData || parsedExcelData.length === 0) {
        toast({
            variant: "destructive",
            title: "No Data Uploaded",
            description: "Please upload an Excel file with historical data using the 'Upload & Map Data' button.",
        });
        onResults(null);
        return;
    }

    setIsLoading(true);
    onResults(null);
    const aggregatedResults: MdeDurationPredictorResultRow[] = [];
    let allCalculationWarnings: string[] = []; 

    const calculationMode: 'mdeToSs' | 'ssToMde' = 
        (values.minimumDetectableEffect && values.minimumDetectableEffect > 0) ? 'mdeToSs' :
        (values.sampleSizePerVariant && values.sampleSizePerVariant > 0) ? 'ssToMde' :
        'mdeToSs'; // Default if somehow both are invalid after schema validation

    for (const duration of PREDICTION_DURATIONS) {
      let meanForCalc: number | undefined = undefined;
      let varianceForCalc: number | undefined = undefined;
      let totalUsersForDuration: number | undefined = undefined;
      let rowSpecificWarnings: string[] = [];

      const matchedRow = parsedExcelData.find(row => 
        row.metric === values.metric &&
        row.realEstate === values.realEstate &&
        row.lookbackDays == duration && 
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
      
      let rowResult: Partial<MdeDurationPredictorResultRow> = { duration, calculationMode, totalUsersAvailable: totalUsersForDuration };

      if (meanForCalc !== undefined && varianceForCalc !== undefined) {
        try {
          if (calculationMode === 'mdeToSs' && values.minimumDetectableEffect) {
            const actionInput = {
              metric: values.metric, 
              metricType: values.metricType,
              mean: meanForCalc,
              variance: varianceForCalc,
              minimumDetectableEffect: values.minimumDetectableEffect, 
              statisticalPower: values.statisticalPower,
              significanceLevel: values.significanceLevel,
              numberOfVariants: values.numberOfVariants,
              realEstate: values.realEstate, 
              targetExperimentDurationDays: duration,
              totalUsersInSelectedDuration: totalUsersForDuration,
            };
            const result = await calculateSampleSizeAction(actionInput as any); // Cast as any to bypass type mismatch until types are fully aligned
            rowResult.totalRequiredSampleSize = result.requiredSampleSizePerVariant && values.numberOfVariants ? result.requiredSampleSizePerVariant * values.numberOfVariants : undefined;
            rowResult.exposureNeededPercentage = result.exposureNeededPercentage;
            if (result.warnings) {
                rowSpecificWarnings.push(...result.warnings);
                allCalculationWarnings.push(...result.warnings.map(w => `${duration}-day: ${w.replace(/_/g, ' ')}`));
            }
          } else if (calculationMode === 'ssToMde' && values.sampleSizePerVariant) {
             const actionInput: SampleSizeToMdeFormValues = {
                metric: values.metric,
                metricType: values.metricType,
                mean: meanForCalc,
                variance: varianceForCalc,
                sampleSizePerVariant: values.sampleSizePerVariant,
                statisticalPower: values.statisticalPower,
                significanceLevel: values.significanceLevel,
                numberOfVariants: values.numberOfVariants,
                realEstate: values.realEstate,
                targetExperimentDurationDays: duration, 
                totalUsersInSelectedDuration: totalUsersForDuration, 
             };
             const result = await calculateMdeFromSampleSizeAction(actionInput);
             rowResult.achievableMde = result.achievableMde;
             rowResult.exposureNeededPercentage = result.exposureNeededPercentage;
             if (result.warnings) {
                rowSpecificWarnings.push(...result.warnings);
                allCalculationWarnings.push(...result.warnings.map(w => `${duration}-day: ${w.replace(/_/g, ' ')}`));
            }
          }
        } catch (error) {
          console.error(`Error calculating for duration ${duration}:`, error);
          const errorMsg = `Calculation_error_for_${duration}-day:_${error instanceof Error ? error.message : 'Unknown_error'}`;
          rowSpecificWarnings.push(errorMsg);
          allCalculationWarnings.push(errorMsg.replace(/_/g, ' '));
          if (calculationMode === 'mdeToSs') rowResult.totalRequiredSampleSize = 'Error';
          else rowResult.achievableMde = 'Error';
          rowResult.exposureNeededPercentage = 'Error';
        }
      } else { 
          if (calculationMode === 'mdeToSs') rowResult.totalRequiredSampleSize = 'N/A';
          else rowResult.achievableMde = 'N/A';
          rowResult.exposureNeededPercentage = 'N/A';
      }
      rowResult.warnings = rowSpecificWarnings.length > 0 ? Array.from(new Set(rowSpecificWarnings)) : undefined;
      aggregatedResults.push(rowResult as MdeDurationPredictorResultRow);
    }
    onResults(aggregatedResults);
    setIsLoading(false);
    
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
  
  const calculationTarget = 
    (activeInputField === 'mde' && mdeValue && mdeValue > 0) || (!activeInputField && mdeValue && mdeValue > 0  && (!sampleSizeValue || sampleSizeValue <=0))? "Sample Size" :
    (activeInputField === 'sampleSize' && sampleSizeValue && sampleSizeValue > 0) || (!activeInputField && sampleSizeValue && sampleSizeValue > 0 && (!mdeValue || mdeValue <=0)) ? "Achievable MDE" :
    "Output";


  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="font-headline text-2xl">Dynamic Duration Calculator</CardTitle>
          <CardDescription>
            Predict {calculationTarget === 'Sample Size' ? 'sample size' : 'achievable MDE'} needed across different durations.
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
                 <FormField control={form.control} name="numberOfVariants" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Variants</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 2" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => { field.onChange(Number(e.target.value)); clearResultsOnInputChange(); }} /></FormControl>
                    <FormDescription className="text-xs">Incl. control (min 2).</FormDescription>
                    <FormMessage />
                  </FormItem>)} />
              </div>

              <Separator />
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Info size={16} className="text-primary" />
                    <span>Enter either MDE (%) or Sample Size to calculate the other across durations.</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                        control={form.control}
                        name="minimumDetectableEffect"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>MDE (%) <span className="text-xs text-muted-foreground">(Input)</span></FormLabel>
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
                            <FormLabel>Sample Size (per variant) <span className="text-xs text-muted-foreground">(Input)</span></FormLabel>
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
                <Button type="submit" disabled={isLoading || !parsedExcelData || (!mdeValue && !sampleSizeValue)} className="w-full sm:w-auto">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Predict Durations for {calculationTarget}
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
  const calculationMode = results[0]?.calculationMode; 

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
         <CardDescription>
          Predictions for {calculationMode === 'ssToMde' ? 'Achievable MDE' : 'Total Required Sample Size'} across durations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Duration (Days)</TableHead>
                <TableHead className="min-w-[150px]">Total Users Available</TableHead>
                {calculationMode === 'mdeToSs' && <TableHead className="min-w-[180px]">Total Req. Sample Size</TableHead>}
                {calculationMode === 'ssToMde' && <TableHead className="min-w-[180px]">Achievable MDE (%)</TableHead>}
                <TableHead className="min-w-[150px]">Exposure Needed (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row.duration}</TableCell>
                  <TableCell>{formatCell(row.totalUsersAvailable, false, true)}</TableCell>
                  {row.calculationMode === 'mdeToSs' && <TableCell>{formatCell(row.totalRequiredSampleSize, false, true)}</TableCell>}
                  {row.calculationMode === 'ssToMde' && <TableCell>{formatCell(row.achievableMde, true, false, 2)}</TableCell>}
                  <TableCell>{formatCell(row.exposureNeededPercentage, true)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}


    