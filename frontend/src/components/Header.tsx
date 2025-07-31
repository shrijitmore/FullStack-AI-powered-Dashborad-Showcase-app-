import React from 'react';
import { Sun, Moon, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from './ThemeProvider';

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Home className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-xl text-gray-900 dark:text-white">
              System Monitor
            </span>
          </Link>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5 text-gray-600" />
            ) : (
              <Sun className="h-5 w-5 text-yellow-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}