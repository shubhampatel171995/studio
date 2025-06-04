
"use client";

import { useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileUp, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExcelDataRow } from '@/lib/types'; // Ensure this type can handle generic keys initially

// Expected columns by the application
const EXPECTED_COLUMNS = [
  { id: 'metric', label: 'Metric Name', required: true },
  { id: 'realEstate', label: 'Real Estate/Page', required: true },
  { id: 'lookbackDays', label: 'Lookback Days (Number)', required: true },
  { id: 'mean', label: 'Mean (Historical Value)', required: true },
  { id: 'variance', label: 'Variance (Historical Value)', required: true },
  { id: 'totalUsers', label: 'Total Users (in Lookback)', required: true },
] as const; // Use const assertion

type ExpectedColumnId = typeof EXPECTED_COLUMNS[number]['id'];

export function ExcelDataUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<ExpectedColumnId, string | undefined>>(
    EXPECTED_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: undefined }), {} as Record<ExpectedColumnId, string | undefined>)
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setSheetHeaders([]); // Reset headers
      setColumnMapping(EXPECTED_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: undefined }), {} as Record<ExpectedColumnId, string | undefined>)); // Reset mapping
      parseHeaders(selectedFile);
    } else {
      setFile(null);
      setFileName(null);
      setSheetHeaders([]);
      setColumnMapping(EXPECTED_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: undefined }), {} as Record<ExpectedColumnId, string | undefined>));
    }
  };

  const parseHeaders = (selectedFile: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', sheetRows: 1 }); // Read only the first row for headers
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const headers = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 })[0] as string[];
        setSheetHeaders(headers.filter(h => h && typeof h === 'string')); // Filter out any potential null/empty headers
         toast({ title: "File headers parsed", description: "Please map your columns below." });
      } catch (error) {
        console.error("Error parsing Excel headers:", error);
        toast({ variant: "destructive", title: "Error parsing headers", description: "Could not read column headers from the file. Is it a valid Excel/CSV?" });
        setSheetHeaders([]);
      }
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "Error reading file" });
      setSheetHeaders([]);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleMappingChange = (expectedColId: ExpectedColumnId, actualHeader: string) => {
    setColumnMapping(prev => ({ ...prev, [expectedColId]: actualHeader }));
  };

  const processAndStoreFile = () => {
    if (!file) {
      toast({ variant: "destructive", title: "No file selected" });
      return;
    }

    const allRequiredMapped = EXPECTED_COLUMNS.every(ec => ec.required ? !!columnMapping[ec.id] : true);
    if (!allRequiredMapped) {
        toast({ variant: "destructive", title: "Mapping incomplete", description: "Please map all required columns." });
        return;
    }

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: undefined });

        const mappedData: ExcelDataRow[] = jsonData.map(row => {
          const newRow: Partial<ExcelDataRow> = {};
          (EXPECTED_COLUMNS).forEach(col => {
            const actualHeader = columnMapping[col.id];
            if (actualHeader && row[actualHeader] !== undefined) {
              // Basic type coercion attempt
              if (col.id === 'lookbackDays' || col.id === 'totalUsers') {
                newRow[col.id] = parseInt(String(row[actualHeader]), 10);
              } else if (col.id === 'mean' || col.id === 'variance') {
                newRow[col.id] = parseFloat(String(row[actualHeader]));
              } else {
                newRow[col.id] = String(row[actualHeader]);
              }
            }
          });
          return newRow as ExcelDataRow; // Assume all required fields are present after mapping
        }).filter(row => {
            // Ensure all required fields got mapped and are valid numbers where expected
            return EXPECTED_COLUMNS.every(ec => {
                if (!ec.required) return true;
                const val = row[ec.id];
                if (val === undefined) return false;
                if ((ec.id === 'lookbackDays' || ec.id === 'totalUsers' || ec.id === 'mean' || ec.id === 'variance') && isNaN(val as number) ) return false;
                return true;
            });
        });
        

        if (mappedData.length === 0) {
            toast({ variant: "destructive", title: "No valid data processed", description: "Check your file content and column mappings. Ensure numeric fields are valid numbers."});
            setIsLoading(false);
            return;
        }

        localStorage.setItem('abalyticsMappedData', JSON.stringify(mappedData));
        localStorage.setItem('abalyticsFileName', fileName || 'uploaded_data.xlsx');
        
        toast({ title: "Data processed successfully!", description: `${mappedData.length} rows ready. Redirecting to calculator...`});
        router.push('/'); // Navigate to the main calculator page
      } catch (error) {
        console.error("Error processing Excel file:", error);
        toast({ variant: "destructive", title: "Error processing file", description: "Could not process the data. Please check the file format and mapping." });
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => setIsLoading(false);
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="file-upload" className="flex items-center gap-2 cursor-pointer mb-1 text-sm font-medium">
            <FileUp className="h-5 w-5 text-primary"/> Upload Excel/CSV File
        </Label>
        <Input 
            id="file-upload" 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileChange} 
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
        />
        {fileName && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1 text-green-600"/> Selected: {fileName}
            </p>
        )}
      </div>

      {sheetHeaders.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle>Map Columns</CardTitle>
                <CardDescription>Match the expected data fields to the columns found in your uploaded file. All fields are required.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            {EXPECTED_COLUMNS.map(col => (
              <div key={col.id} className="grid grid-cols-2 gap-4 items-center">
                <Label htmlFor={`map-${col.id}`} className="text-sm font-medium">
                  {col.label}{col.required && <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={columnMapping[col.id] || ''}
                  onValueChange={(value) => handleMappingChange(col.id, value)}
                >
                  <SelectTrigger id={`map-${col.id}`}>
                    <SelectValue placeholder="Select column from your file" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheetHeaders.map(header => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {file && sheetHeaders.length > 0 && (
        <Button onClick={processAndStoreFile} disabled={isLoading || !EXPECTED_COLUMNS.every(ec => ec.required ? !!columnMapping[ec.id] : true)} className="w-full">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          Process File & Proceed to Calculator
        </Button>
      )}
       {file && sheetHeaders.length === 0 && !isLoading && (
        <p className="text-sm text-destructive flex items-center"><AlertTriangle className="h-4 w-4 mr-1" />Could not read headers. Please check the file or try a different one.</p>
      )}
    </div>
  );
}
