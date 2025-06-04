
import { MdeDurationPredictorForm } from '@/components/ab-analytics/mde-duration-predictor-form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DynamicDurationCalculatorPage() { // Renamed function
  return (
    <div className="flex flex-col min-h-screen bg-background">
       <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Clock className="h-8 w-8 mr-3 text-primary" />
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
              Dynamic Duration Calculator {/* Renamed title */}
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to ABalytics Home
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 md:p-8">
        {/* This page primarily exists for potential direct linking. 
            The MdeDurationPredictorForm now renders its own card structure. */}
        <MdeDurationPredictorForm 
            onResults={() => {}} // Dummy onResults for standalone page
            currentResults={null} // Dummy currentResults
        />
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-20 md:flex-row">
          <p className="text-sm leading-loose text-muted-foreground text-center">
            Predictions help understand feasibility across different experiment lengths.
          </p>
        </div>
      </footer>
    </div>
  );
}
