
import type { 
    MdeToSampleSizeCalculationResults, 
    SampleSizeToMdeCalculationResults, 
    MdeDurationPredictorFormValues, 
    MdeDurationPredictorResultRow,
    FixedDurationCalculatorResults 
} from '@/lib/types';

function formatNumberForReport(num: number | undefined | null | string, precision = 0, suffix = ''): string {
  if (num === undefined || num === null || num === 'N/A' || num === 'Error') return String(num);
  if (typeof num === 'string') {
    const parsedNum = parseFloat(num);
    if (isNaN(parsedNum)) return num; 
    num = parsedNum;
  }
  if (isNaN(num)) return 'N/A'; 
  if (num === Infinity && suffix === '%') return '∞%';
  if (num > 1000 && suffix === '%' && num !== Infinity) return '>1000%';
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
      const displayExposure = formatNumberForReport(results.exposureNeededPercentage,1,'%');
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
      const displayExposure = formatNumberForReport(results.exposureNeededPercentage,1,'%');
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
      const displayExposure = formatNumberForReport(results.exposureNeededPercentage,1,'%');
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
  let reportContent = "ABalytics - Dynamic Duration Calculator Report\n\n";
  reportContent += "Common Inputs:\n";
  reportContent += `- Metric: ${formValues.metric || 'N/A'}\n`;
  reportContent += `- Real Estate: ${formValues.realEstate || 'N/A'}\n`;
  reportContent += `- Metric Type: ${formValues.metricType || 'N/A'}\n`;
  if (formValues.minimumDetectableEffect) {
    reportContent += `- Input MDE (%): ${formatNumberForReport(formValues.minimumDetectableEffect, 2, '%')}\n`;
  }
  if (formValues.sampleSizePerVariant) {
    reportContent += `- Input Sample Size (per variant): ${formatNumberForReport(formValues.sampleSizePerVariant, 0)}\n`;
  }
  reportContent += `- Number of Variants: ${formatNumberForReport(formValues.numberOfVariants, 0)}\n`;
  reportContent += `- Statistical Power: ${formatNumberForReport(formValues.statisticalPower * 100, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha): ${formatNumberForReport(formValues.significanceLevel * 100, 0, '%')}\n\n`;
  
  reportContent += "Note: Mean, Variance, and Total Users are sourced from the uploaded Excel file for each specific duration.\n\n";

  reportContent += "Predictions Across Durations:\n";
  reportContent += "------------------------------------------------------------------------------------------------------------------\n";
  const calculationMode = results[0]?.calculationMode;
  if (calculationMode === 'mdeToSs') {
    reportContent += "Duration | Total Users Available | Total Req. Sample Size | Exposure Needed (%) | Notices\n";
  } else {
    reportContent += "Duration | Total Users Available | Achievable MDE (%)     | Exposure Needed (%) | Notices\n";
  }
  reportContent += "------------------------------------------------------------------------------------------------------------------\n";

  results.forEach(row => {
    const exposure = formatNumberForReport(row.exposureNeededPercentage, 1, '%');
    const notices = (row.warnings || []).map(w => w.replace(/_/g, ' ')).join(', ') || '-';

    reportContent += `${String(row.duration).padEnd(8)} | `;
    reportContent += `${formatNumberForReport(row.totalUsersAvailable, 0).padEnd(21)} | `;
    if (row.calculationMode === 'mdeToSs') {
      reportContent += `${formatNumberForReport(row.totalRequiredSampleSize, 0).padEnd(22)} | `; 
    } else {
      reportContent += `${formatNumberForReport(row.achievableMde, 2, '%').padEnd(22)} | `;
    }
    reportContent += `${exposure.padEnd(19)} | `;
    reportContent += `${notices}\n`; 
  });
  reportContent += "------------------------------------------------------------------------------------------------------------------\n";

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_dynamic_duration_calculator_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// New report function for Fixed Duration Calculator
export function downloadFixedDurationCalculatorReport(results: FixedDurationCalculatorResults) {
  let reportContent = "ABalytics - Fixed Duration Calculator Report\n\n";
  const { inputs, calculationMode, calculatedMde, calculatedSampleSizePerVariant, totalCalculatedSampleSizeForExperiment, exposureNeededPercentage, warnings } = results;

  reportContent += "Inputs Provided:\n";
  reportContent += `- Metric: ${inputs.metric || 'N/A'}\n`;
  reportContent += `- Metric Type: ${inputs.metricType || 'N/A'}\n`;
  reportContent += `- Real Estate: ${inputs.realEstate || 'N/A'}\n`;
  reportContent += `- Exp Duration (Days): ${formatNumberForReport(inputs.targetExperimentDurationDays)}\n`;
  reportContent += `- Mean (Historical): ${formatNumberForReport(inputs.mean, 4)}\n`;
  reportContent += `- Variance (Historical): ${formatNumberForReport(inputs.variance, 6)}\n`;
  reportContent += `- Total Users for Target Duration: ${formatNumberForReport(inputs.totalUsersInSelectedDuration, 0)} users\n`;
  reportContent += `- Number of Variants: ${formatNumberForReport(inputs.numberOfVariants, 0)}\n`;
  reportContent += `- Statistical Power Used: ${formatNumberForReport(inputs.statisticalPower * 100, 0, '%')}\n`;
  reportContent += `- Significance Level (Alpha) Used: ${formatNumberForReport(inputs.significanceLevel * 100, 0, '%')}\n`;

  if (calculationMode === 'ssToMde' && inputs.sampleSizePerVariant) {
    reportContent += `- Input Sample Size (per variant): ${formatNumberForReport(inputs.sampleSizePerVariant)}\n\n`;
    reportContent += "Calculated Result:\n";
    reportContent += `- Achievable MDE (Relative %): ${formatNumberForReport(calculatedMde, 2, '%')}\n`;
  } else if (calculationMode === 'mdeToSs' && inputs.minimumDetectableEffect) { 
    reportContent += `- Input MDE (%): ${formatNumberForReport(inputs.minimumDetectableEffect, 2, '%')}\n\n`;
    reportContent += "Calculated Results:\n";
    reportContent += `- Required Sample Size (per variant): ${formatNumberForReport(calculatedSampleSizePerVariant)}\n`;
    if (totalCalculatedSampleSizeForExperiment !== undefined) {
        reportContent += `- Total Required Sample Size (${inputs.numberOfVariants} variants): ${formatNumberForReport(totalCalculatedSampleSizeForExperiment)}\n`;
    }
  }
  
  if (exposureNeededPercentage !== undefined) {
      const displayExposure = formatNumberForReport(exposureNeededPercentage, 1, '%');
      reportContent += `- Exposure Needed for Target Duration (${inputs.targetExperimentDurationDays} days): ${displayExposure}\n`;
  } else if (inputs.totalUsersInSelectedDuration && inputs.totalUsersInSelectedDuration > 0) {
      reportContent += `- Exposure Needed for Target Duration (${inputs.targetExperimentDurationDays} days): N/A (Could not calculate exposure)\n`;
  } else {
      reportContent += `- Exposure Needed for Target Duration (${inputs.targetExperimentDurationDays} days): N/A (Missing total users data for the duration)\n`;
  }


  if (warnings && warnings.length > 0) {
    reportContent += "\nNotices from Calculation:\n";
    warnings.forEach(warning => {
      reportContent += `- ${warning.replace(/_/g, ' ')}\n`;
    });
  }

  const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "abalytics_fixed_duration_calculator_report.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
