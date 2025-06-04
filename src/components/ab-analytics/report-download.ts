
import type { MdeToSampleSizeCalculationResults, SampleSizeToMdeCalculationResults } from '@/lib/types';

function formatNumber(num: number | undefined | null, precision = 0, suffix = ''): string {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision }) + suffix;
}

export function downloadMdeToSampleSizeReport(results: MdeToSampleSizeCalculationResults) {
  let reportContent = "ABalytics - MDE to Sample Size Report (Excel/Platform Data)\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric: ${results.metric || 'N/A'}\n`;
  reportContent += `- Metric Type: ${results.metricType || 'N/A'}\n`;
  reportContent += `- Real Estate: ${results.realEstate || 'N/A'}\n`;
  if (results.lookbackDays) {
    reportContent += `- Historical Data Lookback (from file selection): ${formatNumber(results.lookbackDays)} days\n`;
  }
  reportContent += `- Target MDE: ${formatNumber(results.minimumDetectableEffect ? results.minimumDetectableEffect * 100 : null, 2, '%')}\n`;
  reportContent += `- Target Experiment Duration: ${formatNumber(results.targetExperimentDurationDays)} days\n`;
  reportContent += `- Mean (Historical): ${formatNumber(results.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumber(results.variance, 6)}\n`;
  if (results.historicalDailyTraffic !== undefined) {
    reportContent += `- Historical Daily Traffic (used for calc): ~${formatNumber(results.historicalDailyTraffic, 0)} users/day\n`;
  }
  reportContent += `- Statistical Power: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.significanceLevel ? results.significanceLevel * 100 : null, 0, '%')}\n\n`;
  
  reportContent += "Core Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumber(results.requiredSampleSize)}\n`;
  if (results.exposureNeededPercentage !== undefined) {
      const displayExposure = results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? formatNumber(results.exposureNeededPercentage,1,'%') : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A';
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): ${displayExposure}\n`;
  } else if (results.historicalDailyTraffic && results.historicalDailyTraffic > 0) {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Likely due to high sample size or low traffic for duration)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Missing daily traffic data)\n`;
  }
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0, '%')}\n\n`;

  if (results.durationEstimates && results.durationEstimates.length > 0 && results.historicalDailyTraffic && results.historicalDailyTraffic > 0) {
    reportContent += `Duration vs. Traffic Availability (Estimated Daily Traffic: ~${formatNumber(results.historicalDailyTraffic,0)} users, assuming 100% exposure):\n`;
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
      reportContent += `- ${warning.replace(/_/g, ' ')}\n`;
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
  reportContent += `- Real Estate: ${results.inputs.realEstate || 'N/A'}\n`;
  reportContent += `- Sample Size (per variant): ${formatNumber(results.inputs.sampleSizePerVariant)}\n`;
  reportContent += `- Mean (Historical): ${formatNumber(results.inputs.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumber(results.inputs.variance, 4)}\n`;
  reportContent += `- Statistical Power: ${formatNumber(results.inputs.statisticalPower ? results.inputs.statisticalPower * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.inputs.significanceLevel ? results.inputs.significanceLevel * 100 : null, 0, '%')}\n\n`;

  reportContent += "Calculated Results:\n";
  reportContent += `- Achievable MDE (Relative): ${formatNumber(results.achievableMde, 2, '%')}\n`;
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0, '%')}\n`;
  reportContent += `- Power Level Used: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0, '%')}\n\n`;


  if (results.warnings && results.warnings.length > 0) {
    reportContent += "Notices from Calculation:\n";
    results.warnings.forEach(warning => {
      reportContent += `- ${warning.replace(/_/g, ' ')}\n`;
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


export function downloadManualCalculatorReport(results: MdeToSampleSizeCalculationResults) {
  let reportContent = "ABalytics - Manual Sample Size Calculator Report\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric Type: ${results.metricType || (results.metric?.split(' - ')[1] || 'N/A')}\n`;
  reportContent += `- Target MDE: ${formatNumber(results.minimumDetectableEffect ? results.minimumDetectableEffect * 100 : null, 2, '%')}\n`;
  reportContent += `- Mean (Baseline): ${formatNumber(results.mean, 4)}\n`;
  reportContent += `- Variance: ${formatNumber(results.variance, 6)}\n`; // Higher precision for variance if p*(1-p)
  reportContent += `- Historical Daily Traffic: ${formatNumber(results.historicalDailyTraffic, 0)}\n`;
  if (results.targetExperimentDurationDays !== undefined) {
    reportContent += `- Target Experiment Duration: ${formatNumber(results.targetExperimentDurationDays, 0)} days\n`;
  }
  reportContent += `- Statistical Power: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.significanceLevel ? results.significanceLevel * 100 : null, 0, '%')}\n\n`;
  
  reportContent += "Core Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumber(results.requiredSampleSize)}\n`;
   if (results.exposureNeededPercentage !== undefined) {
      const displayExposure = results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? formatNumber(results.exposureNeededPercentage,1,'%') : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A';
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): ${displayExposure}\n`;
  } else if (results.historicalDailyTraffic && results.historicalDailyTraffic > 0) {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Likely high sample size/low traffic)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Missing daily traffic data)\n`;
  }
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0, '%')}\n\n`;

  if (results.durationEstimates && results.durationEstimates.length > 0 && results.historicalDailyTraffic && results.historicalDailyTraffic > 0) {
    reportContent += `Duration vs. Traffic Availability (Based on ${formatNumber(results.historicalDailyTraffic,0)} daily users, assuming 100% exposure):\n`;
    reportContent += "Weeks | Total Users Available (Est.) | Sufficient for Test?\n";
    reportContent += "------|------------------------------|---------------------\n";
    results.durationEstimates.forEach(row => {
      reportContent += `${formatNumber(row.weeks).padEnd(5)} | ${formatNumber(row.totalUsersAvailable).padEnd(28)} | ${row.isSufficient ? 'Yes' : 'No'}\n`;
    });
    reportContent += "\n";

    // This specific check for target duration seems redundant here as exposure % covers it
    // if (results.targetExperimentDurationDays && results.requiredSampleSize && results.historicalDailyTraffic) {
    //     const usersInTarget = results.historicalDailyTraffic * results.targetExperimentDurationDays;
    //     const isSufficientInTarget = usersInTarget >= results.requiredSampleSize * 2;
    //     reportContent += `For your target duration of ${results.targetExperimentDurationDays} days:\n`;
    //     reportContent += `- Estimated users available: ${formatNumber(usersInTarget)}\n`;
    //     reportContent += `- Sufficient for test: ${isSufficientInTarget ? 'Yes' : 'No'}\n\n`;
    // }
  }

  if (results.warnings && results.warnings.length > 0) {
    reportContent += "Notices from Calculation:\n";
    results.warnings.forEach(warning => {
      reportContent += `- ${warning.replace(/_/g, ' ')}\n`;
    });
  }

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_manual_calculator_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
