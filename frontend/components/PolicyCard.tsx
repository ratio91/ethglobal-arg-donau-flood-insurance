'use client';

import { formatEther } from 'viem';
import type { PolicyWithLevel } from '@/lib/policies';

interface PolicyCardProps {
  policy: PolicyWithLevel;
}

function getStatusInfo(status: number, expirationTimestamp: number) {
  const now = Date.now() / 1000;
  const isExpired = now > expirationTimestamp;

  switch (status) {
    case 0: // Unclaimed
      return { label: 'Waiting for Insurer', color: 'bg-yellow-100 text-yellow-800' };
    case 1: // Open
      if (isExpired) {
        return { label: 'Expired', color: 'bg-gray-100 text-gray-800' };
      }
      return { label: 'Active', color: 'bg-green-100 text-green-800' };
    case 2: // Settled
      return { label: 'Settled', color: 'bg-purple-100 text-purple-800' };
    default:
      return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  }
}

function formatTimeRemaining(expirationTimestamp: number): string {
  const now = Date.now() / 1000;
  const remaining = expirationTimestamp - now;

  if (remaining <= 0) {
    return 'Expired';
  }

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  return `${hours}h`;
}

export default function PolicyCard({ policy }: PolicyCardProps) {
  const statusInfo = getStatusInfo(policy.status, policy.expirationTimestamp);

  // Calculate progress percentage (threshold is in mm, water level is in cm)
  const thresholdCm = policy.waterLevelThreshold / 100;
  const progress = policy.currentWaterLevel
    ? Math.min((policy.currentWaterLevel / thresholdCm) * 100, 100)
    : 0;

  const expiresDate = new Date(policy.expirationTimestamp * 1000);
  const timeRemaining = formatTimeRemaining(policy.expirationTimestamp);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200 hover:shadow-xl transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
        <span className="text-gray-500 text-sm">Policy #{policy.policyId}</span>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-1">
        🌊 {policy.objectName}
      </h3>
      <p className="text-sm text-gray-500 mb-4">ID: {policy.objectID}</p>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">
            Current: {policy.currentWaterLevel?.toFixed(0) || '---'} cm
          </span>
          <span className="text-gray-600">Threshold: {thresholdCm.toFixed(0)} cm</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{progress.toFixed(0)}% of threshold</p>
      </div>

      <div className="border-t border-gray-200 pt-4 mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Coverage:</span>
          <span className="font-semibold text-gray-900">
            {formatEther(BigInt(policy.coverage))} C2FLR
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Premium Paid:</span>
          <span className="font-semibold text-gray-900">
            {formatEther(BigInt(policy.premium))} C2FLR
          </span>
        </div>
      </div>

      <div className="text-sm">
        <span className="text-gray-600">Expires: </span>
        <span className="font-medium text-gray-900">
          {expiresDate.toLocaleDateString()} ({timeRemaining})
        </span>
      </div>
    </div>
  );
}
