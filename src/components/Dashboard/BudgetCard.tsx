import React from 'react';

interface BudgetCardProps {
  title: string;
  amount: number;
  budget?: number;
  type: 'income' | 'expense' | 'savings' | 'remaining';
  icon?: React.ReactNode;
}

const BudgetCard: React.FC<BudgetCardProps> = ({ title, amount, budget, type, icon }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const getColorClasses = () => {
    switch (type) {
      case 'income':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'expense':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'savings':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'remaining':
        return amount < 0
          ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'income':
        return 'text-green-700 dark:text-green-300';
      case 'expense':
        return 'text-red-700 dark:text-red-300';
      case 'savings':
        return 'text-blue-700 dark:text-blue-300';
      case 'remaining':
        return amount < 0
          ? 'text-orange-700 dark:text-orange-300'
          : 'text-gray-700 dark:text-gray-300';
      default:
        return 'text-gray-700 dark:text-gray-300';
    }
  };

  const percentage = budget && budget > 0 ? (amount / budget) * 100 : 0;
  const isOverBudget = budget && amount > budget;

  return (
    <div className={`p-6 rounded-lg border ${getColorClasses()} transition-all hover:shadow-lg`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {icon && <div className="mr-3">{icon}</div>}
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</h3>
        </div>
        {type === 'remaining' && amount < 0 && (
          <span className="text-xl">⚠️</span>
        )}
        {type === 'expense' && isOverBudget && (
          <span className="text-xl text-red-500">📈</span>
        )}
      </div>
      
      <div className="mt-3">
        <div className={`text-2xl font-bold ${getTextColor()}`}>
          {formatCurrency(amount)}
        </div>
        
        {budget && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Budget: {formatCurrency(budget)}</span>
              <span>{percentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isOverBudget
                    ? 'bg-red-500'
                    : type === 'income'
                    ? 'bg-green-500'
                    : type === 'savings'
                    ? 'bg-blue-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetCard;