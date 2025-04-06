"use client";
import { useHeartRateSensor, ECGDataPoint } from "@/hooks/useHeartRateSensor";
import HeartRateMonitor from "@/components/HeartRateMonitor";
import ECGChart from "@/components/ECGChart";
import UploadButton from "@/components/UploadButton";
import { ActivitySegment, RecordData } from "@/hooks/useMongoDB";
import UserPanel from "@/components/UserPanel";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useMemo, useState, useEffect } from "react";
import ActivitySegmentEditor from "@/components/ActivitySegmentEditor";
import { useECGAnalysis } from "@/hooks/useECGAnalysis";
import { useECGComparison } from "@/hooks/useECGComparison";
import { ANALYSIS_WINDOW_SIZE } from '@/types/ecg';

export default function Home() {
  const { user, saveUser, clearUser } = useLocalStorage();
  const [activitySegments, setActivitySegments] = useState<ActivitySegment[]>([]);
  const [isTestMode, setIsTestMode] = useState(false);
  const [currentData, setCurrentData] = useState<ECGDataPoint[]>([]);
  const [baselineData, setBaselineData] = useState<ECGDataPoint[]>([]);
  const [isTestSignalActive, setIsTestSignalActive] = useState(false);
  const [generatedHR, setGeneratedHR] = useState<number | null>(null);

  const {
    connect,
    disconnect,
    startECGStream,
    stopECGStream,
    heartRate,
    heartRateData,
    ecgData,
    ecgHistory,
    error,
    isConnected,
    isECGStreaming,
  } = useHeartRateSensor();

  /**
   * Generate sample ECG data for testing
   * Simulates realistic ECG waveform with:
   * - P wave (atrial depolarization)
   * - QRS complex (ventricular depolarization)
   * - T wave (ventricular repolarization)
   * - Baseline wander and noise
   */
  const generateSampleECGData = (baseHeartRate: number = 60): { data: ECGDataPoint[]; actualHR: number } => {
    const data: ECGDataPoint[] = [];
    const now = Date.now();
    const samplingRate = 250; // 250 Hz
    const duration = 5; // 5 seconds of data
    const totalPoints = duration * samplingRate;
    
    // Base parameters with physiological variations
    const actualHR = baseHeartRate + (Math.random() * 20 - 10); // ±10 BPM variation
    const rrInterval = 60000 / actualHR;
    const pointsPerBeat = Math.floor(rrInterval * samplingRate / 1000);
    
    // Waveform parameters with realistic variations
    const pWaveAmplitude = 0.1 + Math.random() * 0.1;  // 0.1-0.2 mV
    const qrsAmplitude = 1.0 + Math.random() * 0.5;    // 1.0-1.5 mV
    const tWaveAmplitude = 0.2 + Math.random() * 0.1;  // 0.2-0.3 mV
    
    // Generate each point
    for (let i = 0; i < totalPoints; i++) {
      const t = i / samplingRate;
      const beatPosition = (i % pointsPerBeat) / pointsPerBeat;
      
      let value = 0;
      
      // P wave (atrial depolarization)
      if (beatPosition >= 0 && beatPosition < 0.15) {
        const pTime = (beatPosition - 0.05) * 20;
        value += pWaveAmplitude * Math.exp(-pTime * pTime);
      }
      
      // QRS complex (ventricular depolarization)
      if (beatPosition >= 0.15 && beatPosition < 0.25) {
        const qrsTime = (beatPosition - 0.2) * 50;
        value += qrsAmplitude * Math.exp(-qrsTime * qrsTime);
      }
      
      // T wave (ventricular repolarization)
      if (beatPosition >= 0.25 && beatPosition < 0.45) {
        const tTime = (beatPosition - 0.35) * 20;
        value += tWaveAmplitude * Math.exp(-tTime * tTime);
      }
      
      // Add physiological noise
      value += (Math.random() - 0.5) * 0.05;  // 50 µV noise
      
      // Add occasional artifacts (1% chance)
      if (Math.random() < 0.01) {
        value += (Math.random() - 0.5) * 0.5;
      }
      
      // Add baseline wander (respiratory variation)
      value += Math.sin(t * 0.5) * 0.05;  // 0.5 Hz respiratory rate
      
      data.push({
        timestamp: now + (i * 1000 / samplingRate),
        value: value
      });
    }
    
    return { data, actualHR };
  };

  // Initialize baseline data
  useEffect(() => {
    const { data } = generateSampleECGData(60);
    setBaselineData(data);
  }, []);

  // Use hooks with real or simulated data
  const realTimeMetrics = useECGAnalysis(currentData);
  const comparisonMetrics = useECGComparison(baselineData, currentData, activitySegments);

  // Update currentData based on mode
  useEffect(() => {
    if (isTestMode) return;
    
    if (isConnected && ecgData) {
      setCurrentData(ecgData);
    } else {
      setCurrentData([]);
    }
  }, [isTestMode, isConnected, ecgData]);

  // Simulated ECG data generator
  useEffect(() => {
    if (!isTestMode || !isTestSignalActive) {
      setGeneratedHR(null);
      return;
    }
    
    const interval = setInterval(() => {
      const { data: newData, actualHR } = generateSampleECGData(
        60 + (Math.random() * 20 - 10) // Vary heart rate by ±10 BPM
      );
      setCurrentData((prev: ECGDataPoint[]) => [...prev.slice(-ANALYSIS_WINDOW_SIZE), ...newData]);
      setGeneratedHR(actualHR);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isTestMode, isTestSignalActive]);

  // Clear data when exiting test mode
  useEffect(() => {
    if (!isTestMode) {
      setIsTestSignalActive(false);
      if (!isConnected) {
        setCurrentData([]);
      }
    }
  }, [isTestMode, isConnected]);

  const record: RecordData | null = useMemo(() => {
    if (!user || !user._id) return null;

    return {
      user_id: user._id,
      datetime: new Date().toISOString(),
      ecg: isTestMode ? currentData : ecgHistory,
      hr: heartRateData,
      activity_segments: activitySegments,
    };
  }, [user, currentData, ecgHistory, heartRateData, activitySegments, isTestMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-teal-100 p-8">
      <UserPanel user={user} saveUser={saveUser} clearUser={clearUser} />

      {/* Test Mode Controls */}
      <div className="max-w-4xl mx-auto mb-4 flex space-x-4">
        <button
          onClick={() => setIsTestMode(!isTestMode)}
          className={`px-4 py-2 rounded ${
            isTestMode
              ? "bg-green-500 hover:bg-green-600"
              : "bg-gray-500 hover:bg-gray-600"
          } text-white`}
        >
          {isTestMode ? "Test Mode: ON" : "Test Mode: OFF"}
        </button>
        {isTestMode && (
          <button
            onClick={() => setIsTestSignalActive(!isTestSignalActive)}
            className={`px-4 py-2 rounded ${
              isTestSignalActive
                ? "bg-red-500 hover:bg-red-600"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white`}
          >
            {isTestSignalActive ? "Stop Signal" : "Start Signal"}
          </button>
        )}
      </div>

      {!isTestMode ? (
        <HeartRateMonitor
          isConnected={isConnected}
          isECGStreaming={isECGStreaming}
          connect={connect}
          disconnect={disconnect}
          startECGStream={startECGStream}
          stopECGStream={stopECGStream}
          error={error}
          heartRate={heartRate}
        />
      ) : (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow">
          <h2 className="text-2xl font-bold mb-4">Test Mode Active</h2>
          <div className="space-y-2">
            <p className="text-gray-600">Simulating a connected Polar H10 device</p>
            <div className="bg-gray-100 rounded-lg p-4 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-700">
                  Generated Heart Rate:
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  {generatedHR?.toFixed(1) ?? '--'} BPM
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-700">
                  Detected Heart Rate:
                </span>
                <span className="text-2xl font-bold text-green-600">
                  {realTimeMetrics.heartRate.toFixed(1)} BPM
                </span>
              </div>
              {Math.abs((generatedHR || 0) - realTimeMetrics.heartRate) > 5 && (
                <p className="text-sm text-yellow-600">
                  Note: Large difference between generated and detected heart rates may indicate detection issues.
                </p>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Note: This is simulated data for testing purposes. The ECG waveform and metrics are generated to mimic real physiological data.
            </p>
          </div>
        </div>
      )}

      {/* ECG Display */}
      {(isConnected || isTestMode) && (
        <div className="max-w-4xl mx-auto mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">ECG Signal</h2>
            <div className="h-96">
              <ECGChart ecgData={currentData} />
            </div>
          </div>
        </div>
      )}

      {/* ECG Metrics Panel */}
      {(isConnected || isTestMode) && (
        <div className="max-w-4xl mx-auto mt-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">ECG Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Current ECG Metrics</h3>
                <div className="bg-white p-6 rounded-lg shadow-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p>Heart Rate: {realTimeMetrics.heartRate.toFixed(1)} BPM</p>
                      <p>HRV: {realTimeMetrics.heartRateVariability.toFixed(1)} ms</p>
                      <p>QT Interval: {realTimeMetrics.qtInterval.toFixed(1)} ms</p>
                      <div className="pl-4">
                        <p>ST Elevation: {realTimeMetrics.stSegment.elevation.toFixed(2)} µV</p>
                        <p>ST Duration: {realTimeMetrics.stSegment.duration.toFixed(1)} ms</p>
                      </div>
                      <div className="pl-4">
                        <p>QRS Duration: {realTimeMetrics.qrsComplex.duration.toFixed(1)} ms</p>
                        <p>QRS Amplitude: {realTimeMetrics.qrsComplex.amplitude.toFixed(0)} µV</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      Detected R-Peaks: {realTimeMetrics.rPeaks.length}
                    </p>
                  </div>
                </div>
              </div>

              {baselineData.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Comparison with Baseline</h3>
                  <div className="bg-white p-6 rounded-lg shadow-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p>HR Recovery: {comparisonMetrics.heartRateRecovery.toFixed(1)} BPM</p>
                        <p>ST Deviation: {comparisonMetrics.stDeviation.toFixed(2)} µV</p>
                        <p>HRV Change: {comparisonMetrics.hrvChange.toFixed(1)}%</p>
                        <p>QT Change: {comparisonMetrics.qtChange.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto mt-6">
        <UploadButton record={record} />
      </div>

      <ActivitySegmentEditor
        ecgData={ecgHistory}
        segments={activitySegments}
        setSegments={setActivitySegments}
      />
    </div>
  );
}
