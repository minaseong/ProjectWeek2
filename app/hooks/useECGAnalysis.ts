import { useState, useEffect, useMemo } from 'react';
import { ECGDataPoint } from '@/hooks/useHeartRateSensor';
import { ECGMetrics, ANALYSIS_WINDOW_SIZE, MIN_RR_INTERVALS, SAMPLING_RATE } from '@/types/ecg';

export function useECGAnalysis(ecgData: ECGDataPoint[]) {
  const [metrics, setMetrics] = useState<ECGMetrics>({
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
    }
  });

  // Helper function to detect R peaks using a simple threshold method
  const detectRPeaks = (data: ECGDataPoint[]): number[] => {
    if (data.length < 3) return [];
    
    const threshold = calculateDynamicThreshold(data);
    const peaks: number[] = [];
    
    // Find local maxima above threshold
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i].value > threshold &&
          data[i].value > data[i-1].value &&
          data[i].value > data[i+1].value) {
        peaks.push(data[i].timestamp);
      }
    }
    
    return peaks;
  };

  // Calculate dynamic threshold based on signal characteristics
  const calculateDynamicThreshold = (data: ECGDataPoint[]): number => {
    const values = data.map(point => point.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    );
    return mean + 2 * stdDev;
  };

  // Calculate heart rate from R-R intervals
  const calculateHeartRate = (rPeaks: number[]): number => {
    if (rPeaks.length < 2) return 0;
    
    const rrIntervals = [];
    for (let i = 1; i < rPeaks.length; i++) {
      rrIntervals.push(rPeaks[i] - rPeaks[i-1]);
    }
    
    // Convert average R-R interval to heart rate (BPM)
    const avgRRInterval = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    return Math.round(60000 / avgRRInterval);
  };

  // Calculate heart rate variability (SDNN method)
  const calculateHRV = (rPeaks: number[]): number => {
    if (rPeaks.length < MIN_RR_INTERVALS) return 0;
    
    const rrIntervals = [];
    for (let i = 1; i < rPeaks.length; i++) {
      rrIntervals.push(rPeaks[i] - rPeaks[i-1]);
    }
    
    const mean = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
    const variance = rrIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / rrIntervals.length;
    return Math.sqrt(variance);
  };

  // Detect QT interval
  const detectQTInterval = (data: ECGDataPoint[], rPeaks: number[]): number => {
    if (rPeaks.length === 0) return 0;
    
    // Simple T wave detection (needs improvement)
    const lastRPeak = rPeaks[rPeaks.length - 1];
    const rPeakIndex = data.findIndex(point => point.timestamp === lastRPeak);
    
    if (rPeakIndex === -1) return 0;
    
    // Look for T wave in the next 400ms
    const searchWindow = Math.floor(0.4 * SAMPLING_RATE);
    let tWaveEnd = rPeakIndex;
    
    for (let i = rPeakIndex + 1; i < Math.min(rPeakIndex + searchWindow, data.length); i++) {
      if (data[i].value < 0 && data[i-1].value >= 0) {
        tWaveEnd = i;
        break;
      }
    }
    
    return data[tWaveEnd].timestamp - lastRPeak;
  };

  // Analyze ST segment
  const analyzeSTSegment = (data: ECGDataPoint[], rPeaks: number[]): { elevation: number; duration: number } => {
    if (rPeaks.length === 0) return { elevation: 0, duration: 0 };
    
    const lastRPeak = rPeaks[rPeaks.length - 1];
    const rPeakIndex = data.findIndex(point => point.timestamp === lastRPeak);
    
    if (rPeakIndex === -1) return { elevation: 0, duration: 0 };
    
    // ST segment typically starts 80ms after R peak
    const stStart = Math.floor(0.08 * SAMPLING_RATE);
    const stEnd = Math.floor(0.16 * SAMPLING_RATE);
    
    const stSegment = data.slice(rPeakIndex + stStart, rPeakIndex + stEnd);
    const elevation = stSegment.reduce((sum, point) => sum + point.value, 0) / stSegment.length;
    
    return {
      elevation,
      duration: (stEnd - stStart) * (1000 / SAMPLING_RATE) // Convert to milliseconds
    };
  };

  // Analyze QRS complex
  const analyzeQRSComplex = (data: ECGDataPoint[], rPeaks: number[]): { duration: number; amplitude: number } => {
    if (rPeaks.length === 0) return { duration: 0, amplitude: 0 };
    
    const lastRPeak = rPeaks[rPeaks.length - 1];
    const rPeakIndex = data.findIndex(point => point.timestamp === lastRPeak);
    
    if (rPeakIndex === -1) return { duration: 0, amplitude: 0 };
    
    // Look for Q wave (going backwards)
    let qIndex = rPeakIndex;
    for (let i = rPeakIndex - 1; i >= Math.max(0, rPeakIndex - 30); i--) {
      if (data[i].value >= 0) {
        qIndex = i;
        break;
      }
    }
    
    // Look for S wave
    let sIndex = rPeakIndex;
    for (let i = rPeakIndex + 1; i < Math.min(data.length, rPeakIndex + 30); i++) {
      if (data[i].value >= 0) {
        sIndex = i;
        break;
      }
    }
    
    return {
      duration: data[sIndex].timestamp - data[qIndex].timestamp,
      amplitude: data[rPeakIndex].value
    };
  };

  // Main analysis effect
  useEffect(() => {
    if (ecgData.length < ANALYSIS_WINDOW_SIZE) return;

    // Get the most recent window of data
    const windowData = ecgData.slice(-ANALYSIS_WINDOW_SIZE);
    
    // Detect R peaks
    const rPeaks = detectRPeaks(windowData);
    
    // Calculate metrics
    const heartRate = calculateHeartRate(rPeaks);
    const hrv = calculateHRV(rPeaks);
    const qtInterval = detectQTInterval(windowData, rPeaks);
    const stSegment = analyzeSTSegment(windowData, rPeaks);
    const qrsComplex = analyzeQRSComplex(windowData, rPeaks);

    setMetrics({
      heartRate,
      heartRateVariability: hrv,
      qtInterval,
      stSegment,
      rPeaks,
      qrsComplex
    });
  }, [ecgData]);

  return metrics;
} 