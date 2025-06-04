
import type { MdeToSampleSizeCalculationResults, SampleSizeToMdeCalculationResults, MdeDurationPredictorFormValues, MdeDurationPredictorResultRow } from '@/lib/types';

function formatNumberForReport(num: number | undefined | null | string, precision = 0, suffix = ''): string {
  if (num === undefined || num === null || num === 'N/A' || num === 'Error') return String(num);
  if (typeof num === 'string') {
    const parsedNum = parseFloat(num);
    if (isNaN(parsedNum)) return num; // Return original string if not a number like "Error"
    num = parsedNum;
  }
  if (isNaN(num)) return 'N/A'; // After potential parse
  return num.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision }) + suffix;
}

export function downloadMdeToSampleSizeReport(results: MdeToSampleSizeCalculationResults) {
  let reportContent = "ABalytics - MDE to Sample Size Report\n\n";
  reportContent += "Inputs:\n";
  reportContent += `- Metric: ${results.metric || 'N/A'}\n`;
  reportContent += `- Metric Type: ${results.metricType || 'N/A'}\n`;
  reportContent += `- Real Estate: ${results.realEstate || 'N/A'}\n`;
  reportContent += `- Exp Duration (Days): ${formatNumberForReport(results.targetExperimentDurationDays)}\n`;
  reportContent += `- MDE (%): ${formatNumberForReport(results.minimumDetectableEffect ? results.minimumDetectableEffect * 100 : null, 2, '%')}\n`;
  reportContent += `- Number of Variants: ${formatNumberForReport(results.numberOfVariants, 0)}\n`;
  reportContent += `- Statistical Power Used: ${formatNumberForReport(results.powerLevel ? results.powerLevel * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha) Used: ${formatNumberForReport(results.significanceLevel ? results.significanceLevel * 100 : null, 0, '%')}\n\n`;

  reportContent += `Historical Data (for ${results.targetExperimentDurationDays} days duration):\n`;
  reportContent += `- Mean (Historical): ${formatNumberForReport(results.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumberForReport(results.variance, 6)}\n`;
  reportContent += `- Total Users for Target Duration: ${formatNumberForReport(results.totalUsersInSelectedDuration, 0)} users\n\n`;
  
  reportContent += "Core Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumberForReport(results.requiredSampleSizePerVariant)}\n`;
  if (results.requiredSampleSizePerVariant && results.numberOfVariants) {
    reportContent += `- Total Required Sample Size (${results.numberOfVariants} variants): ${formatNumberForReport(results.requiredSampleSizePerVariant * results.numberOfVariants)}\n`;
  }

  if (results.exposureNeededPercentage !== undefined) {
      const displayExposure = results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? formatNumberForReport(results.exposureNeededPercentage,1,'%') : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A';
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): ${displayExposure}\n`;
  } else if (results.totalUsersInSelectedDuration && results.totalUsersInSelectedDuration > 0) {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Likely due to high sample size or calculation issue)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Missing total users data for the duration)\n`;
  }

  if (results.warnings && results.warnings.length > 0) {
    reportContent += "\nNotices from Calculation:\n";
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
  reportContent += `- Metric Type: ${results.inputs.metricType || 'N/A'}\n`;
  reportContent += `- Real Estate: ${results.inputs.realEstate || 'N/A'}\n`;
  reportContent += `- Exp Duration (Days, for data context): ${formatNumberForReport(results.inputs.targetExperimentDurationDays)}\n`;
  reportContent += `- Sample Size (per variant): ${formatNumberForReport(results.inputs.sampleSizePerVariant)}\n`;
  reportContent += `- Number of Variants: ${formatNumberForReport(results.inputs.numberOfVariants, 0)}\n`;
  reportContent += `- Statistical Power Used: ${formatNumberForReport(results.inputs.statisticalPower ? results.inputs.statisticalPower * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha) Used: ${formatNumberForReport(results.inputs.significanceLevel ? results.inputs.significanceLevel * 100 : null, 0, '%')}\n\n`;
  
  reportContent += `Historical Data (for ${results.inputs.targetExperimentDurationDays} days duration context):\n`;
  reportContent += `- Mean (Historical): ${formatNumberForReport(results.inputs.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumberForReport(results.inputs.variance, 6)}\n`;
  reportContent += `- Total Users for Exp Duration (context): ${formatNumberForReport(results.inputs.totalUsersInSelectedDuration, 0)} users\n\n`;

  reportContent += "Calculated Results:\n";
  reportContent += `- Achievable MDE (Relative): ${formatNumberForReport(results.achievableMde, 2, '%')}\n`;
  
  if (results.exposureNeededPercentage !== undefined && results.inputs.totalUsersInSelectedDuration) {
      const displayExposure = results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? formatNumberForReport(results.exposureNeededPercentage,1,'%') : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A';
      reportContent += `- Exposure Needed for Target Duration (${results.inputs.targetExperimentDurationDays} days): ${displayExposure}\n`;
  } else if (results.inputs.totalUsersInSelectedDuration && results.inputs.totalUsersInSelectedDuration > 0) {
      reportContent += `- Exposure Needed for Target Duration (${results.inputs.targetExperimentDurationDays} days): N/A (Could not calculate exposure)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${results.inputs.targetExperimentDurationDays} days): N/A (Missing total users data for the duration)\n`;
  }


  if (results.warnings && results.warnings.length > 0) {
    reportContent += "\nNotices from Calculation:\n";
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
  reportContent += `- MDE (%): ${formatNumberForReport(results.minimumDetectableEffect ? results.minimumDetectableEffect * 100 : null, 2, '%')}\n`;
  reportContent += `- Mean (Baseline): ${formatNumberForReport(results.mean, 4)}\n`;
  reportContent += `- Variance: ${formatNumberForReport(results.variance, 6)}\n`; 
  reportContent += `- Number of Variants: ${formatNumberForReport(results.numberOfVariants, 0)}\n`;
  reportContent += `- Historical Daily Traffic: ${formatNumberForReport(results.historicalDailyTraffic, 0)}\n`; 
  if (results.targetExperimentDurationDays !== undefined) {
    reportContent += `- Exp Duration (Days): ${formatNumberForReport(results.targetExperimentDurationDays, 0)} days\n`;
  }
  reportContent += `- Statistical Power Used: ${formatNumberForReport(results.powerLevel ? results.powerLevel * 100 : null, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha) Used: ${formatNumberForReport(results.significanceLevel ? results.significanceLevel * 100 : null, 0, '%')}\n\n`;
  
  reportContent += "Core Results:\n";
  reportContent += `- Required Sample Size (per variant): ${formatNumberForReport(results.requiredSampleSizePerVariant)}\n`;
  if (results.requiredSampleSizePerVariant && results.numberOfVariants) {
    reportContent += `- Total Required Sample Size (${results.numberOfVariants} variants): ${formatNumberForReport(results.requiredSampleSizePerVariant * results.numberOfVariants)}\n`;
  }
   if (results.exposureNeededPercentage !== undefined) {
      const displayExposure = results.exposureNeededPercentage >=0 && results.exposureNeededPercentage <= 1000 ? formatNumberForReport(results.exposureNeededPercentage,1,'%') : results.exposureNeededPercentage > 1000 ? '>1000%' : 'N/A';
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): ${displayExposure}\n`;
  } else if (results.historicalDailyTraffic && results.historicalDailyTraffic > 0) {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Likely high sample size/low traffic)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${results.targetExperimentDurationDays} days): N/A (Missing daily traffic data)\n`;
  }

  if (results.warnings && results.warnings.length > 0) {
    reportContent += "\nNotices from Calculation:\n";
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

export function downloadMdeDurationPredictorReport(formValues: MdeDurationPredictorFormValues, results: MdeDurationPredictorResultRow[]) {
  let reportContent = "ABalytics - MDE to Duration Predictor Report\n\n";
  reportContent += "Common Inputs:\n";
  reportContent += `- Metric: ${formValues.metric || 'N/A'}\n`;
  reportContent += `- Real Estate: ${formValues.realEstate || 'N/A'}\n`;
  reportContent += `- Metric Type: ${formValues.metricType || 'N/A'}\n`;
  reportContent += `- MDE (%): ${formatNumberForReport(formValues.minimumDetectableEffect, 2, '%')}\n`;
  reportContent += `- Number of Variants: ${formatNumberForReport(formValues.numberOfVariants, 0)}\n`;
  reportContent += `- Statistical Power: ${formatNumberForReport(formValues.statisticalPower * 100, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumberForReport(formValues.significanceLevel * 100, 0, '%')}\n\n`;
  
  reportContent += "Baseline Historical Data (used if specific duration data not found in uploaded file):\n";
  reportContent += `- Mean (Baseline/Default): ${formatNumberForReport(formValues.meanBaseline, 4)}\n`;
  reportContent += `- Variance (Baseline/Default): ${formatNumberForReport(formValues.varianceBaseline, 6)}\n`;
  reportContent += `- Historical Daily Traffic (Baseline): ${formatNumberForReport(formValues.historicalDailyTrafficBaseline, 0) || 'N/A'}\n\n`;

  reportContent += "Duration Predictions:\n";
  reportContent += "--------------------------------------------------------------------------------------------------------------------\n";
  reportContent += "Duration | Mean Used | Variance Used | Total Users Available | Req. Sample/Variant | Total Req. Sample | Exposure Needed (%) | Notices\n";
  reportContent += "--------------------------------------------------------------------------------------------------------------------\n";

  results.forEach(row => {
    const exposure = row.exposureNeededPercentage === undefined || row.exposureNeededPercentage === null || (typeof row.exposureNeededPercentage === 'number' && isNaN(row.exposureNeededPercentage))
                    ? "N/A"
                    : (typeof row.exposureNeededPercentage === 'number' && row.exposureNeededPercentage > 1000 ? ">1000%" : formatNumberForReport(row.exposureNeededPercentage, 1, '%'));

    reportContent += `${String(row.duration).padEnd(8)} | `;
    reportContent += `${formatNumberForReport(row.meanUsed, 4).padEnd(10)} | `;
    reportContent += `${formatNumberForReport(row.varianceUsed, 6).padEnd(13)} | `;
    reportContent += `${formatNumberForReport(row.totalUsersAvailable, 0).padEnd(21)} | `;
    reportContent += `${formatNumberForReport(row.requiredSampleSizePerVariant, 0).padEnd(19)} | `;
    reportContent += `${formatNumberForReport(row.totalRequiredSampleSize, 0).padEnd(19)} | `;
    reportContent += `${exposure.padEnd(19)} | `;
    reportContent += `${(row.warnings || []).join(', ').replace(/_/g, ' ')}\n`;
  });
  reportContent += "--------------------------------------------------------------------------------------------------------------------\n";

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_mde_duration_predictor_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
