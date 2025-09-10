import React, { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SidebarProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentDate, onDateChange, activeTab, onTabChange }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigation = [
    { id: 'dashboard', name: 'Tableau de bord', icon: '🏠' },
    { id: 'transactions', name: 'Transactions', icon: '💳' },
    { id: 'analytics', name: 'Analytics', icon: '📊' },
    { id: 'settings', name: 'Paramètres', icon: '⚙️' },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Navigation mensuelle */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Période</h2>
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 rounded-md text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              <span className="text-lg">✕</span>
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <button
            onClick={() => onDateChange(subMonths(currentDate, 1))}
            className="p-1 rounded-md text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className="text-lg">←</span>
          </button>
          
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </span>
          
          <button
            onClick={() => onDateChange(addMonths(currentDate, 1))}
            className="p-1 rounded-md text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span className="text-lg">→</span>
          </button>
        </div>
      </div>

      {/* Menu principal */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className={`mr-3 text-lg ${isActive ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                {item.icon}
              </span>
              {item.name}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Bouton mobile pour ouvrir le sidebar */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700"
      >
        <span className="text-lg">☰</span>
      </button>

      {/* Sidebar desktop */}
      <div className="hidden lg:block w-64 fixed inset-y-16 left-0">
        {sidebarContent}
      </div>

      {/* Sidebar mobile */}
      {isMobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="lg:hidden fixed inset-y-0 left-0 z-50 w-64">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
};

export default Sidebar;