'use client';

import { useState, useEffect } from 'react';
import type { GaugeWithLevel } from '@/types/gauge';

interface PolicyParamsProps {
  gauge: GaugeWithLevel;
  threshold: number;
  onNext: (params: { coverage: string; durationHours: number; premium: string }) => void;
  onBack: () => void;
}

export default function PolicyParams({ gauge, threshold, onNext, onBack }: PolicyParamsProps) {
  const [coverage, setCoverage] = useState<string>('');
  const [durationHours, setDurationHours] = useState<number>(24);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Automatically calculate premium based on coverage and duration
  // Formula: base rate (5%) + duration factor (0.5% per 24 hours)
  const premium = coverage && !isNaN(parseFloat(coverage)) && durationHours > 0
    ? (() => {
        const coverageValue = parseFloat(coverage);
        const baseRate = 0.05; // 5% base
        const durationRate = 0.005 * (durationHours / 24); // 0.5% per day
        const totalRate = baseRate + durationRate;
        return (coverageValue * totalRate).toFixed(4);
      })()
    : '0.0000';

  const handleSubmit = () => {
    const newErrors: { [key: string]: string } = {};

    const coverageValue = parseFloat(coverage);
    if (isNaN(coverageValue) || coverageValue <= 0) {
      newErrors.coverage = 'Please enter a valid coverage amount';
    }

    if (durationHours <= 0) {
      newErrors.duration = 'Duration must be greater than 0';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    onNext({ coverage, durationHours, premium });
  };

  const durationOptions = [
    { label: '24 hours', value: 24 },
    { label: '48 hours', value: 48 },
    { label: '72 hours', value: 72 },
    { label: '1 week', value: 168 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Configure Policy Parameters</h2>
        <p className="text-gray-600 mb-4">
          Set your coverage amount, policy duration, and premium.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Policy Summary</h3>
        <div className="text-sm text-gray-700 space-y-1">
          <div><strong>Gauge:</strong> {gauge.objectName}</div>
          <div><strong>Current Level:</strong> {gauge.currentWaterLevel.toFixed(2)} cm</div>
          <div><strong>Threshold:</strong> {threshold.toFixed(2)} cm</div>
        </div>
      </div>

      <div>
        <label htmlFor="coverage" className="block text-sm font-medium text-gray-700 mb-2">
          Coverage Amount (C2FLR)
        </label>
        <input
          id="coverage"
          type="number"
          step="0.01"
          value={coverage}
          onChange={(e) => {
            setCoverage(e.target.value);
            setErrors({ ...errors, coverage: '' });
          }}
          placeholder="e.g., 1.0"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-900"
        />
        {errors.coverage && <p className="mt-2 text-sm text-red-600">{errors.coverage}</p>}
        <p className="mt-1 text-sm text-gray-500">
          The amount you will receive if the threshold is exceeded
        </p>
      </div>

      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
          Policy Duration
        </label>
        <div className="grid grid-cols-2 gap-3 mb-2">
          {durationOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setDurationHours(option.value)}
              className={`px-4 py-2 border rounded-lg transition-colors ${
                durationHours === option.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <input
          id="duration"
          type="number"
          value={durationHours}
          onChange={(e) => {
            setDurationHours(parseInt(e.target.value) || 0);
            setErrors({ ...errors, duration: '' });
          }}
          placeholder="Custom duration in hours"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-900"
        />
        {errors.duration && <p className="mt-2 text-sm text-red-600">{errors.duration}</p>}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Premium (Automatically Calculated)</h3>
        <div className="text-2xl font-bold text-blue-600 mb-2">
          {premium} C2FLR
        </div>
        <p className="text-sm text-blue-900">
          Premium = Coverage × (5% base + 0.5% per day)
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {durationHours > 0 && coverage && !isNaN(parseFloat(coverage)) && (
            <>Rate: {((0.05 + 0.005 * (durationHours / 24)) * 100).toFixed(2)}%</>
          )}
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Note</h4>
        <p className="text-sm text-yellow-800">
          The premium will be deducted from your wallet when you create the policy. If the threshold is not exceeded during the policy period, the premium is non-refundable.
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
          disabled={!coverage || !premium || durationHours <= 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
