
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
import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { METRIC_OPTIONS as DEFAULT_METRIC_OPTIONS, REAL_ESTATE_OPTIONS as DEFAULT_REAL_ESTATE_OPTIONS, DEFAULT_LOOKBACK_DAYS, DEFAULT_MDE_PERCENT, DEFAULT_STATISTICAL_POWER, DEFAULT_SIGNIFICANCE_LEVEL } from "@/lib/constants";
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
  
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(DEFAULT_METRIC_OPTIONS);
  const [availableRealEstates, setAvailableRealEstates] = useState<string[]>(DEFAULT_REAL_ESTATE_OPTIONS);
  const [availableLookbackDays, setAvailableLookbackDays] = useState<number[]>([]);
  const [isDataFromExcel, setIsDataFromExcel] = useState(false); // Tracks if current mean/variance/users are from excel
  const { toast } = useToast();

  const form = useForm<MdeToSampleSizeFormValues>({
    resolver: zodResolver(MdeToSampleSizeFormSchema),
    defaultValues: {
      metric: '',
      mean: NaN, 
      variance: NaN, 
      numberOfUsers: NaN, 
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
      realEstate: '',
      minimumDetectableEffect: DEFAULT_MDE_PERCENT,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
    },
  });

  const selectedMetric = form.watch("metric");
  const selectedRealEstate = form.watch("realEstate");
  const currentLookbackDays = form.watch("lookbackDays");

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
        
        toast({ title: "Loaded previously uploaded data", description: `Using data from ${storedFileName}. Select Metric, Real Estate, and Lookback.`, variant: "default" });
      } catch (e) {
        console.error("Failed to parse stored data:", e);
        localStorage.removeItem('abalyticsMappedData');
        localStorage.removeItem('abalyticsFileName');
        setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
      }
    } else {
        setAvailableMetrics(DEFAULT_METRIC_OPTIONS);
        setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS);
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
      } else if (DEFAULT_REAL_ESTATE_OPTIONS.length > 0) {
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
    if (parsedExcelData && selectedMetric && selectedRealEstate) {
      const filteredRows = parsedExcelData.filter(row => 
        row.metric === selectedMetric && row.realEstate === selectedRealEstate
      );
      const uniqueLookbacks = Array.from(new Set(
          filteredRows.map(row => row.lookbackDays).filter(lb => typeof lb === 'number' && !isNaN(lb)) as number[]
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
        if (parsedExcelData.length > 0) {
          toast({ title: "No lookback periods found", description: `No lookback data in the file for ${selectedMetric} on ${selectedRealEstate}. Input manually or check selections/file.`, variant: "default"});
        }
      }
    } else if (!parsedExcelData) {
        setAvailableLookbackDays([]);
        setIsDataFromExcel(false);
    }
  }, [parsedExcelData, selectedMetric, selectedRealEstate, form, toast, onResults]);


  useEffect(() => {
    if (parsedExcelData && selectedMetric && selectedRealEstate && !isNaN(currentLookbackDays)) {
      const matchedRow = parsedExcelData.find(row => 
        row.metric === selectedMetric &&
        row.realEstate === selectedRealEstate &&
        row.lookbackDays === currentLookbackDays
      );

      if (matchedRow) {
        const meanVal = parseFloat(String(matchedRow.mean));
        const varianceVal = parseFloat(String(matchedRow.variance));
        const usersVal = parseInt(String(matchedRow.totalUsers), 10);

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
        if (availableLookbackDays.includes(currentLookbackDays)) { 
            toast({ title: "No matching data in file", description: `No row found for ${selectedMetric} on ${selectedRealEstate} with ${currentLookbackDays} days lookback. Input manually or check selections.`, variant: "default" });
        }
      }
    } else if (!parsedExcelData) {
        if(isDataFromExcel) { 
            form.setValue("mean", NaN);
            form.setValue("variance", NaN);
            form.setValue("numberOfUsers", NaN);
        }
        setIsDataFromExcel(false);
    }
  }, [parsedExcelData, selectedMetric, selectedRealEstate, currentLookbackDays, form, toast, onResults, availableLookbackDays, isDataFromExcel]);


  async function onSubmit(values: MdeToSampleSizeFormValues) {
    setIsLoading(true);
    onResults(null); 
    try {
      const result = await calculateSampleSizeAction(values);
      onResults(result);

      if (result.requiredSampleSize !== undefined && result.requiredSampleSize > 0) {
        toast({
            title: "Calculation Complete",
            description: "Required sample size and duration estimates calculated.",
        });
      } else if (result.warnings && result.warnings.length > 0) {
        toast({
            title: "Calculation Notice",
            description: result.warnings.join(' ') || "Could not fully determine sample size. See notices for details.",
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
  
  const isHistoricalDataReadOnly = !!parsedExcelData && isDataFromExcel;

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">MDE to Sample Size Inputs</CardTitle>
        <p className="text-muted-foreground">
          {parsedExcelData 
            ? `Using data from "${uploadedFileName}". Select Metric, Real Estate & Lookback to auto-fill historical data, or input MDE.`
            : 'Enter historical data and desired MDE. Or, upload a data file via the "Upload & Map Data" page.'
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
                        onValueChange={(value) => { 
                            field.onChange(value); 
                            onResults(null); 
                            setIsDataFromExcel(false); 
                            setAvailableRealEstates(DEFAULT_REAL_ESTATE_OPTIONS); // Reset dependent dropdowns
                            setAvailableLookbackDays([]);
                        }} 
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
                        onValueChange={(value) => { 
                            field.onChange(value); 
                            onResults(null); 
                            setIsDataFromExcel(false);
                            setAvailableLookbackDays([]);
                        }} 
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
                name="lookbackDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lookback Days</FormLabel>
                    {parsedExcelData && availableLookbackDays.length > 0 ? (
                         <Select
                            onValueChange={(value) => {
                                field.onChange(parseInt(value, 10));
                                onResults(null);
                            }}
                            value={String(field.value)}
                            disabled={!selectedRealEstate || availableLookbackDays.length === 0}
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
                          value={isNaN(field.value) ? '' : field.value}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            field.onChange(isNaN(val) ? NaN : val); 
                            onResults(null); 
                            if (parsedExcelData) setIsDataFromExcel(false);
                          }} 
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
            
            <Separator />
            <p className="text-sm text-muted-foreground">
              {parsedExcelData ? 
                (isDataFromExcel ? 'Historical data below is auto-filled from your file and is read-only.' : (uploadedFileName ? 'Select Metric, Real Estate, and Lookback Period to auto-fill, or input manually if no match.' : 'Upload a file or input manually.')) :
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
                      <Input type="number" placeholder="e.g., 2 for 2%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any"/>
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
                      <Input type="number" placeholder="e.g., 0.15" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any" readOnly={isHistoricalDataReadOnly} />
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
                      <Input type="number" placeholder="e.g., 0.1275" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="any" readOnly={isHistoricalDataReadOnly} />
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
                      <Input type="number" placeholder="e.g., 100000" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} readOnly={isHistoricalDataReadOnly} />
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
                       <Input type="number" placeholder="e.g., 0.8 for 80%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
                      <Input type="number" placeholder="e.g., 0.05 for 5%" {...field} value={isNaN(field.value) ? '' : field.value} onChange={(e) => {field.onChange(Number(e.target.value)); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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

  const dailyUsers = (results.historicalDailyTraffic && results.historicalDailyTraffic > 0)
                    ? results.historicalDailyTraffic
                    : (results.numberOfUsers && results.lookbackDays && results.lookbackDays > 0 && !isNaN(results.numberOfUsers) && !isNaN(results.lookbackDays)
                       ? results.numberOfUsers / results.lookbackDays 
                       : 0);
  
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
        {results.requiredSampleSize !== undefined && results.requiredSampleSize > 0 && (
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
        
        {dailyUsers > 0 && results.durationEstimates && results.durationEstimates.length > 0 && results.requiredSampleSize !== undefined && results.requiredSampleSize > 0 && (
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

    
