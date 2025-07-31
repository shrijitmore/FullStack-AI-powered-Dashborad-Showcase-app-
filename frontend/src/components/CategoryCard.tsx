import React from 'react';
import { ArrowRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CategorySummary } from '../types';

interface CategoryCardProps {
  category: CategorySummary;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      to={`/category/${encodeURIComponent(category.name)}`}
      className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {category.name}
            </h3>
          </div>
          
          <div className="mt-2 space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {category.departments.length} Departments
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Total Consumption: {category.totalConsumption.toFixed(2)} kWh
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Avg Efficiency: {category.averageEfficiency.toFixed(2)}%
            </p>
          </div>
        </div>
        
        <ArrowRight className="h-5 w-5 text-gray-400" />
      </div>
    </Link>
  );
}