
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FixedDurationCalculatorForm, FixedDurationCalculatorResultsDisplay } from "@/components/ab-analytics/fixed-duration-calculator-form";
import { MdeDurationPredictorForm, MdeDurationPredictorResultsDisplay } from '@/components/ab-analytics/mde-duration-predictor-form';
import { 
    type MdeDurationPredictorResultRow,
    type FixedDurationCalculatorResults
} from "@/lib/types";
import { 
    downloadFixedDurationCalculatorReport, 
    downloadMdeDurationPredictorReport 
} from '@/components/ab-analytics/report-download';
import { Calculator, UploadCloud, NotebookPen, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ABalyticsPage() {
  const [fixedDurationCalculatorResults, setFixedDurationCalculatorResults] = useState<FixedDurationCalculatorResults | null>(null);
  const [mdeDurationPredictorResults, setMdeDurationPredictorResults] = useState<MdeDurationPredictorResultRow[] | null>(null);

  const handleFixedDurationCalculatorResults = (results: FixedDurationCalculatorResults | null) => {
    setFixedDurationCalculatorResults(results);
  };

  const handleMdeDurationPredictorResults = (results: MdeDurationPredictorResultRow[] | null) => {
    setMdeDurationPredictorResults(results);
  };

  const handleDownloadFixedDurationCalculatorReport = () => {
    if (fixedDurationCalculatorResults) {
      downloadFixedDurationCalculatorReport(fixedDurationCalculatorResults);
    }
  };

  const handleDownloadMdeDurationPredictorReport = () => {
    if (mdeDurationPredictorResults && mdeDurationPredictorResults.length > 0 && fixedDurationCalculatorResults?.inputs) { 
        // The fixedDurationCalculatorResults.inputs might not be perfectly analogous
        // We need the core parameters that were used for the MDE/SS to Duration prediction
        // Let's assume the MdeDurationPredictorForm itself holds the necessary base input values if results exist
        // For now, we might need to pass the form values from MdeDurationPredictorForm directly
        // Or adapt what fixedDurationCalculatorResults.inputs provides if it's generally applicable

        // Simplification: if mdeDurationPredictorResults exist, they should contain enough context or their originating form values.
        // The download function for mdeDurationPredictorReport now takes the form values directly.
        // We would need to get the form values that led to mdeDurationPredictorResults.
        // This part needs careful state management if the download is initiated from here
        // For now, the download button is within MdeDurationPredictorForm, which has direct access to its form values.
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-end"> 
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/manual-calculator">
                <NotebookPen className="mr-2 h-4 w-4" /> Manual Calculator
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/upload-data">
                <UploadCloud className="mr-2 h-4 w-4" /> Upload & Map Data
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Tabs defaultValue="fixed-duration-calculator" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[600px] mb-6 mx-auto md:mx-0">
            <TabsTrigger value="fixed-duration-calculator" className="text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Calculator className="mr-2 h-4 w-4" /> Fixed Duration Calculator
            </TabsTrigger>
            <TabsTrigger value="dynamic-duration-calculator" className="text-sm md:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Clock className="mr-2 h-4 w-4" /> Dynamic Duration Calculator
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="fixed-duration-calculator">
            <div className="space-y-6">
              <FixedDurationCalculatorForm 
                onResults={handleFixedDurationCalculatorResults} 
                onDownload={handleDownloadFixedDurationCalculatorReport}
                currentResults={fixedDurationCalculatorResults}
              />
              {fixedDurationCalculatorResults && <FixedDurationCalculatorResultsDisplay results={fixedDurationCalculatorResults} />}
            </div>
          </TabsContent>
          
          <TabsContent value="dynamic-duration-calculator">
            <MdeDurationPredictorForm 
                onResults={handleMdeDurationPredictorResults}
                currentResults={mdeDurationPredictorResults}
            />
            {mdeDurationPredictorResults && <MdeDurationPredictorResultsDisplay results={mdeDurationPredictorResults} />}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
