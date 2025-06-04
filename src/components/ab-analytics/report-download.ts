
import type { MdeToSampleSizeCalculationResults, SampleSizeToMdeCalculationResults } from '@/lib/types';

function formatNumber(num: number | undefined | null, precision = 0, suffix = ''): string {
  if (num === undefined || num === null || isNaN(num)) return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision }) + suffix;
}

export function downloadMdeToSampleSizeReport(results: MdeToSampleSizeCalculationResults) {
  let reportContent = "ABalytics - MDE to Sample Size Report\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric: ${results.metric || 'N/A'}\n`;
  reportContent += `- Metric Type: ${results.metricType || 'N/A'}\n`;
  reportContent += `- Real Estate: ${results.realEstate || 'N/A'}\n`;
  
  const lookbackContext = results.lookbackDays || results.targetExperimentDurationDays; 
  reportContent += `- Target Experiment Duration / Historical Data Lookback Used: ${formatNumber(lookbackContext)} days\n`;
  
  reportContent += `- Target MDE: ${formatNumber(results.minimumDetectableEffect ? results.minimumDetectableEffect * 100 : null, 2, '%')}\n`;
  reportContent += `- Mean (Historical, for selected lookback/duration): ${formatNumber(results.mean, 4)}\n`;
  reportContent += `- Variance (Historical, for selected lookback/duration): ${formatNumber(results.variance, 6)}\n`;
  reportContent += `- Number of Variants: ${formatNumber(results.numberOfVariants, 0)}\n`;
  
  let trafficSourceNote = "(manual input or no file match for target duration)";
  if (results.realEstate && results.metric && results.lookbackDays === results.targetExperimentDurationDays && results.totalUsersInSelectedDuration !== undefined) {
    trafficSourceNote = `(from uploaded file for the ${formatNumber(results.targetExperimentDurationDays)} days target duration)`;
  }
  
  if (results.totalUsersInSelectedDuration !== undefined) {
    reportContent += `- Total Users for Target Duration ${trafficSourceNote}: ${formatNumber(results.totalUsersInSelectedDuration, 0)} users\n`;
  }


  reportContent += `- Statistical Power: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.significanceLevel ? results.significanceLevel * 100 : null, 0, '%')}\n\n`;
  
  reportContent += "Core Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumber(results.requiredSampleSizePerVariant)}\n`;
  if (results.requiredSampleSizePerVariant && results.numberOfVariants) {
    reportContent += `- Total Required Sample Size (${results.numberOfVariants} variants): ${formatNumber(results.requiredSampleSizePerVariant * results.numberOfVariants)}\n`;
  }

  if (results.exposureNeededPercentage !== undefined) {
      const displayExposure = results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? formatNumber(results.exposureNeededPercentage,1,'%') : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A';
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days, ${results.numberOfVariants} variants): ${displayExposure}\n`;
  } else if (results.totalUsersInSelectedDuration && results.totalUsersInSelectedDuration > 0) {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days, ${results.numberOfVariants} variants): N/A (Likely due to high sample size or low traffic for duration)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days, ${results.numberOfVariants} variants): N/A (Missing total users data for the duration)\n`;
  }
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0, '%')}\n\n`;


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
  reportContent += `- Variance: ${formatNumber(results.variance, 6)}\n`; 
  reportContent += `- Number of Variants: ${formatNumber(results.numberOfVariants, 0)}\n`;
  reportContent += `- Historical Daily Traffic: ${formatNumber(results.historicalDailyTraffic, 0)}\n`;
  if (results.targetExperimentDurationDays !== undefined) {
    reportContent += `- Target Experiment Duration: ${formatNumber(results.targetExperimentDurationDays, 0)} days\n`;
  }
  reportContent += `- Statistical Power: ${formatNumber(results.powerLevel ? results.powerLevel * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumber(results.significanceLevel ? results.significanceLevel * 100 : null, 0, '%')}\n\n`;
  
  reportContent += "Core Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumber(results.requiredSampleSizePerVariant)}\n`;
  if (results.requiredSampleSizePerVariant && results.numberOfVariants) {
    reportContent += `- Total Required Sample Size (${results.numberOfVariants} variants): ${formatNumber(results.requiredSampleSizePerVariant * results.numberOfVariants)}\n`;
  }
   if (results.exposureNeededPercentage !== undefined) {
      const displayExposure = results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? formatNumber(results.exposureNeededPercentage,1,'%') : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A';
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days, ${results.numberOfVariants} variants): ${displayExposure}\n`;
  } else if (results.historicalDailyTraffic && results.historicalDailyTraffic > 0) {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days, ${results.numberOfVariants} variants): N/A (Likely high sample size/low traffic)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days, ${results.numberOfVariants} variants): N/A (Missing daily traffic data)\n`;
  }
  reportContent += `- Confidence Level: ${formatNumber(results.confidenceLevel ? results.confidenceLevel * 100 : null, 0, '%')}\n\n`;


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
