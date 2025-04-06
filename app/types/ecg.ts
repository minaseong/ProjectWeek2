import { ECGDataPoint } from "@/hooks/useHeartRateSensor";

// Basic ECG metrics that can be calculated in real-time
export interface ECGMetrics {
  heartRate: number;          // Current heart rate in BPM
  heartRateVariability: number; // HRV in milliseconds
  qtInterval: number;         // QT interval duration in milliseconds
  stSegment: {
    elevation: number;        // ST segment elevation in microvolts
    duration: number;         // ST segment duration in milliseconds
  };
  rPeaks: number[];          // Timestamps of R peaks
  qrsComplex: {
    duration: number;         // QRS complex duration in milliseconds
    amplitude: number;        // QRS complex amplitude in microvolts
  };
}

// Extended metrics that require baseline comparison
export interface ECGComparisonMetrics extends ECGMetrics {
  heartRateRecovery: number;  // Heart rate recovery in BPM
  stDeviation: number;        // ST segment deviation from baseline in microvolts
  hrvChange: number;          // Change in HRV from baseline (percentage)
  qtChange: number;           // Change in QT interval from baseline (percentage)
}

// Window size for real-time analysis (2 seconds at 130Hz sampling rate)
export const ANALYSIS_WINDOW_SIZE = 260;

// Minimum number of samples needed for reliable HRV calculation
export const MIN_RR_INTERVALS = 6;

// Sampling rate of the Polar device (Hz)
export const SAMPLING_RATE = 130; 