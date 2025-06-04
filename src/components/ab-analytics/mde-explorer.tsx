
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { MdeExplorerFormSchema, type MdeExplorerFormValues, type MdeExplorerResults } from "@/lib/types";
import { calculateMdeDataAction } from "@/actions/ab-analytics-actions";
import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, BarChart2, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { METRIC_OPTIONS, REAL_ESTATE_OPTIONS, DEFAULT_LOOKBACK_DAYS, DEFAULT_STATISTICAL_POWER, DEFAULT_SIGNIFICANCE_LEVEL } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line } from 'recharts';

const durationOptions = [
  { id: "1", label: "1 Week" },
  { id: "2", label: "2 Weeks" },
  { id: "3", label: "3 Weeks" },
  { id: "4", label: "4 Weeks" },
  { id: "5", label: "5 Weeks" },
  { id: "6", label: "6 Weeks" },
  { id: "7", label: "7 Weeks" },
  { id: "8", label: "8 Weeks" },
];

export function MdeExplorer() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MdeExplorerResults | null>(null);
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('chart');

  const form = useForm<MdeExplorerFormValues>({
    resolver: zodResolver(MdeExplorerFormSchema),
    defaultValues: {
      metric: METRIC_OPTIONS[0],
      mean: undefined,
      variance: undefined,
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
      realEstate: REAL_ESTATE_OPTIONS[0],
      numberOfUsers: undefined,
      statisticalPower: DEFAULT_STATISTICAL_POWER,
      significanceLevel: DEFAULT_SIGNIFICANCE_LEVEL,
      experimentDurations: [2, 4], // Default selected durations
    },
  });

  async function onSubmit(values: MdeExplorerFormValues) {
    setIsLoading(true);
    setResults(null);
    try {
      const MDEData = await calculateMdeDataAction(values);
      setResults(MDEData);
      toast({
        title: "MDE Calculation Successful",
        description: "Achievable MDEs for selected durations calculated.",
      });
    } catch (error) {
      console.error(error);
      setResults(null);
      toast({
        variant: "destructive",
        title: "MDE Calculation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Effect to handle transitions and animations for chart/table
  useEffect(() => {
    // Placeholder for potential animation logic on viewMode change or results update
  }, [viewMode, results]);

  return (
    <div className="space-y-8">
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">MDE Explorer Inputs</CardTitle>
          <p className="text-muted-foreground">Explore achievable Minimum Detectable Effect (MDE) based on experiment duration.</p>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <Separator />
              <p className="text-sm text-muted-foreground">Enter historical data:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FormField control={form.control} name="mean" render={({ field }) => (
                    <FormItem><FormLabel>Mean (Historical)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.15" {...field} step="any"/></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="variance" render={({ field }) => (
                    <FormItem><FormLabel>Variance (Historical)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.1275" {...field} step="any"/></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="numberOfUsers" render={({ field }) => (
                    <FormItem><FormLabel>Number of Users (in Lookback)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100000" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                 <FormField control={form.control} name="lookbackDays" render={({ field }) => (
                    <FormItem><FormLabel>Lookback Days</FormLabel><FormControl><Input type="number" placeholder="e.g., 30" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>

              <Separator />
              <p className="text-sm text-muted-foreground">Select experiment durations and statistical parameters:</p>

              <FormField
                control={form.control}
                name="experimentDurations"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Experiment Duration (Weeks)</FormLabel>
                      <FormDescription>Select one or more durations to explore.</FormDescription>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {durationOptions.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="experimentDurations"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={item.id}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(parseInt(item.id))}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), parseInt(item.id)])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== parseInt(item.id)
                                          )
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {item.label}
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="statisticalPower" render={({ field }) => (
                    <FormItem><FormLabel>Statistical Power (1 - β)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.8" {...field} step="0.01" min="0.01" max="0.99" /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={form.control} name="significanceLevel" render={({ field }) => (
                    <FormItem><FormLabel>Significance Level (α)</FormLabel><FormControl><Input type="number" placeholder="e.g., 0.05" {...field} step="0.01" min="0.01" max="0.99" /></FormControl><FormMessage /></FormItem>
                )}/>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Explore MDE
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {results && (
        <Card className="mt-8 w-full shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="font-headline text-2xl">MDE Exploration Results</CardTitle>
              <div className="flex gap-2">
                <Button variant={viewMode === 'chart' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('chart')}><BarChart2 className="mr-2 h-4 w-4"/>Chart</Button>
                <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}><ListChecks className="mr-2 h-4 w-4"/>Table</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {results.warnings && results.warnings.length > 0 && (
              <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                <h3 className="font-medium text-lg flex items-center text-destructive">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Notices
                </h3>
                <ul className="list-disc list-inside space-y-1 pl-2 text-destructive">
                  {results.warnings.map((warning, index) => (
                    <li key={index} className="text-sm">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {viewMode === 'chart' && results.chartData && results.chartData.length > 0 && (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="weeks" unit=" wks" stroke="hsl(var(--foreground))" />
                    <YAxis dataKey="mde" unit="%" stroke="hsl(var(--foreground))" domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(value) => value.toFixed(1)}/>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }}/>
                    <Line type="monotone" dataKey="mde" name="Achievable MDE" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6, style: { fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))' } }} dot={{ fill: 'hsl(var(--primary))', r:4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            
            {viewMode === 'table' && results.tableData && results.tableData.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Weeks</TableHead>
                    <TableHead>Total Users</TableHead>
                    <TableHead>Achievable MDE (%)</TableHead>
                    <TableHead>Confidence (%)</TableHead>
                    <TableHead>Power (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.tableData.map((row) => (
                    <TableRow key={row.weeks}>
                      <TableCell>{row.weeks}</TableCell>
                      <TableCell>{row.totalUsers.toLocaleString()}</TableCell>
                      <TableCell className="text-primary font-semibold">{row.achievableMde.toFixed(2)}%</TableCell>
                      <TableCell>{row.confidence.toFixed(0)}%</TableCell>
                      <TableCell>{row.power.toFixed(0)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {((viewMode === 'table' && (!results.tableData || results.tableData.length === 0)) || (viewMode === 'chart' && (!results.chartData || results.chartData.length === 0))) && !isLoading && (
                <p className="text-muted-foreground text-center py-8">No data to display. Please run the calculation with valid inputs and selected durations.</p>
            )}


          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">
              MDE values are estimates. Lower MDE requires larger sample sizes or longer durations.
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
