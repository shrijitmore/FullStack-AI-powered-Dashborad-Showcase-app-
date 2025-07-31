import Papa from 'papaparse';
import type { MonitoringData } from '../types';

// Sample CSV data for demonstration
const sampleData = `timestamp,category,department,energyConsumption,cost,production,efficiency
2024-03-01 00:00:00,Energy Monitoring,Production,1200,150,500,85
2024-03-01 01:00:00,Energy Monitoring,Production,1150,145,480,83
2024-03-01 00:00:00,Energy Monitoring,Assembly,800,100,300,78
2024-03-01 01:00:00,Energy Monitoring,Assembly,750,95,290,76
2024-03-01 00:00:00,Plant Monitoring,Production,900,120,400,88
2024-03-01 01:00:00,Plant Monitoring,Production,850,115,380,86`;

export async function loadData(): Promise<MonitoringData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(sampleData, {
      header: true,
      complete: (results) => {
        const data = results.data as MonitoringData[];
        resolve(data.map(row => ({
          ...row,
          energyConsumption: Number(row.energyConsumption),
          cost: Number(row.cost),
          production: Number(row.production),
          efficiency: Number(row.efficiency),
        })));
      },
      error: (error) => reject(error),
    });
  });
}

export function processDataToCategories(data: MonitoringData[]) {
  const categoryMap = new Map();

  data.forEach(item => {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, {
        name: item.category,
        departments: new Set(),
        totalConsumption: 0,
        totalEfficiency: 0,
        count: 0,
      });
    }

    const category = categoryMap.get(item.category);
    category.departments.add(item.department);
    category.totalConsumption += item.energyConsumption;
    category.totalEfficiency += item.efficiency;
    category.count += 1;
  });

  return Array.from(categoryMap.values()).map(category => ({
    name: category.name,
    departments: Array.from(category.departments),
    totalConsumption: category.totalConsumption,
    averageEfficiency: category.totalEfficiency / category.count,
  }));
}