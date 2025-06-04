
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
import { 
  MdeToSampleSizeFormSchema, 
  type MdeToSampleSizeFormValues, 
  type MdeToSampleSizeCalculationResults,
  type ExcelDataRow,
} from "@/lib/types";
import { calculateSampleSizeAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect, ChangeEvent } from "react";
import * as XLSX from 'xlsx';
import { Loader2, AlertTriangle, Download, FileUp, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { METRIC_OPTIONS, REAL_ESTATE_OPTIONS, DEFAULT_LOOKBACK_DAYS, DEFAULT_MDE_PERCENT, DEFAULT_STATISTICAL_POWER, DEFAULT_SIGNIFICANCE_LEVEL } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [availableLookbackDays, setAvailableLookbackDays] = useState<number[]>([]);
  const [isDataFromExcel, setIsDataFromExcel] = useState(false);
  const { toast } = useToast();

  const form = useForm<MdeToSampleSizeFormValues>({
    resolver: zodResolver(MdeToSampleSizeFormSchema),
    defaultValues: {
      metric: METRIC_OPTIONS[0],
      mean: NaN, 
      variance: NaN, 
      numberOfUsers: NaN, 
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
      realEstate: REAL_ESTATE_OPTIONS[0],
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      inputType: "customData", 
    },
  });

  const selectedInputType = form.watch("inputType");
  const selectedMetric = form.watch("metric");
  const selectedRealEstate = form.watch("realEstate");
  const currentLookbackDays = form.watch("lookbackDays"); // Watch this for the auto-fill effect

  useEffect(() => {
    // Check local storage on component mount
    const storedData = localStorage.getItem('abalyticsMappedData');
    const storedFileName = localStorage.getItem('abalyticsFileName');
    if (storedData && storedFileName) {
      try {
        const data: ExcelDataRow[] = JSON.parse(storedData);
        setParsedExcelData(data);
        setUploadedFileName(storedFileName);
        form.setValue("inputType", "excelData");
        toast({ title: "Loaded previously uploaded data", description: `Using data from ${storedFileName}. Select Metric, Real Estate, and Lookback.`, variant: "default" });
      } catch (e) {
        console.error("Failed to parse stored data:", e);
        localStorage.removeItem('abalyticsMappedData');
        localStorage.removeItem('abalyticsFileName');
      }
    }
  }, [form, toast]);


  // Effect to populate available lookback days from Excel/Mapped Data
  useEffect(() => {
    if (selectedInputType === "excelData" && parsedExcelData && selectedMetric && selectedRealEstate) {
      const metricKey = 'metric'; 
      const realEstateKey = 'realEstate';
      const lookbackKeyExcel = 'lookbackDays';

      const filteredRows = parsedExcelData.filter(row => {
        const rowMetric = row[metricKey];
        const rowRealEstate = row[realEstateKey];
        // Ensure keys exist and are strings before calling toLowerCase
        return typeof rowMetric === 'string' && typeof rowRealEstate === 'string' &&
               rowMetric.toLowerCase() === selectedMetric.toLowerCase() &&
               rowRealEstate.toLowerCase() === selectedRealEstate.toLowerCase();
      });

      const uniqueLookbacks = Array.from(new Set(
          filteredRows.map(row => row[lookbackKeyExcel]).filter(lb => typeof lb === 'number' && !isNaN(lb)) as number[]
      )).sort((a, b) => a - b);
      
      setAvailableLookbackDays(uniqueLookbacks);

      const currentFormLookback = form.getValues("lookbackDays");
      if (uniqueLookbacks.length > 0) {
        if (!uniqueLookbacks.includes(currentFormLookback)) {
          form.setValue("lookbackDays", uniqueLookbacks[0], { shouldValidate: true });
        }
      } else {
        form.setValue("lookbackDays", DEFAULT_LOOKBACK_DAYS);
        form.setValue("mean", NaN);
        form.setValue("variance", NaN);
        form.setValue("numberOfUsers", NaN);
        setIsDataFromExcel(false);
        onResults(null);
        toast({ title: "No lookback periods found", description: `No lookback data in the file for ${selectedMetric} on ${selectedRealEstate}. Input manually or check selections/file.`, variant: "default"});
      }
    } else {
      setAvailableLookbackDays([]);
      if (selectedInputType !== "excelData") {
        setIsDataFromExcel(false);
      }
    }
  }, [selectedInputType, selectedMetric, selectedRealEstate, parsedExcelData, form, toast, onResults]);


  // Effect to auto-fill data from Excel based on Metric, Real Estate, AND LookbackDays
  useEffect(() => {
    if (selectedInputType === "excelData" && parsedExcelData && selectedMetric && selectedRealEstate && !isNaN(currentLookbackDays)) {
      const metricKey = 'metric';
      const realEstateKey = 'realEstate';
      const lookbackKeyExcel = 'lookbackDays';
      const meanKey = 'mean';
      const varianceKey = 'variance';
      const usersKey = 'totalUsers';

      const matchedRow = parsedExcelData.find(row => {
        const rowMetric = row[metricKey];
        const rowRealEstate = row[realEstateKey];
        const rowLookback = row[lookbackKeyExcel];
        return typeof rowMetric === 'string' && typeof rowRealEstate === 'string' && typeof rowLookback === 'number' &&
               rowMetric.toLowerCase() === selectedMetric.toLowerCase() &&
               rowRealEstate.toLowerCase() === selectedRealEstate.toLowerCase() &&
               rowLookback === currentLookbackDays;
      });

      if (matchedRow) {
        const meanVal = parseFloat(String(matchedRow[meanKey]));
        const varianceVal = parseFloat(String(matchedRow[varianceKey]));
        const usersVal = parseInt(String(matchedRow[usersKey]), 10);

        form.setValue("mean", isNaN(meanVal) ? NaN : meanVal, { shouldValidate: true });
        form.setValue("variance", isNaN(varianceVal) ? NaN : varianceVal, { shouldValidate: true });
        form.setValue("numberOfUsers", isNaN(usersVal) ? NaN : usersVal, { shouldValidate: true });
        setIsDataFromExcel(true);
        onResults(null);
        toast({ title: "Data auto-filled from file", description: `Values for ${selectedMetric} on ${selectedRealEstate} for ${currentLookbackDays} days lookback applied.`, variant: "default" });
      } else {
        form.setValue("mean", NaN);
        form.setValue("variance", NaN);
        form.setValue("numberOfUsers", NaN);
        setIsDataFromExcel(false);
        onResults(null);
        toast({ title: "No matching data in file", description: `No row found for ${selectedMetric} on ${selectedRealEstate} with ${currentLookbackDays} days lookback. Input manually or check selections.`, variant: "default" });
      }
    } else if (selectedInputType !== "excelData") {
        setIsDataFromExcel(false);
    }
  }, [selectedInputType, selectedMetric, selectedRealEstate, currentLookbackDays, parsedExcelData, form, toast, onResults]);


  async function onSubmit(values: MdeToSampleSizeFormValues) {
    setIsLoading(true);
    onResults(null); 
    try {
      const result = await calculateSampleSizeAction(values);
      onResults(result);

      if (result.requiredSampleSize !== undefined || (result.warnings && result.warnings.length > 0) ) {
        toast({
            title: "Calculation Successful",
            description: "Required sample size and duration estimates calculated.",
        });
      } else {
         toast({
            variant: "destructive",
            title: "Calculation Incomplete",
            description: "Could not determine sample size. Please check inputs.",
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
  
  const isHistoricalDataReadOnly = selectedInputType === "excelData" && isDataFromExcel;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">MDE to Sample Size Inputs</CardTitle>
        <p className="text-muted-foreground">
          Enter desired MDE. For historical data (Mean, Variance, Traffic), select your pre-uploaded data file and parameters, or input manually.
        </p>
         {uploadedFileName && selectedInputType === "excelData" && (
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
                    <Select onValueChange={(value) => { field.onChange(value); onResults(null); setIsDataFromExcel(false); }} defaultValue={field.value}>
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
                    <Select onValueChange={(value) => { field.onChange(value); onResults(null); setIsDataFromExcel(false);}} defaultValue={field.value}>
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
              <FormField
                control={form.control}
                name="lookbackDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lookback Days</FormLabel>
                    {selectedInputType === "excelData" && parsedExcelData && availableLookbackDays.length > 0 ? (
                         <Select
                            onValueChange={(value) => {
                                field.onChange(parseInt(value, 10));
                                onResults(null);
                                setIsDataFromExcel(false); 
                            }}
                            value={String(field.value)}
                            disabled={!parsedExcelData || availableLookbackDays.length === 0}
                         >
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select from file" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {availableLookbackDays.map(days => (
                                <SelectItem key={days} value={String(days)}>
                                    {days} days
                                </SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                    ) : (
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 30" 
                          {...field} 
                          onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null); if (selectedInputType === 'excelData') setIsDataFromExcel(false);}} 
                          readOnly={isHistoricalDataReadOnly && availableLookbackDays.length > 0} 
                        />
                      </FormControl>
                    )}
                     <FormDescription>
                        {isHistoricalDataReadOnly 
                            ? "Selected from file. Used to calculate daily traffic." 
                            : "Used to calculate daily traffic from Total Users."}
                     </FormDescription>
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
                  <FormLabel>Historical Data Input Method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => { 
                        field.onChange(value); 
                        onResults(null); 
                        setIsDataFromExcel(false);
                        if (value !== 'excelData') { 
                            // setParsedExcelData(null); // Keep parsed data if user switches back
                            // setUploadedFileName(null); 
                            // setAvailableLookbackDays([]);
                            form.setValue("mean", NaN);
                            form.setValue("variance", NaN);
                            form.setValue("numberOfUsers", NaN);
                            form.setValue("lookbackDays", DEFAULT_LOOKBACK_DAYS);
                        } else {
                            // If switching to excelData, trigger reload of data from localStorage if available
                             const storedData = localStorage.getItem('abalyticsMappedData');
                             const storedFileName = localStorage.getItem('abalyticsFileName');
                             if (storedData && storedFileName) {
                                try {
                                    const data: ExcelDataRow[] = JSON.parse(storedData);
                                    setParsedExcelData(data);
                                    setUploadedFileName(storedFileName);
                                     toast({ title: "Using data from file", description: `${storedFileName}. Select Metric, Real Estate, and Lookback.`, variant: "default" });
                                } catch (e) { /* already handled in mount effect */ }
                             } else {
                                toast({ title: "No file uploaded", description: `Please go to "Upload & Map Data" page first.`, variant: "default" });
                             }
                        }
                      }}
                      defaultValue={field.value}
                      className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="customData" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Manual Input
                        </FormLabel>
                      </FormItem>
                       <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="excelData" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Use Uploaded Data File
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription className="text-xs mt-2">
                    {selectedInputType === "excelData" ? 
                        (uploadedFileName ? `Using data from "${uploadedFileName}". Select Metric, Real Estate & Lookback above to auto-fill fields.` : 'No data file found. Please use the "Upload & Map Data" page.') :
                        'Enter all historical data fields manually below.'
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            <p className="text-sm text-muted-foreground">
              {selectedInputType === 'excelData' ? 
                (isDataFromExcel ? 'Historical data below is auto-filled from your file and is read-only.' : 'Select Metric, Real Estate, and Lookback Period to auto-fill, or input manually if no match/file.') :
                'Enter historical data and desired MDE below.'
              }
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <FormField
                control={form.control}
                name="minimumDetectableEffect"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Detectable Effect (MDE %)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 2 for 2%" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any"/>
                    </FormControl>
                    <FormDescription>Enter as a percentage, e.g., 2 for 2%.</FormDescription>
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
                      <Input type="number" placeholder="e.g., 0.15" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any" readOnly={isHistoricalDataReadOnly} />
                    </FormControl>
                    {isHistoricalDataReadOnly && <FormDescription className="text-xs text-primary">Value from file</FormDescription>}
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
                      <Input type="number" placeholder="e.g., 0.1275" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any" readOnly={isHistoricalDataReadOnly} />
                    </FormControl>
                    {isHistoricalDataReadOnly && <FormDescription className="text-xs text-primary">Value from file</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="numberOfUsers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Users (in Lookback)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 100000" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} readOnly={isHistoricalDataReadOnly} />
                    </FormControl>
                     {isHistoricalDataReadOnly && <FormDescription className="text-xs text-primary">Value from file</FormDescription>}
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
                       <Input type="number" placeholder="e.g., 0.8 for 80%" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
                      <Input type="number" placeholder="e.g., 0.05 for 5%" {...field} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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

  const dailyUsers = results.numberOfUsers && results.lookbackDays && results.lookbackDays > 0 
                     ? results.numberOfUsers / results.lookbackDays 
                     : 0;
  
  const shouldShowCard = results.requiredSampleSize !== undefined || (results.warnings && results.warnings.length > 0);

  if (!shouldShowCard) {
     return null; 
  }

  return (
    <Card className="mt-8 w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">MDE to Sample Size Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {results.requiredSampleSize === undefined && (!results.warnings || results.warnings.length === 0) && (
            <p className="text-muted-foreground text-center py-8">Please run the calculation with valid inputs.</p>
        )}
        {results.requiredSampleSize !== undefined && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
                <p className="font-medium text-muted-foreground">Required Sample Size (per variant)</p>
                <p className="text-2xl font-semibold text-primary">{results.requiredSampleSize?.toLocaleString() || 'N/A'}</p>
            </div>
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
        
        {dailyUsers > 0 && results.durationEstimates && results.durationEstimates.length > 0 && results.requiredSampleSize !== undefined && (
          <div className="mt-4">
            <h3 className="font-medium text-lg mb-2">Duration vs. Traffic Availability</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Based on historical daily traffic of ~{Math.round(dailyUsers).toLocaleString()} users (from inputs or file):
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Duration (Weeks)</TableHead>
                  <TableHead>Total Users Available (Est.)</TableHead>
                  <TableHead>Sufficient for Test?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.durationEstimates.map((row) => (
                  <TableRow key={row.weeks}>
                    <TableCell>{row.weeks}</TableCell>
                    <TableCell>{Math.round(row.totalUsersAvailable).toLocaleString()}</TableCell>
                    <TableCell className={row.isSufficient ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                      {row.isSufficient ? 'Yes' : 'No'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
             <p className="text-xs text-muted-foreground mt-2">
              "Total Users Available" is for both variants. "Sufficient for Test?" checks if this is enough for the "Required Sample Size (per variant)" x 2.
            </p>
          </div>
        )}


        {results.warnings && results.warnings.length > 0 && (
          <div className={`mt-4 ${results.requiredSampleSize === undefined ? '' : 'pt-4 border-t'}`}>
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

    