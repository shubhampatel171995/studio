
"use client";

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MdeToSampleSizeForm, MdeToSampleSizeResultsDisplay } from "@/components/ab-analytics/mde-to-sample-size-form";
import { SampleSizeToMdeForm, SampleSizeToMdeResultsDisplay } from "@/components/ab-analytics/sample-size-to-mde-form";
import { type MdeToSampleSizeCalculationResults, type SampleSizeToMdeCalculationResults } from "@/lib/types";
import { downloadMdeToSampleSizeReport, downloadSampleSizeToMdeReport } from '@/components/ab-analytics/report-download';
import { Calculator, Search, BarChartHorizontalBig } from 'lucide-react';

export default function ABalyticsPage() {
  const [mdeToSampleSizeResults, setMdeToSampleSizeResults] = useState<MdeToSampleSizeCalculationResults | null>(null);
  const [sampleSizeToMdeResults, setSampleSizeToMdeResults] = useState<SampleSizeToMdeCalculationResults | null>(null);

  const handleMdeToSampleSizeResults = (results: MdeToSampleSizeCalculationResults | null) => {
    setMdeToSampleSizeResults(results);
  };

  const handleSampleSizeToMdeResults = (results: SampleSizeToMdeCalculationResults | null) => {
    setSampleSizeToMdeResults(results);
  };

  const handleDownloadMdeToSampleSizeReport = (results: MdeToSampleSizeCalculationResults) => {
    if (results) {
      downloadMdeToSampleSizeReport(results);
    }
  };

  const handleDownloadSampleSizeToMdeReport = (results: SampleSizeToMdeCalculationResults) => {
    if (results) {
      downloadSampleSizeToMdeReport(results);
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
        <Tabs defaultValue="mde-to-sample-size" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-6 mx-auto md:mx-0">
            <TabsTrigger value="mde-to-sample-size" className="text-sm md:text-base">
              <Calculator className="mr-2 h-4 w-4" /> MDE to Sample Size
            </TabsTrigger>
            <TabsTrigger value="sample-size-to-mde" className="text-sm md:text-base">
              <Search className="mr-2 h-4 w-4" /> Sample Size to MDE
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="mde-to-sample-size">
            <div className="space-y-6">
              <MdeToSampleSizeForm 
                onResults={handleMdeToSampleSizeResults} 
                onDownload={handleDownloadMdeToSampleSizeReport}
                currentResults={mdeToSampleSizeResults}
              />
              {mdeToSampleSizeResults && <MdeToSampleSizeResultsDisplay results={mdeToSampleSizeResults} />}
            </div>
          </TabsContent>
          
          <TabsContent value="sample-size-to-mde">
             <div className="space-y-6">
              <SampleSizeToMdeForm
                onResults={handleSampleSizeToMdeResults}
                onDownload={handleDownloadSampleSizeToMdeReport}
                currentResults={sampleSizeToMdeResults}
              />
              {sampleSizeToMdeResults && <SampleSizeToMdeResultsDisplay results={sampleSizeToMdeResults} />}
            </div>
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
