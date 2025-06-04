
import type { SampleSizeCalculationResults, MdeExplorerFormValues, MdeExplorerResults } from '@/lib/types';

function formatNumber(num: number | undefined | null, precision = 0): string {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

export function downloadSampleSizeReport(results: SampleSizeCalculationResults) {
  let reportContent = "ABalytics - Sample Size Calculation Report\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric: ${results.metric || 'N/A'}\n`;
  reportContent += `- Mean (Historical): ${formatNumber(results.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumber(results.variance, 4)}\n`;
  reportContent += `- Lookback Days: ${formatNumber(results.lookbackDays)}\n`;
  reportContent += `- Real Estate: ${results.realEstate || 'N/A'}\n`;
  reportContent += `- Number of Users (in Lookback): ${formatNumber(results.numberOfUsers)}\n`;
  reportContent += `- Minimum Detectable Effect (MDE): ${formatNumber(results.minimumDetectableEffect ? results.minimumDetectableEffect * 100 : null, 2)}%\n`;
  reportContent += `- Statistical Power: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0)}%\n`; // powerLevel is from AI output
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.significanceLevel ? results.significanceLevel * 100 : null, 0)}%\n\n`; // significanceLevel is from form
  
  reportContent += "Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumber(results.requiredSampleSize)}\n`;
  reportContent += `- Estimated Test Duration: ${results.estimatedTestDuration ? `${Math.ceil(results.estimatedTestDuration)} days` : 'N/A'}\n`;
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0)}%\n`;
  reportContent += `- Power Level (as calculated): ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0)}%\n\n`;

  if (results.warnings && results.warnings.length > 0) {
    reportContent += "Warnings:\n";
    results.warnings.forEach(warning => {
      reportContent += `- ${warning}\n`;
    });
  }

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_sample_size_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}


export function downloadMdeExplorerReport(input: MdeExplorerFormValues, results: MdeExplorerResults) {
  let reportContent = "ABalytics - MDE Explorer Report\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric: ${input.metric || 'N/A'}\n`;
  reportContent += `- Mean (Historical): ${formatNumber(input.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumber(input.variance, 4)}\n`;
  reportContent += `- Lookback Days: ${formatNumber(input.lookbackDays)}\n`;
  reportContent += `- Real Estate: ${input.realEstate || 'N/A'}\n`;
  reportContent += `- Number of Users (in Lookback): ${formatNumber(input.numberOfUsers)}\n`;
  reportContent += `- Statistical Power: ${formatNumber(input.statisticalPower ? input.statisticalPower * 100 : null, 0)}%\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(input.significanceLevel ? input.significanceLevel * 100 : null, 0)}%\n`;
  reportContent += `- Explored Durations (Weeks): ${input.experimentDurations?.join(', ') || 'N/A'}\n\n`;

  reportContent += "Results Table:\n";
  if (results.tableData.length > 0) {
    reportContent += "Weeks | Total Users | Achievable MDE (%) | Confidence (%) | Power (%)\n";
    reportContent += "------|-------------|--------------------|----------------|----------\n";
    results.tableData.forEach(row => {
      reportContent += `${formatNumber(row.weeks).padEnd(5)} | ${formatNumber(row.totalUsers).padEnd(11)} | ${formatNumber(row.achievableMde, 2).padEnd(18)} | ${formatNumber(row.confidence, 0).padEnd(14)} | ${formatNumber(row.power, 0)}\n`;
    });
    reportContent += "\n";
  } else {
    reportContent += "No table data generated for the selected inputs and durations.\n\n"
  }


  if (results.warnings && results.warnings.length > 0) {
    reportContent += "Warnings/Notices:\n";
    results.warnings.forEach(warning => {
      reportContent += `- ${warning}\n`;
    });
  }

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_mde_explorer_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

