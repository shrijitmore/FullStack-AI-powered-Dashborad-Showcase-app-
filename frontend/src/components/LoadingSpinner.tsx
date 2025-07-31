import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="relative">
        <div className="h-24 w-24 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin"></div>
        <div className="h-24 w-24 rounded-full border-r-4 border-l-4 border-blue-300 animate-spin absolute top-0 left-0" style={{ animationDirection: 'reverse' }}></div>
      </div>
    </div>
  );
}; 