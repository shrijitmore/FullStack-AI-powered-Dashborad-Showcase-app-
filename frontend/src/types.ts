export interface MonitoringData {
  timestamp: string;
  category: string;
  department: string;
  energyConsumption: number;
  cost: number;
  production: number;
  efficiency: number;
}

export interface CategorySummary {
  name: string;
  departments: string[];
  totalConsumption: number;
  averageEfficiency: number;
}