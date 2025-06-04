
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
  type DurationEstimateRow,
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

// Helper to find a key in an object ignoring case
const findKeyIgnoreCase = (obj: Record<string, any>, keyToFind: string): string | undefined => {
  return Object.keys(obj).find(key => key.toLowerCase() === keyToFind.toLowerCase());
};


export function MdeToSampleSizeForm({ onResults, onDownload, currentResults }: MdeToSampleSizeFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState<ExcelDataRow[] | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
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

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setParsedExcelData(null);
      setUploadedFileName(null);
      toast({ title: "File selection cancelled", variant: "default" });
      return;
    }

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<ExcelDataRow>(worksheet, { defval: undefined });
        
        // Normalize keys to lowercase for easier matching
        const normalizedJsonData = jsonData.map(row => {
            const newRow: ExcelDataRow = {};
            for (const key in row) {
                newRow[key.toLowerCase()] = row[key];
            }
            return newRow;
        });

        setParsedExcelData(normalizedJsonData);
        toast({ title: "File parsed successfully!", description: `${normalizedJsonData.length} rows found. Select metric & real estate to auto-fill.`, variant: "default" });
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        setParsedExcelData(null);
        setUploadedFileName(null);
        event.target.value = ''; // Reset file input
        toast({ title: "Error parsing file", description: "Please ensure it's a valid Excel/CSV file with expected columns.", variant: "destructive" });
      }
    };
    reader.onerror = () => {
        setParsedExcelData(null);
        setUploadedFileName(null);
        event.target.value = ''; // Reset file input
        toast({ title: "Error reading file", variant: "destructive" });
    }
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (selectedInputType === "excelData" && parsedExcelData && selectedMetric && selectedRealEstate) {
      const metricKey = 'metric';
      const realEstateKey = 'realestate'; // expecting lowercase key from normalized data
      const meanKey = 'mean';
      const varianceKey = 'variance';
      const usersKey = 'total users'; // common variations
      const usersKeyAlt1 = 'numberofusers';
      const usersKeyAlt2 = 'totalusers';
      const lookbackKey = 'lookback days'; // common variations
      const lookbackKeyAlt1 = 'lookbackdays';


      const matchedRow = parsedExcelData.find(row => {
        const rowMetric = row[metricKey];
        const rowRealEstate = row[realEstateKey];
        return typeof rowMetric === 'string' && typeof rowRealEstate === 'string' &&
               rowMetric.toLowerCase() === selectedMetric.toLowerCase() &&
               rowRealEstate.toLowerCase() === selectedRealEstate.toLowerCase();
      });

      if (matchedRow) {
        const meanVal = parseFloat(String(matchedRow[meanKey]));
        const varianceVal = parseFloat(String(matchedRow[varianceKey]));
        
        let usersVal = NaN;
        if (matchedRow[usersKey] !== undefined) usersVal = parseInt(String(matchedRow[usersKey]), 10);
        else if (matchedRow[usersKeyAlt1] !== undefined) usersVal = parseInt(String(matchedRow[usersKeyAlt1]), 10);
        else if (matchedRow[usersKeyAlt2] !== undefined) usersVal = parseInt(String(matchedRow[usersKeyAlt2]), 10);
        
        let lookbackVal = NaN;
        if (matchedRow[lookbackKey] !== undefined) lookbackVal = parseInt(String(matchedRow[lookbackKey]), 10);
        else if (matchedRow[lookbackKeyAlt1] !== undefined) lookbackVal = parseInt(String(matchedRow[lookbackKeyAlt1]), 10);


        form.setValue("mean", isNaN(meanVal) ? NaN : meanVal, { shouldValidate: true });
        form.setValue("variance", isNaN(varianceVal) ? NaN : varianceVal, { shouldValidate: true });
        form.setValue("numberOfUsers", isNaN(usersVal) ? NaN : usersVal, { shouldValidate: true });
        form.setValue("lookbackDays", isNaN(lookbackVal) ? DEFAULT_LOOKBACK_DAYS : lookbackVal, { shouldValidate: true });
        toast({ title: "Data auto-filled from Excel", description: `Values for ${selectedMetric} on ${selectedRealEstate} applied.`, variant: "default" });
      } else {
        // Optionally clear fields or notify user if no match
        form.setValue("mean", NaN);
        form.setValue("variance", NaN);
        form.setValue("numberOfUsers", NaN);
        form.setValue("lookbackDays", DEFAULT_LOOKBACK_DAYS);
        toast({ title: "No matching data in Excel", description: `No row found for ${selectedMetric} on ${selectedRealEstate}. Please input manually or check file.`, variant: "default" });
      }
    } else if (selectedInputType !== "excelData") {
        // If not excelData, potentially clear parsedExcelData or reset fields if needed,
        // but current defaultValues handle NaN which is fine for manual input.
        // setParsedExcelData(null); //  Consider if this is desired UX
        // setUploadedFileName(null);
    }
  }, [selectedInputType, selectedMetric, selectedRealEstate, parsedExcelData, form, toast]);


  async function onSubmit(values: MdeToSampleSizeFormValues) {
    setIsLoading(true);
    onResults(null); 
    try {
      const result = await calculateSampleSizeAction(values); // Pass MdeToSampleSizeFormValues type
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

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">MDE to Sample Size Inputs</CardTitle>
        <p className="text-muted-foreground">Enter your desired MDE and other parameters to calculate the required sample size. You can manually input data or upload an Excel/CSV file to auto-fill common parameters.</p>
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
                    <Select onValueChange={(value) => { field.onChange(value); onResults(null); }} defaultValue={field.value}>
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
                    <Select onValueChange={(value) => { field.onChange(value); onResults(null);}} defaultValue={field.value}>
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

            <FormField
              control={form.control}
              name="inputType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Data Input Method</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => { 
                        field.onChange(value); 
                        onResults(null); 
                        if (value !== 'excelData') { 
                            setParsedExcelData(null); 
                            setUploadedFileName(null);
                            const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
                            if (fileInput) fileInput.value = '';
                        }
                      }}
                      defaultValue={field.value}
                      className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="platformDefault" disabled />
                        </FormControl>
                        <FormLabel className="font-normal text-muted-foreground">
                          Platform Default (soon)
                        </FormLabel>
                      </FormItem>
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
                          Upload Excel/CSV
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedInputType === "excelData" && (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                <FormLabel htmlFor="excel-upload" className="flex items-center gap-2 cursor-pointer">
                    <FileUp className="h-5 w-5 text-primary"/> Upload Excel/CSV File
                </FormLabel>
                <Input 
                    id="excel-upload" 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileUpload} 
                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                />
                {uploadedFileName && (
                    <div className={cn("text-xs flex items-center mt-1", parsedExcelData ? "text-green-600" : "text-destructive")}>
                        {parsedExcelData ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                        {uploadedFileName} {parsedExcelData ? `(${parsedExcelData.length} rows parsed)`: "(Parsing failed or no data)"}
                    </div>
                )}
                <FormDescription className="text-xs">
                  Expected columns (case-insensitive): Metric, Real Estate, Mean, Variance, Total Users, Lookback Days.
                  Data for selected Metric & Real Estate will auto-fill below.
                </FormDescription>
              </div>
            )}
            
            <Separator />
            <p className="text-sm text-muted-foreground">
              {selectedInputType === 'excelData' && parsedExcelData ? 
                'Data below may be auto-filled from your Excel. You can override if needed.' : 
                'Enter custom data below. For daily traffic estimation, provide total users over the lookback period.'
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
                      <Input type="number" placeholder="e.g., 2 for 2%" {...field} onChange={(e) => {field.onChange(e); onResults(null);}} step="any"/>
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
                      <Input type="number" placeholder="e.g., 0.15 for 15% CR" {...field} onChange={(e) => {field.onChange(e); onResults(null);}} step="any"/>
                    </FormControl>
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
                      <Input type="number" placeholder="e.g., 0.1275" {...field} onChange={(e) => {field.onChange(e); onResults(null);}} step="any"/>
                    </FormControl>
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
                      <Input type="number" placeholder="e.g., 100000" {...field} onChange={(e) => {field.onChange(e); onResults(null);}}/>
                    </FormControl>
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
                    <FormControl>
                      <Input type="number" placeholder="e.g., 30" {...field} onChange={(e) => {field.onChange(e); onResults(null);}}/>
                    </FormControl>
                     <FormDescription>Used to calculate daily traffic from Total Users.</FormDescription>
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
                       <Input type="number" placeholder="e.g., 0.8 for 80%" {...field} onChange={(e) => {field.onChange(e); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
                      <Input type="number" placeholder="e.g., 0.05 for 5%" {...field} onChange={(e) => {field.onChange(e); onResults(null);}} step="0.01" min="0.01" max="0.99" />
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
                 <Button type="button" variant="outline" onClick={() => onDownload(currentResults)} className="w-full sm:w-auto">
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
              Based on historical daily traffic of ~{Math.round(dailyUsers).toLocaleString()} users (from inputs or Excel):
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
