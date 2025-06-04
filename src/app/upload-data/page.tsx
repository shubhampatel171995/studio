
import { ExcelDataUploader } from '@/components/ab-analytics/excel-data-uploader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UploadDataPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
       <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-foreground">
              Upload & Map Data
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Calculator
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <Card className="w-full max-w-2xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Upload Historical Data File</CardTitle>
            <CardDescription>
              Upload an Excel (XLSX, XLS) or CSV file containing your historical A/B test data.
              You will then map your file's columns to the expected fields.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExcelDataUploader />
          </CardContent>
        </Card>
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-20 md:flex-row">
          <p className="text-sm leading-loose text-muted-foreground text-center">
            Ensure your file has clear column headers for easy mapping.
          </p>
        </div>
      </footer>
    </div>
  );
}
