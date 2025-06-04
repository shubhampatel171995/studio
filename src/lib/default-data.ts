
import type { ExcelDataRow } from '@/lib/types';

export const defaultAbalyticsData: ExcelDataRow[] = [
  // --- Conversion Rate - Homepage Banner ---
  {
    metric: 'Conversion Rate',
    metricType: 'Binary',
    realEstate: 'Homepage Banner',
    lookbackDays: 7,
    mean: 0.05, // 5% CR
    variance: 0.05 * (1 - 0.05),
    totalUsers: 70000,
  },
  {
    metric: 'Conversion Rate',
    metricType: 'Binary',
    realEstate: 'Homepage Banner',
    lookbackDays: 14,
    mean: 0.052,
    variance: 0.052 * (1 - 0.052),
    totalUsers: 145000,
  },
  {
    metric: 'Conversion Rate',
    metricType: 'Binary',
    realEstate: 'Homepage Banner',
    lookbackDays: 21,
    mean: 0.053,
    variance: 0.053 * (1 - 0.053),
    totalUsers: 220000,
  },
  {
    metric: 'Conversion Rate',
    metricType: 'Binary',
    realEstate: 'Homepage Banner',
    lookbackDays: 30,
    mean: 0.055,
    variance: 0.055 * (1 - 0.055),
    totalUsers: 310000,
  },
  // --- Average Order Value - Product Detail Page ---
  {
    metric: 'Average Order Value',
    metricType: 'Continuous',
    realEstate: 'Product Detail Page',
    lookbackDays: 7,
    mean: 150,
    variance: 2500,
    totalUsers: 50000,
  },
  {
    metric: 'Average Order Value',
    metricType: 'Continuous',
    realEstate: 'Product Detail Page',
    lookbackDays: 14,
    mean: 155,
    variance: 2600,
    totalUsers: 105000,
  },
  {
    metric: 'Average Order Value',
    metricType: 'Continuous',
    realEstate: 'Product Detail Page',
    lookbackDays: 21,
    mean: 152,
    variance: 2550,
    totalUsers: 160000,
  },
  {
    metric: 'Average Order Value',
    metricType: 'Continuous',
    realEstate: 'Product Detail Page',
    lookbackDays: 30,
    mean: 158,
    variance: 2700,
    totalUsers: 230000,
  },
  // --- Click-Through Rate - Search Results ---
   {
    metric: 'Click-Through Rate',
    metricType: 'Binary',
    realEstate: 'Search Results',
    lookbackDays: 7,
    mean: 0.10, // 10% CTR
    variance: 0.10 * (1 - 0.10),
    totalUsers: 200000,
  },
  {
    metric: 'Click-Through Rate',
    metricType: 'Binary',
    realEstate: 'Search Results',
    lookbackDays: 14,
    mean: 0.105,
    variance: 0.105 * (1 - 0.105),
    totalUsers: 410000,
  },
  {
    metric: 'Click-Through Rate',
    metricType: 'Binary',
    realEstate: 'Search Results',
    lookbackDays: 21,
    mean: 0.102,
    variance: 0.102 * (1 - 0.102),
    totalUsers: 600000,
  },
  {
    metric: 'Click-Through Rate',
    metricType: 'Binary',
    realEstate: 'Search Results',
    lookbackDays: 30,
    mean: 0.11,
    variance: 0.11 * (1 - 0.11),
    totalUsers: 850000,
  },
  // --- Revenue Per Visitor - Platform Wide ---
  {
    metric: 'Revenue Per Visitor',
    metricType: 'Continuous',
    realEstate: 'platform', // Represents platform-wide
    lookbackDays: 7,
    mean: 5.25,
    variance: 10.5,
    totalUsers: 1000000, // Platform wide often has larger numbers
  },
  {
    metric: 'Revenue Per Visitor',
    metricType: 'Continuous',
    realEstate: 'platform',
    lookbackDays: 14,
    mean: 5.30,
    variance: 10.8,
    totalUsers: 2050000,
  },
   {
    metric: 'Revenue Per Visitor',
    metricType: 'Continuous',
    realEstate: 'platform',
    lookbackDays: 21,
    mean: 5.28,
    variance: 10.6,
    totalUsers: 3000000,
  },
  {
    metric: 'Revenue Per Visitor',
    metricType: 'Continuous',
    realEstate: 'platform',
    lookbackDays: 30,
    mean: 5.35,
    variance: 11.0,
    totalUsers: 4200000,
  }
];
