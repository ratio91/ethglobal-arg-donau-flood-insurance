'use client';

import { useState } from 'react';
import type { GaugeWithLevel } from '@/types/gauge';

interface ThresholdConfigProps {
  gauge: GaugeWithLevel;
  onNext: (threshold: number) => void;
  onBack: () => void;
}

export default function ThresholdConfig({ gauge, onNext, onBack }: ThresholdConfigProps) {
  const [threshold, setThreshold] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = () => {
    const thresholdValue = parseFloat(threshold);

    if (isNaN(thresholdValue)) {
      setError('Please enter a valid number');
      return;
    }

    if (thresholdValue <= 0) {
      setError('Threshold must be greater than 0');
      return;
    }

    if (thresholdValue <= gauge.currentWaterLevel) {
      setError('Threshold must be higher than current water level');
      return;
    }

    setError('');
    onNext(thresholdValue);
  };

  const suggestedThresholds = [
    gauge.hdc && { label: 'High Discharge', value: gauge.hdc, description: 'High discharge level' },
    gauge.hdc100 && { label: '100-yr Flood', value: gauge.hdc100, description: '100-year flood level' },
  ].filter(Boolean) as Array<{ label: string; value: number; description: string }>;

  // If no high water marks available, fall back to relative values
  if (suggestedThresholds.length === 0) {
    suggestedThresholds.push(
      { label: '+100 cm', value: gauge.currentWaterLevel + 100, description: '100 cm above current' },
      { label: '+200 cm', value: gauge.currentWaterLevel + 200, description: '200 cm above current' }
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Set Water Level Threshold</h2>
        <p className="text-gray-600 mb-4">
          Choose the water level that will trigger your insurance payout.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Selected Gauge</h3>
        <div className="text-sm text-gray-700">
          <div><strong>Name:</strong> {gauge.objectName}</div>
          <div><strong>Current Level:</strong> {gauge.currentWaterLevel.toFixed(2)} cm</div>
        </div>
      </div>

      <div>
        <label htmlFor="threshold" className="block text-sm font-medium text-gray-700 mb-2">
          Water Level Threshold (cm)
        </label>
        <input
          id="threshold"
          type="number"
          step="0.01"
          value={threshold}
          onChange={(e) => {
            setThreshold(e.target.value);
            setError('');
          }}
          placeholder="Enter threshold in cm"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-900"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div>
        <p className="text-sm font-medium text-blue-900 mb-3">Quick Select (High Water Marks):</p>
        <div className="grid grid-cols-2 gap-3">
          {suggestedThresholds.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => setThreshold(suggestion.value.toFixed(2))}
              className="px-4 py-3 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-left"
            >
              <div className="font-semibold">{suggestion.label}</div>
              <div className="text-xs text-blue-900 mt-1">{suggestion.value.toFixed(0)} cm</div>
              <div className="text-xs text-gray-600 mt-1">{suggestion.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Important</h4>
        <p className="text-sm text-yellow-800">
          Your policy will automatically pay out if the water level reaches or exceeds your chosen threshold during the policy period.
        </p>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={!threshold}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
