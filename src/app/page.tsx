
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MdeToSampleSizeForm, MdeToSampleSizeResultsDisplay } from "@/components/ab-analytics/mde-to-sample-size-form";
import { SampleSizeToMdeForm, SampleSizeToMdeResultsDisplay } from "@/components/ab-analytics/sample-size-to-mde-form";
import { MdeDurationPredictorForm, MdeDurationPredictorResultsDisplay } from '@/components/ab-analytics/mde-duration-predictor-form';
import { type MdeToSampleSizeCalculationResults, type SampleSizeToMdeCalculationResults, type MdeDurationPredictorResultRow } from "@/lib/types";
import { downloadMdeToSampleSizeReport, downloadSampleSizeToMdeReport } from '@/components/ab-analytics/report-download';
import { Calculator, Search, UploadCloud, NotebookPen, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ABalyticsPage() {
  const [mdeToSampleSizeResults, setMdeToSampleSizeResults] = useState<MdeToSampleSizeCalculationResults | null>(null);
  const [sampleSizeToMdeResults, setSampleSizeToMdeResults] = useState<SampleSizeToMdeCalculationResults | null>(null);
  const [mdeDurationPredictorResults, setMdeDurationPredictorResults] = useState<MdeDurationPredictorResultRow[] | null>(null);

  const handleMdeToSampleSizeResults = (results: MdeToSampleSizeCalculationResults | null) => {
    setMdeToSampleSizeResults(results);
  };

  const handleSampleSizeToMdeResults = (results: SampleSizeToMdeCalculationResults | null) => {
    setSampleSizeToMdeResults(results);
  };

  const handleMdeDurationPredictorResults = (results: MdeDurationPredictorResultRow[] | null) => {
    setMdeDurationPredictorResults(results);
  };

  const handleDownloadMdeToSampleSizeReport = () => {
    if (mdeToSampleSizeResults) {
      downloadMdeToSampleSizeReport(mdeToSampleSizeResults);
    }
  };

  const handleDownloadSampleSizeToMdeReport = () => {
    if (sampleSizeToMdeResults) {
      downloadSampleSizeToMdeReport(sampleSizeToMdeResults);
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
        <Tabs defaultValue="mde-to-sample-size" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-[700px] mb-6 mx-auto md:mx-0">
            <TabsTrigger value="mde-to-sample-size" className="text-sm md:text-base">
              <Calculator className="mr-2 h-4 w-4" /> MDE to Sample Size
            </TabsTrigger>
            <TabsTrigger value="sample-size-to-mde" className="text-sm md:text-base">
              <Search className="mr-2 h-4 w-4" /> Sample Size to MDE
            </TabsTrigger>
            <TabsTrigger value="mde-to-duration" className="text-sm md:text-base">
              <Clock className="mr-2 h-4 w-4" /> MDE to Sample Size Across Durations
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

          <TabsContent value="mde-to-duration">
            <Card className="w-full shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline text-2xl">MDE to Sample Size Across Durations</CardTitle>
                <CardDescription>
                  Predict sample size needed across different durations.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <MdeDurationPredictorForm 
                  onResults={handleMdeDurationPredictorResults}
                  currentResults={mdeDurationPredictorResults}
                />
              </CardContent>
            </Card>
            {mdeDurationPredictorResults && <MdeDurationPredictorResultsDisplay results={mdeDurationPredictorResults} />}
          </TabsContent>
        </Tabs>
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-20 md:flex-row">
          <p className="text-sm leading-loose text-muted-foreground text-center">
            Powered by Statistical Insights. For Meesho Experimentation Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}

