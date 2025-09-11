import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../hooks/useApi';

interface IncomeFormProps {
  currentDate: Date;
  onIncomeSet: () => void;
}

const IncomeForm: React.FC<IncomeFormProps> = ({ currentDate, onIncomeSet }) => {
  const [salary, setSalary] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');
  const [currentSettings, setCurrentSettings] = useState<any>(null);
  const [salaryCategory, setSalaryCategory] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      
      // Récupérer les paramètres budgétaires
      const budgetData = await apiRequest(`/api/transactions/budget-settings/${month}/${year}`);
      setCurrentSettings(budgetData);
      setSalary(budgetData.monthly_salary ? budgetData.monthly_salary.toString() : '2750');
      setSavingsGoal(budgetData.savings_goal ? budgetData.savings_goal.toString() : '800');

      // Récupérer les catégories pour trouver la catégorie "Salaire"
      const categoriesData = await apiRequest('/categories');
      const salarycat = categoriesData.categories?.find(
        (cat: any) => cat.type === 'income' && cat.name.toLowerCase().includes('salaire')
      );
      setSalaryCategory(salarycat);

    } catch (err) {
      console.error('Erreur récupération données:', err);
      // Valeurs par défaut
      setSalary('2750');
      setSavingsGoal('800');
    }
  };

  const createOrUpdateSalaryTransaction = async (salaryAmount: number, month: number, year: number) => {
    try {
      // Vérifier s'il existe déjà une transaction de salaire ce mois
      const transactionsData = await apiRequest(`/api/transactions/${month}/${year}`);
      const existingSalaryTransaction = transactionsData.transactions?.find(
        (t: any) => t.category_type === 'income' && 
                   (t.category_name?.toLowerCase().includes('salaire') || 
                    t.description?.toLowerCase().includes('salaire'))
      );

      const transactionDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

      if (existingSalaryTransaction) {
        // Mettre à jour la transaction existante
        await apiRequest(`/api/transactions/${existingSalaryTransaction.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            amount: salaryAmount,
            description: `Salaire ${monthName}`,
            category_id: existingSalaryTransaction.category_id,
            transaction_date: transactionDate
          })
        });
      } else {
        // Créer une nouvelle transaction de salaire
        if (!salaryCategory) {
          // Créer la catégorie "Salaire" si elle n'existe pas
          const newCategoryData = await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Salaire',
              type: 'income',
              budget_amount: salaryAmount,
              color: '#10b981'
            })
          });
          
          // Utiliser la nouvelle catégorie
          await apiRequest('/transactions', {
            method: 'POST',
            body: JSON.stringify({
              amount: salaryAmount,
              description: `Salaire ${monthName}`,
              category_id: newCategoryData.category.id,
              transaction_date: transactionDate
            })
          });
        } else {
          // Utiliser la catégorie existante
          await apiRequest('/transactions', {
            method: 'POST',
            body: JSON.stringify({
              amount: salaryAmount,
              description: `Salaire ${monthName}`,
              category_id: salaryCategory.id,
              transaction_date: transactionDate
            })
          });
        }
      }
    } catch (err) {
      console.error('Erreur création/mise à jour transaction salaire:', err);
      throw new Error('Impossible de créer la transaction de salaire');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const salaryAmount = parseFloat(salary);
      const savingsAmount = parseFloat(savingsGoal);

      // Validation
      if (salaryAmount < 1000 || salaryAmount > 50000) {
        throw new Error('Le salaire doit être entre 1000€ et 50000€');
      }
      if (savingsAmount < 0 || savingsAmount > 10000) {
        throw new Error('L\'objectif d\'épargne doit être entre 0€ et 10000€');
      }
      if (savingsAmount >= salaryAmount) {
        throw new Error('L\'objectif d\'épargne ne peut pas être supérieur au salaire');
      }

      // 1. Définir les paramètres budgétaires
      await apiRequest(`/api/transactions/budget-settings/${month}/${year}`, {
        method: 'POST',
        body: JSON.stringify({ 
          monthly_salary: salaryAmount,
          savings_goal: savingsAmount
        })
      });

      // 2. Créer ou mettre à jour la transaction de salaire
      await createOrUpdateSalaryTransaction(salaryAmount, month, year);

      // 3. Mettre à jour l'état local
      setCurrentSettings({
        monthly_salary: salaryAmount,
        savings_goal: savingsAmount,
        month,
        year,
        isDefault: false
      });
      
      // 4. Notifier le parent pour rafraîchir les données
      onIncomeSet();

    } catch (err: any) {
      setError(err.message || 'Erreur lors de la configuration du budget');
    } finally {
      setLoading(false);
    }
  };

  const monthName = currentDate.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });

  const availableBudget = salary && savingsGoal ? 
    parseFloat(salary) - parseFloat(savingsGoal) : 0;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
        💰 Budget de {monthName}
      </h3>
      
      {currentSettings && !currentSettings.isDefault && (
        <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="text-green-700 dark:text-green-300">
              <span className="font-medium">💰 Salaire:</span> {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              }).format(currentSettings.monthly_salary)}
            </div>
            <div className="text-green-700 dark:text-green-300">
              <span className="font-medium">🐷 Épargne:</span> {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              }).format(currentSettings.savings_goal)}
            </div>
            <div className="text-green-800 dark:text-green-200 font-medium">
              <span className="font-medium">💸 Disponible:</span> {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              }).format(currentSettings.monthly_salary - currentSettings.savings_goal)}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              💰 Salaire mensuel net
            </label>
            <input
              type="number"
              step="0.01"
              min="1000"
              max="50000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="2750"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              🐷 Objectif d'épargne
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="10000"
              value={savingsGoal}
              onChange={(e) => setSavingsGoal(e.target.value)}
              placeholder="800"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
        </div>

        {salary && savingsGoal && availableBudget > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              📊 Budget pour dépenses: {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
              }).format(availableBudget)}
            </p>
          </div>
        )}

        {salary && savingsGoal && availableBudget <= 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded">
            <p className="text-sm text-red-700 dark:text-red-300">
              ⚠️ Attention: Votre objectif d'épargne est trop élevé par rapport à votre salaire
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !salary || !savingsGoal}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Configuration en cours...' : 
           currentSettings && !currentSettings.isDefault ? 'Modifier le budget' : 'Définir le budget'}
        </button>

        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p>
            • Configure votre salaire mensuel et objectif d'épargne
          </p>
          <p>
            • Crée automatiquement une transaction de salaire dans vos revenus
          </p>
          <p>
            • Calcule votre budget disponible pour les dépenses
          </p>
        </div>
      </form>
    </div>
  );
};

export default IncomeForm;