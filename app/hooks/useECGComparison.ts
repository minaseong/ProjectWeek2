import { useState, useEffect } from 'react';
import { ECGDataPoint } from '@/hooks/useHeartRateSensor';
import { ECGComparisonMetrics, ANALYSIS_WINDOW_SIZE } from '@/types/ecg';
import { useECGAnalysis } from './useECGAnalysis';
import { ActivitySegment } from '@/hooks/useMongoDB';

export function useECGComparison(
  baselineECG: ECGDataPoint[],
  currentECG: ECGDataPoint[],
  activitySegments?: ActivitySegment[]
) {
  const [comparisonMetrics, setComparisonMetrics] = useState<ECGComparisonMetrics>({
    // Include base ECG metrics
    heartRate: 0,
    heartRateVariability: 0,
    qtInterval: 0,
    stSegment: {
      elevation: 0,
      duration: 0
    },
    rPeaks: [],
    qrsComplex: {
      duration: 0,
      amplitude: 0
    },
    // Additional comparison metrics
    heartRateRecovery: 0,
    stDeviation: 0,
    hrvChange: 0,
    qtChange: 0
  });

  // Use the base ECG analysis hook for both baseline and current ECG
  const baselineMetrics = useECGAnalysis(baselineECG);
  const currentMetrics = useECGAnalysis(currentECG);

  // Get current activity type if available
  const getCurrentActivityType = (timestamp: number): string | null => {
    if (!activitySegments) return null;
    const currentSegment = activitySegments.find(
      segment => timestamp >= segment.start && timestamp <= segment.end
    );
    return currentSegment?.type || null;
  };

  // Calculate heart rate recovery based on activity type
  const calculateHRRecovery = (): number => {
    if (baselineMetrics.heartRate === 0 || currentMetrics.heartRate === 0) return 0;
    
    // Get the current activity type
    const currentActivity = getCurrentActivityType(Date.now());
    
    // Different recovery calculations based on activity
    if (currentActivity === 'rest') {
      return Math.max(0, currentMetrics.heartRate - baselineMetrics.heartRate);
    } else if (currentActivity === 'walk') {
      return Math.max(0, currentMetrics.heartRate - baselineMetrics.heartRate) * 1.5;
    } else if (currentActivity === 'run') {
      return Math.max(0, currentMetrics.heartRate - baselineMetrics.heartRate) * 2;
    }
    
    return Math.max(0, currentMetrics.heartRate - baselineMetrics.heartRate);
  };

  // Calculate ST segment deviation with activity context
  const calculateSTDeviation = (): number => {
    const deviation = currentMetrics.stSegment.elevation - baselineMetrics.stSegment.elevation;
    const currentActivity = getCurrentActivityType(Date.now());
    
    // Adjust expected deviation based on activity
    if (currentActivity === 'rest') {
      return deviation;
    } else if (currentActivity === 'walk') {
      return deviation * 1.2;
    } else if (currentActivity === 'run') {
      return deviation * 1.5;
    }
    
    return deviation;
  };

  // Calculate HRV change as a percentage
  const calculateHRVChange = (): number => {
    if (baselineMetrics.heartRateVariability === 0) return 0;
    return ((currentMetrics.heartRateVariability - baselineMetrics.heartRateVariability) /
      baselineMetrics.heartRateVariability) * 100;
  };

  // Calculate QT interval change as a percentage
  const calculateQTChange = (): number => {
    if (baselineMetrics.qtInterval === 0) return 0;
    return ((currentMetrics.qtInterval - baselineMetrics.qtInterval) /
      baselineMetrics.qtInterval) * 100;
  };

  useEffect(() => {
    // Only update if we have both baseline and current data
    if (baselineECG.length < ANALYSIS_WINDOW_SIZE || currentECG.length < ANALYSIS_WINDOW_SIZE) {
      return;
    }

    setComparisonMetrics({
      // Include current ECG metrics
      ...currentMetrics,
      // Add comparison metrics
      heartRateRecovery: calculateHRRecovery(),
      stDeviation: calculateSTDeviation(),
      hrvChange: calculateHRVChange(),
      qtChange: calculateQTChange()
    });
  }, [baselineMetrics, currentMetrics, activitySegments]);

  return comparisonMetrics;
} 