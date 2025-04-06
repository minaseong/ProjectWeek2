import React from 'react';
import { ECGMetrics as ECGMetricsType, ECGComparisonMetrics } from '@/types/ecg';

interface ECGMetricsDisplayProps {
  metrics: ECGMetricsType | ECGComparisonMetrics;
  isComparison?: boolean;
}

const ECGMetricsDisplay: React.FC<ECGMetricsDisplayProps> = ({ metrics, isComparison = false }) => {
  const comparisonMetrics = metrics as ECGComparisonMetrics;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">ECG Analysis</h2>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Basic Metrics */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Basic Metrics</h3>
          <p>Heart Rate: {metrics.heartRate.toFixed(1)} BPM</p>
          <p>HRV: {metrics.heartRateVariability.toFixed(1)} ms</p>
          <p>QT Interval: {metrics.qtInterval.toFixed(1)} ms</p>
          <div className="pl-4">
            <p>ST Elevation: {metrics.stSegment.elevation.toFixed(2)} µV</p>
            <p>ST Duration: {metrics.stSegment.duration.toFixed(1)} ms</p>
          </div>
          <div className="pl-4">
            <p>QRS Duration: {metrics.qrsComplex.duration.toFixed(1)} ms</p>
            <p>QRS Amplitude: {metrics.qrsComplex.amplitude.toFixed(0)} µV</p>
          </div>
        </div>

        {/* Comparison Metrics */}
        {isComparison && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Comparison Metrics</h3>
            <p>HR Recovery: {comparisonMetrics.heartRateRecovery.toFixed(1)} BPM</p>
            <p>ST Deviation: {comparisonMetrics.stDeviation.toFixed(2)} µV</p>
            <p>HRV Change: {comparisonMetrics.hrvChange.toFixed(1)}%</p>
            <p>QT Change: {comparisonMetrics.qtChange.toFixed(1)}%</p>
          </div>
        )}
      </div>

      {/* R-Peak Count */}
      <div className="mt-4">
        <p className="text-sm text-gray-600">
          Detected R-Peaks: {metrics.rPeaks.length}
        </p>
      </div>
    </div>
  );
};

export default ECGMetricsDisplay; 