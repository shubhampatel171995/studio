
import type { MdeToSampleSizeCalculationResults, SampleSizeToMdeCalculationResults } from '@/lib/types';

function formatNumber(num: number | undefined | null, precision = 0): string {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision });
}

export function downloadMdeToSampleSizeReport(results: MdeToSampleSizeCalculationResults) {
  let reportContent = "ABalytics - MDE to Sample Size Report\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric: ${results.metric || 'N/A'}\n`;
  reportContent += `- Target MDE: ${formatNumber(results.minimumDetectableEffect ? results.minimumDetectableEffect * 100 : null, 2)}%\n`;
  reportContent += `- Mean (Historical): ${formatNumber(results.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumber(results.variance, 4)}\n`;
  reportContent += `- Number of Users (in Lookback): ${formatNumber(results.numberOfUsers)}\n`;
  reportContent += `- Lookback Days: ${formatNumber(results.lookbackDays)}\n`;
  reportContent += `- Real Estate: ${results.realEstate || 'N/A'}\n`;
  reportContent += `- Statistical Power: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0)}%\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.significanceLevel ? results.significanceLevel * 100 : null, 0)}%\n\n`;
  
  reportContent += "Core Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumber(results.requiredSampleSize)}\n`;
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0)}%\n\n`;

  if (results.durationEstimates && results.durationEstimates.length > 0) {
    const dailyUsers = results.numberOfUsers && results.lookbackDays && results.lookbackDays > 0 ? results.numberOfUsers / results.lookbackDays : 0;
    reportContent += `Duration vs. Traffic Availability (Estimated Daily Traffic: ~${formatNumber(dailyUsers,0)} users):\n`;
    reportContent += "Weeks | Total Users Available (Est.) | Sufficient for Test?\n";
    reportContent += "------|------------------------------|---------------------\n";
    results.durationEstimates.forEach(row => {
      reportContent += `${formatNumber(row.weeks).padEnd(5)} | ${formatNumber(row.totalUsersAvailable).padEnd(28)} | ${row.isSufficient ? 'Yes' : 'No'}\n`;
    });
    reportContent += "\n";
  }

  if (results.warnings && results.warnings.length > 0) {
    reportContent += "Notices from Calculation:\n";
    results.warnings.forEach(warning => {
      reportContent += `- ${warning}\n`;
    });
  }

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_mde_to_samplesize_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}


export function downloadSampleSizeToMdeReport(results: SampleSizeToMdeCalculationResults) {
  let reportContent = "ABalytics - Sample Size to MDE Report\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric: ${results.inputs.metric || 'N/A'}\n`;
  reportContent += `- Sample Size (per variant): ${formatNumber(results.inputs.sampleSizePerVariant)}\n`;
  reportContent += `- Mean (Historical): ${formatNumber(results.inputs.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumber(results.inputs.variance, 4)}\n`;
  reportContent += `- Real Estate: ${results.inputs.realEstate || 'N/A'}\n`;
  reportContent += `- Statistical Power: ${formatNumber(results.inputs.statisticalPower ? results.inputs.statisticalPower * 100 : null, 0)}%\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.inputs.significanceLevel ? results.inputs.significanceLevel * 100 : null, 0)}%\n\n`;

  reportContent += "Calculated Results:\n";
  reportContent += `- Achievable MDE (Relative): ${formatNumber(results.achievableMde, 2)}%\n`;
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0)}%\n`;
  reportContent += `- Power Level Used: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0)}%\n\n`;


  if (results.warnings && results.warnings.length > 0) {
    reportContent += "Notices from Calculation:\n";
    results.warnings.forEach(warning => {
      reportContent += `- ${warning}\n`;
    });
  }

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_samplesize_to_mde_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
