export interface Gauge {
  objectID: string;
  objectName: string;
  riverName?: string;
  location?: string;
  ldc?: number; // Low Discharge (lowest water level)
  rn?: number; // Regulatory Navigation level
  hdc?: number; // High Discharge
  hdc100?: number; // 100-year flood level
}

export interface GaugeWithLevel extends Gauge {
  currentWaterLevel: number;
  timestamp: string;
}
