
"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SampleSizeCalculatorForm, SampleSizeResultsDisplay } from "@/components/ab-analytics/sample-size-calculator-form";
import { MdeExplorer } from "@/components/ab-analytics/mde-explorer";
import { type SampleSizeCalculationResults } from "@/lib/types";
import { downloadSampleSizeReport } from '@/components/ab-analytics/report-download';
import { Calculator, Search, BarChartHorizontalBig } from 'lucide-react'; // Using BarChartHorizontalBig as an example icon

export default function ABalyticsPage() {
  const [calculatorResults, setCalculatorResults] = useState<SampleSizeCalculationResults | null>(null);

  const handleCalculatorResults = (results: SampleSizeCalculationResults | null) => {
    setCalculatorResults(results);
  };

  const handleDownloadReport = (results: SampleSizeCalculationResults) => {
    if (results) {
      downloadSampleSizeReport(results);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <BarChartHorizontalBig className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
            ABalytics
          </h1>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Tabs defaultValue="calculator" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-6 mx-auto md:mx-0">
            <TabsTrigger value="calculator" className="text-sm md:text-base">
              <Calculator className="mr-2 h-4 w-4" /> Sample Size Calculator
            </TabsTrigger>
            <TabsTrigger value="mde-explorer" className="text-sm md:text-base">
              <Search className="mr-2 h-4 w-4" /> MDE Explorer
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="calculator">
            <div className="space-y-6">
              <SampleSizeCalculatorForm 
                onResults={handleCalculatorResults} 
                onDownload={handleDownloadReport}
                currentResults={calculatorResults}
              />
              {calculatorResults && <SampleSizeResultsDisplay results={calculatorResults} />}
            </div>
          </TabsContent>
          
          <TabsContent value="mde-explorer">
            <MdeExplorer />
          </TabsContent>
        </Tabs>
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-20 md:flex-row">
          <p className="text-sm leading-loose text-muted-foreground text-center">
            Powered by Statistical Insights & GenAI. For Meesho Experimentation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
