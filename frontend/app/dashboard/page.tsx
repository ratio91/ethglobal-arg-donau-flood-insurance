'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import PolicyCard from '@/components/PolicyCard';
import SettlementModal from '@/components/SettlementModal';
import { getUserPolicies, type PolicyWithLevel } from '@/lib/policies';
import { checkProofsForPolicies, type ProofData } from '@/lib/proofs';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [policies, setPolicies] = useState<PolicyWithLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofsAvailable, setProofsAvailable] = useState<Map<number, ProofData>>(new Map());
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithLevel | null>(null);
  const [selectedProof, setSelectedProof] = useState<ProofData | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      router.push('/');
      return;
    }

    async function loadPolicies() {
      if (!address) return;

      setLoading(true);
      const userPolicies = await getUserPolicies(address);
      setPolicies(userPolicies);

      // Check for available proofs for active policies
      const activePolicyIds = userPolicies
        .filter((p) => p.status === 1) // Status 1 = Open
        .map((p) => p.policyId);

      if (activePolicyIds.length > 0) {
        const proofs = await checkProofsForPolicies(activePolicyIds);
        setProofsAvailable(proofs);
      }

      setLoading(false);
    }

    loadPolicies();

    // Poll for new proofs every 30 seconds
    const interval = setInterval(async () => {
      const activePolicyIds = policies
        .filter((p) => p.status === 1)
        .map((p) => p.policyId);

      if (activePolicyIds.length > 0) {
        const proofs = await checkProofsForPolicies(activePolicyIds);
        setProofsAvailable(proofs);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [address, isConnected, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="border-b bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-blue-600">🌊 My Policies</h1>
            <ConnectButton />
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">🌊 My Policies</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              Home
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {policies.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center">
            <button
              onClick={() => router.push('/')}
              className="w-full bg-white rounded-lg shadow-lg p-12 hover:shadow-xl transition-all border-2 border-dashed border-gray-300 hover:border-blue-500 group"
            >
              <div className="text-8xl mb-4 text-blue-600 group-hover:scale-110 transition-transform">
                +
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Create Your First Policy
              </h2>
              <p className="text-gray-600">Get started with flood insurance protection</p>
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Your Policies ({policies.length})
              </h2>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create New Policy
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {policies.map((policy) => {
                const hasProof = proofsAvailable.has(policy.policyId);
                const proofData = proofsAvailable.get(policy.policyId);

                return (
                  <div key={policy.policyId}>
                    <PolicyCard policy={policy} />
                    {hasProof && proofData && policy.status === 1 && (
                      <button
                        onClick={() => {
                          setSelectedPolicy(policy);
                          setSelectedProof(proofData);
                          setShowModal(true);
                        }}
                        className="w-full mt-3 bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-all animate-pulse"
                      >
                        🌊 Threshold Exceeded - Settle Now!
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Settlement Modal */}
      {selectedPolicy && selectedProof && (
        <SettlementModal
          policy={selectedPolicy}
          proofData={selectedProof}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedPolicy(null);
            setSelectedProof(null);
          }}
          onSuccess={async () => {
            // Refresh policies after successful settlement
            if (address) {
              const userPolicies = await getUserPolicies(address);
              setPolicies(userPolicies);
              setProofsAvailable(new Map());
            }
          }}
        />
      )}
    </div>
  );
}
