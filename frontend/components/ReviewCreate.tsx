'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { CONTRACT_ABI } from '@/lib/multibaas';
import type { GaugeWithLevel } from '@/types/gauge';
import type { PolicyFormData } from '@/types/policy';

interface ReviewCreateProps {
  gauge: GaugeWithLevel;
  threshold: number;
  coverage: string;
  durationHours: number;
  premium: string;
  onBack: () => void;
  onSuccess: () => void;
}

export default function ReviewCreate({
  gauge,
  threshold,
  coverage,
  durationHours,
  premium,
  onBack,
  onSuccess,
}: ReviewCreateProps) {
  const { address } = useAccount();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const addLog = (message: string) => {
    console.log(message);
    setDebugLogs((prev) => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const handleCreate = async () => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    setError('');
    setDebugLogs([]);

    try {
      addLog('🔄 Starting policy creation...');
      addLog(`📍 Wallet address: ${address}`);

      // Convert values to wei (18 decimals)
      addLog(`💰 Converting coverage: ${coverage} C2FLR to wei...`);
      const coverageWei = parseEther(coverage);
      addLog(`   Coverage wei: ${coverageWei.toString()}`);

      addLog(`💵 Converting premium: ${premium} C2FLR to wei...`);
      const premiumWei = parseEther(premium);
      addLog(`   Premium wei: ${premiumWei.toString()}`);

      // Threshold is in cm, need to store as-is
      const thresholdBigInt = BigInt(Math.floor(threshold * 100)); // Store as mm (2 decimal precision)
      addLog(`🌊 Threshold: ${threshold} cm → ${thresholdBigInt.toString()} mm`);

      // Calculate timestamps
      const startTimestamp = BigInt(Math.floor(Date.now() / 1000));
      const expirationTimestamp = startTimestamp + BigInt(durationHours * 3600);
      addLog(`⏰ Start: ${startTimestamp}, Expiration: ${expirationTimestamp} (duration: ${durationHours} hours)`);

      addLog(`🏭 Gauge: ${gauge.objectName} (${gauge.objectID})`);

      addLog('📡 Calling contract writeContract...');
      addLog(`📍 Contract: ${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}`);
      addLog(`🔗 Chain ID: ${process.env.NEXT_PUBLIC_CHAIN_ID}`);

      writeContract({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'createPolicy',
        args: [
          gauge.objectID,
          gauge.objectName,
          startTimestamp,
          expirationTimestamp,
          thresholdBigInt,
          coverageWei,
        ],
        value: premiumWei,
        gas: BigInt(500000), // Explicit gas limit to avoid estimation issues
      });

      addLog('✅ Transaction submitted! Waiting for confirmation...');
    } catch (err: any) {
      addLog(`❌ ERROR: ${err.message || 'Unknown error'}`);
      addLog(`🔍 Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
      console.error('Full error object:', err);
      setError(err.message || 'Failed to create policy. Please check the logs below.');
    }
  };

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed && !error) {
      addLog('🎉 Transaction confirmed!');
      addLog(`📝 Transaction hash: ${hash}`);
      setTimeout(() => onSuccess(), 1000);
    }
  }, [isConfirmed, error, hash]);

  // Handle write errors
  useEffect(() => {
    if (writeError && !error) {
      addLog(`❌ Write Error: ${writeError.message}`);
      setError(writeError.message);
    }
  }, [writeError, error]);

  const endTime = new Date();
  endTime.setHours(endTime.getHours() + durationHours);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Review & Create Policy</h2>
        <p className="text-gray-600 mb-4">
          Review your policy details before creating it on the blockchain.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg divide-y">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Gauge Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium text-gray-900">{gauge.objectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ID:</span>
              <span className="font-medium text-gray-900">{gauge.objectID}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Level:</span>
              <span className="font-medium text-gray-900">{gauge.currentWaterLevel.toFixed(2)} cm</span>
            </div>
          </div>
        </div>

        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Policy Parameters</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Threshold:</span>
              <span className="font-medium text-gray-900">{threshold.toFixed(2)} cm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Coverage:</span>
              <span className="font-medium text-gray-900">{coverage} C2FLR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Premium:</span>
              <span className="font-medium text-gray-900">{premium} C2FLR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium text-gray-900">{durationHours} hours</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Expires:</span>
              <span className="font-medium text-gray-900">{endTime.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">Total Cost:</span>
            <span className="text-2xl font-bold text-blue-600">{premium} C2FLR</span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">Important Information</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>The premium will be deducted from your wallet immediately</li>
          <li>Your policy will activate as soon as the transaction is confirmed</li>
          <li>Automatic payout if water level reaches {threshold.toFixed(2)} cm</li>
          <li>Policy cannot be cancelled once created</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-600 mb-2">{error}</p>
        </div>
      )}

      {debugLogs.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 font-mono text-xs max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-semibold text-white">Debug Logs:</h4>
            <button
              onClick={() => setDebugLogs([])}
              className="text-gray-400 hover:text-white text-xs px-2 py-1"
            >
              Clear
            </button>
          </div>
          {debugLogs.map((log, idx) => (
            <div
              key={idx}
              className={`py-1 ${
                log.includes('❌') || log.includes('🔴')
                  ? 'text-red-400 font-semibold'
                  : log.includes('✅')
                  ? 'text-green-400'
                  : log.includes('🔄') || log.includes('📡')
                  ? 'text-blue-400'
                  : 'text-gray-300'
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isPending || isConfirming}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={isPending || isConfirming || !address}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isPending || isConfirming ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {isPending ? 'Signing...' : 'Confirming...'}
            </>
          ) : (
            'Create Policy'
          )}
        </button>
      </div>
    </div>
  );
}
