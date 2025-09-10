import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Budget Tracker
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-lg">👤</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Bonjour, {user?.firstName}
              </span>
            </div>
            
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={`Passer au mode ${theme === 'light' ? 'sombre' : 'clair'}`}
            >
              {theme === 'light' ? <span className="text-lg">🌙</span> : <span className="text-lg">☀️</span>}
            </button>
            
            <button
              onClick={logout}
              className="p-2 rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Se déconnecter"
            >
              <span className="text-lg">🚪</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;