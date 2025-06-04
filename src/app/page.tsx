
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
    if (mdeDurationPredictorResults && fixedDurationCalculatorResults?.inputs) { 
        const formValuesForReport = { 
            metric: fixedDurationCalculatorResults.inputs.metric,
            realEstate: fixedDurationCalculatorResults.inputs.realEstate,
            metricType: fixedDurationCalculatorResults.inputs.metricType,
            minimumDetectableEffect: fixedDurationCalculatorResults.inputs.minimumDetectableEffect || 0, 
            statisticalPower: fixedDurationCalculatorResults.inputs.statisticalPower,
            significanceLevel: fixedDurationCalculatorResults.inputs.significanceLevel,
            numberOfVariants: fixedDurationCalculatorResults.inputs.numberOfVariants,
        };
      downloadMdeDurationPredictorReport(formValuesForReport, mdeDurationPredictorResults);
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
          <TabsList className="grid w-full grid-cols-2 md:w-[500px] mb-6 mx-auto md:mx-0">
            <TabsTrigger value="fixed-duration-calculator" className="text-sm md:text-base">
              <Calculator className="mr-2 h-4 w-4" /> Fixed Duration Calculator
            </TabsTrigger>
            <TabsTrigger value="dynamic-duration-calculator" className="text-sm md:text-base">
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
            <div className="space-y-6">
              <MdeDurationPredictorForm 
                onResults={handleMdeDurationPredictorResults}
                currentResults={mdeDurationPredictorResults}
              />
              {mdeDurationPredictorResults && <MdeDurationPredictorResultsDisplay results={mdeDurationPredictorResults} />}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-20 md:flex-row">
          <p className="text-sm leading-loose text-muted-foreground text-center">
            ABalytics - A/B Test Sample Size & Duration Estimator
          </p>
        </div>
      </footer>
    </div>
  );
}
