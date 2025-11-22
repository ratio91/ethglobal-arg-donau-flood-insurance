'use client';

import { useEffect, useState } from 'react';
import { fetchGaugeList, fetchCurrentWaterLevel } from '@/lib/gauges';
import type { Gauge, GaugeWithLevel } from '@/types/gauge';

interface GaugeSelectorProps {
  onSelect: (gauge: GaugeWithLevel) => void;
}

export default function GaugeSelector({ onSelect }: GaugeSelectorProps) {
  const [gauges, setGauges] = useState<Gauge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGauge, setSelectedGauge] = useState<Gauge | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [loadingLevel, setLoadingLevel] = useState(false);

  useEffect(() => {
    async function loadGauges() {
      setLoading(true);
      const data = await fetchGaugeList();
      setGauges(data);
      setLoading(false);
    }
    loadGauges();
  }, []);

  useEffect(() => {
    if (selectedGauge) {
      setLoadingLevel(true);
      fetchCurrentWaterLevel(selectedGauge.objectID).then((data) => {
        if (data) {
          setCurrentLevel(data.currentWaterLevel);
        }
        setLoadingLevel(false);
      });
    }
  }, [selectedGauge]);

  const filteredGauges = gauges.filter((gauge) =>
    gauge.objectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gauge.objectID.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (gauge.riverName && gauge.riverName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectGauge = (gauge: Gauge) => {
    setSelectedGauge(gauge);
  };

  const handleConfirm = () => {
    if (selectedGauge && currentLevel !== null) {
      onSelect({
        ...selectedGauge,
        currentWaterLevel: currentLevel,
        timestamp: new Date().toISOString(),
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Select River Gauge</h2>
        <p className="text-blue-900 mb-4">
          Choose a river gauge station to monitor for your flood insurance policy.
        </p>
      </div>

      <div>
        <input
          type="text"
          placeholder="Search by name, ID, or river..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-blue-900"
        />
      </div>

      <div className="grid gap-3 max-h-96 overflow-y-auto">
        {filteredGauges.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No gauges found matching your search.</p>
        ) : (
          filteredGauges.map((gauge) => (
            <button
              key={gauge.objectID}
              onClick={() => handleSelectGauge(gauge)}
              className={`text-left p-4 border rounded-lg transition-all ${
                selectedGauge?.objectID === gauge.objectID
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-gray-900">{gauge.objectName}</div>
              <div className="text-sm text-blue-900">ID: {gauge.objectID}</div>
              {gauge.riverName && (
                <div className="text-sm text-blue-900">River: {gauge.riverName}</div>
              )}
              {gauge.location && (
                <div className="text-sm text-blue-900">{gauge.location}</div>
              )}
            </button>
          ))
        )}
      </div>

      {selectedGauge && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Selected Gauge</h3>
          <div className="text-sm text-blue-900">
            <div><strong>Name:</strong> {selectedGauge.objectName}</div>
            <div><strong>ID:</strong> {selectedGauge.objectID}</div>
            {loadingLevel ? (
              <div className="mt-2 text-blue-600">Loading current water level...</div>
            ) : currentLevel !== null ? (
              <div className="mt-2">
                <strong>Current Level:</strong> {currentLevel.toFixed(2)} cm
              </div>
            ) : (
              <div className="mt-2 text-red-600">Failed to load current water level</div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleConfirm}
          disabled={!selectedGauge || currentLevel === null}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
