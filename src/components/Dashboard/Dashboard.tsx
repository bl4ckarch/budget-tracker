import React, { useEffect, useState } from 'react';
import BudgetCard from './BudgetCard';
import CategoryChart from './CategoryChart';
import IncomeForm from '../Income/IncomeForm';
import { apiRequest } from '../../hooks/useApi';

interface DashboardProps {
  currentDate: Date;
}

interface BudgetSummary {
  totalIncome: number;
  totalExpenses: number;
  savingsGoal: number;
  actualSavings: number;
  remainingBudget: number;
  categoryBreakdown: Array<{
    category: string;
    type: string;
    spent: number;
    budget: number;
    percentage: number;
  }>;
  incomeSet: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ currentDate }) => {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, [currentDate]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const month = (currentDate.getMonth() + 1).toString();
      const year = currentDate.getFullYear().toString();
      
      const data = await apiRequest(`/transactions/summary/${month}/${year}`);
      setSummary(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIncomeSet = () => {
    fetchSummary();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 dark:bg-gray-700 h-32 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={fetchSummary}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const monthName = currentDate.toLocaleDateString('fr-FR', { 
    month: 'long', 
    year: 'numeric' 
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Tableau de bord - {monthName}
        </h1>
      </div>

      {/* Formulaire de définition du revenu */}
      <IncomeForm currentDate={currentDate} onIncomeSet={handleIncomeSet} />


      {summary && (
        <>
          {/* Cartes de résumé */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <BudgetCard
              title="Revenus"
              amount={summary.totalIncome}
              type="income"
              icon={<span className="text-2xl">💰</span>}
            />
            
            <BudgetCard
              title="Dépenses"
              amount={summary.totalExpenses}
              type="expense"
              icon={<span className="text-2xl">📉</span>}
            />
            
            <BudgetCard
              title="Épargne réelle"
              amount={summary.actualSavings}
              budget={summary.savingsGoal}
              type="savings"
              icon={<span className="text-2xl">🐷</span>}
            />
            
            <BudgetCard
              title="Budget restant"
              amount={summary.remainingBudget}
              type="remaining"
              icon={<span className="text-2xl">💳</span>}
            />
          </div>
          {/* Alertes */}
          {summary.remainingBudget < 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h3 className="text-lg font-medium text-orange-800 dark:text-orange-200 mb-2">
                ⚠️ Budget dépassé
              </h3>
              <p className="text-orange-700 dark:text-orange-300">
                Vous avez dépassé votre budget de {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(Math.abs(summary.remainingBudget))}. 
                Considérez réduire vos dépenses ou ajuster vos objectifs.
              </p>
            </div>
          )}

          {/* Détail par catégories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique en camembert */}
            <CategoryChart data={summary.categoryBreakdown} />

            {/* Liste détaillée des catégories */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Détail par catégorie
              </h3>
              
              <div className="space-y-4">
                {summary.categoryBreakdown
                  .filter(item => item.type !== 'income')
                  .map((item) => (
                    <div key={item.category} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.category}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(item.spent)} / {new Intl.NumberFormat('fr-FR', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(item.budget)}
                          </span>
                        </div>
                        
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              item.spent > item.budget
                                ? 'bg-red-500'
                                : item.type === 'savings'
                                ? 'bg-blue-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(item.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;