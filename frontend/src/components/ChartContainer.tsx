import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
}

export function ChartContainer({ title, children }: ChartContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${
      isExpanded ? 'fixed inset-4 z-50 overflow-auto' : 'h-[400px]'
    }`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          {isExpanded ? (
            <Minimize2 className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Maximize2 className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </div>
      <div className="h-[calc(100%-2rem)]">
        {children}
      </div>
    </div>
  );
}