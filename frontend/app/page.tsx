'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import GaugeSelector from '@/components/GaugeSelector';
import ThresholdConfig from '@/components/ThresholdConfig';
import PolicyParams from '@/components/PolicyParams';
import ReviewCreate from '@/components/ReviewCreate';
import type { GaugeWithLevel } from '@/types/gauge';

type Step = 'intro' | 'gauge' | 'threshold' | 'params' | 'review' | 'success';

export default function Home() {
  const { isConnected } = useAccount();
  const [step, setStep] = useState<Step>('intro');
  const [selectedGauge, setSelectedGauge] = useState<GaugeWithLevel | null>(null);
  const [threshold, setThreshold] = useState<number>(0);
  const [policyParams, setPolicyParams] = useState<{
    coverage: string;
    durationHours: number;
    premium: string;
  } | null>(null);

  const handleStartCreate = () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    setStep('gauge');
  };

  const handleGaugeSelect = (gauge: GaugeWithLevel) => {
    setSelectedGauge(gauge);
    setStep('threshold');
  };

  const handleThresholdNext = (thresholdValue: number) => {
    setThreshold(thresholdValue);
    setStep('params');
  };

  const handleParamsNext = (params: {
    coverage: string;
    durationHours: number;
    premium: string;
  }) => {
    setPolicyParams(params);
    setStep('review');
  };

  const handleSuccess = () => {
    setStep('success');
  };

  const handleReset = () => {
    setStep('intro');
    setSelectedGauge(null);
    setThreshold(0);
    setPolicyParams(null);
  };

  const renderStepIndicator = () => {
    if (step === 'intro' || step === 'success') return null;

    const steps = [
      { key: 'gauge', label: 'Select Gauge' },
      { key: 'threshold', label: 'Set Threshold' },
      { key: 'params', label: 'Configure Policy' },
      { key: 'review', label: 'Review & Create' },
    ];

    const currentIndex = steps.findIndex((s) => s.key === step);

    return (
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {steps.map((s, index) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                    index <= currentIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    index <= currentIndex ? 'text-blue-600 font-medium' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    index < currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (step) {
      case 'intro':
        return (
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Protect Against Floods with Decentralized Insurance
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Create parametric flood insurance policies based on Austrian river gauges.
              Automatic payouts when water levels exceed your chosen threshold.
            </p>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-semibold text-blue-900 mb-6">How It Works</h3>
              <div className="grid md:grid-cols-4 gap-6 text-left mb-8">
                <div>
                  <div className="text-3xl mb-2">1️⃣</div>
                  <h4 className="font-semibold text-blue-900 mb-2">Select Gauge</h4>
                  <p className="text-sm text-gray-600">
                    Choose an Austrian river gauge to monitor
                  </p>
                </div>
                <div>
                  <div className="text-3xl mb-2">2️⃣</div>
                  <h4 className="font-semibold text-blue-900 mb-2">Set Threshold</h4>
                  <p className="text-sm text-gray-600">
                    Define the water level that triggers payout
                  </p>
                </div>
                <div>
                  <div className="text-3xl mb-2">3️⃣</div>
                  <h4 className="font-semibold text-blue-900 mb-2">Configure Policy</h4>
                  <p className="text-sm text-gray-600">
                    Set coverage amount, duration, and premium
                  </p>
                </div>
                <div>
                  <div className="text-3xl mb-2">4️⃣</div>
                  <h4 className="font-semibold text-blue-900 mb-2">Automatic Payout</h4>
                  <p className="text-sm text-gray-600">
                    Receive payout if threshold is exceeded
                  </p>
                </div>
              </div>

              <button
                onClick={handleStartCreate}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
              >
                {isConnected ? 'Create Policy' : 'Connect Wallet to Start'}
              </button>
            </div>
          </div>
        );

      case 'gauge':
        return <GaugeSelector onSelect={handleGaugeSelect} />;

      case 'threshold':
        return selectedGauge ? (
          <ThresholdConfig
            gauge={selectedGauge}
            onNext={handleThresholdNext}
            onBack={() => setStep('gauge')}
          />
        ) : null;

      case 'params':
        return selectedGauge ? (
          <PolicyParams
            gauge={selectedGauge}
            threshold={threshold}
            onNext={handleParamsNext}
            onBack={() => setStep('threshold')}
          />
        ) : null;

      case 'review':
        return selectedGauge && policyParams ? (
          <ReviewCreate
            gauge={selectedGauge}
            threshold={threshold}
            coverage={policyParams.coverage}
            durationHours={policyParams.durationHours}
            premium={policyParams.premium}
            onBack={() => setStep('params')}
            onSuccess={handleSuccess}
          />
        ) : null;

      case 'success':
        return (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Policy Created Successfully!
              </h2>
              <p className="text-gray-600 mb-8">
                Your flood insurance policy has been created on the blockchain. You can view
                your policies in your wallet.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">What Happens Next?</h3>
                <ul className="text-sm text-gray-700 space-y-2 text-left">
                  <li>✓ Our backend monitors the water level at {selectedGauge?.objectName}</li>
                  <li>✓ If the threshold is exceeded, FDC proof will be automatically requested</li>
                  <li>✓ Your payout will be processed automatically within 90 seconds</li>
                  <li>✓ No action needed from you - everything is automatic!</li>
                </ul>
              </div>

              <button
                onClick={handleReset}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Create Another Policy
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">🌊 DONAU - dFloodInsurance</h1>
          <ConnectButton />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {renderStepIndicator()}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">{renderContent()}</div>
        </div>
      </main>
    </div>
  );
}
