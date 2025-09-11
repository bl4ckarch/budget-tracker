import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../hooks/useApi';

interface Category {
  id: number;
  name: string;
  type: string;
  budget_amount?: number;
  color?: string;
}

interface Transaction {
  id?: number;
  amount: number;
  description: string;
  category_id: number;
  transaction_date: string;
  category_name?: string;
  category_type?: string;
}

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTransaction?: Transaction | null;
  currentDate?: Date;
}

const TransactionForm: React.FC<TransactionFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingTransaction,
  currentDate = new Date(),
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      
      if (editingTransaction) {
        setFormData({
          amount: editingTransaction.amount.toString(),
          description: editingTransaction.description || '',
          category_id: editingTransaction.category_id.toString(),
          transaction_date: editingTransaction.transaction_date,
        });
      } else {
        // Définir la date par défaut au mois courant
        const defaultDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
          .toISOString().split('T')[0];
        
        setFormData({
          amount: '',
          description: '',
          category_id: '',
          transaction_date: defaultDate,
        });
      }
    }
  }, [isOpen, editingTransaction, currentDate]);

  const fetchCategories = async () => {
    try {
      console.log('🔄 Début récupération des catégories...');
      const data = await apiRequest('/categories');
      console.log('📦 Réponse brute de l\'API:', data);
      console.log('📦 Type de la réponse:', typeof data);
      
      // Adapter selon la structure de réponse de votre API
      const categoriesList = data.categories || data;
      console.log('📋 Liste des catégories extraite:', categoriesList);
      console.log('📋 Est-ce un tableau?', Array.isArray(categoriesList));
      
      if (Array.isArray(categoriesList)) {
        console.log(`📊 ${categoriesList.length} catégorie(s) reçue(s):`, categoriesList);
        
        // Afficher le détail de chaque catégorie
        categoriesList.forEach((cat: Category, index: number) => {
          console.log(`   ${index + 1}. "${cat.name}" (type: "${cat.type}", id: ${cat.id})`);
        });
        
        // Pour un formulaire de dépenses, filtrer les catégories appropriées
        const expenseCategories = categoriesList.filter(
          (cat: Category) => cat.type === 'fixed_expense' || cat.type === 'variable_expense' || cat.type === 'savings'
        );
        
        console.log(`✅ ${expenseCategories.length} catégorie(s) de dépenses filtrée(s):`, expenseCategories);
        
        // Si aucune catégorie de dépense n'est trouvée, afficher toutes les catégories
        // (temporaire en attendant la création des bonnes catégories)
        if (expenseCategories.length === 0) {
          console.warn('⚠️ Aucune catégorie de dépense trouvée! Affichage temporaire de toutes les catégories.');
          setCategories(categoriesList);
          setError('Attention: Seulement des catégories temporaires disponibles. Créez des catégories de dépenses pour un meilleur usage.');
        } else {
          setCategories(expenseCategories);
        }
      } else {
        console.error('❌ Format de données inattendu pour les catégories:', data);
        console.error('❌ Type attendu: Array, reçu:', typeof categoriesList);
        setCategories([]);
        setError('Format de réponse API inattendu pour les catégories');
      }
    } catch (err: any) {
      console.error('❌ Erreur récupération catégories:', err);
      console.error('❌ Stack trace:', err.stack);
      setError(`Impossible de charger les catégories: ${err.message}`);
    }
  };

  const validateAmount = (amount: number) => {
    if (amount <= 0) {
      return 'Le montant doit être positif';
    }
    if (amount > 50000) {
      return 'Le montant ne peut pas dépasser 50 000€';
    }
    return null;
  };

  const validateDate = (date: string) => {
    const transactionDate = new Date(date);
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    if (transactionDate < twoYearsAgo) {
      return 'La date ne peut pas être antérieure à 2 ans';
    }
    if (transactionDate > oneYearFromNow) {
      return 'La date ne peut pas être dans plus d\'un an';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation des champs
    if (!formData.amount || !formData.category_id || !formData.transaction_date) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const amount = parseFloat(formData.amount);
    
    // Validations personnalisées
    const amountError = validateAmount(amount);
    if (amountError) {
      setError(amountError);
      return;
    }

    const dateError = validateDate(formData.transaction_date);
    if (dateError) {
      setError(dateError);
      return;
    }

    setLoading(true);
    setError(null);
    setBudgetWarning(null);

    try {
      const payload = {
        amount: amount,
        description: formData.description.trim(),
        category_id: parseInt(formData.category_id),
        transaction_date: formData.transaction_date,
      };

      let response;
      if (editingTransaction) {
        response = await apiRequest(`/transactions/${editingTransaction.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        response = await apiRequest('/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      // Vérifier les avertissements budgétaires dans la réponse
      if (response.warnings && response.warnings.length > 0) {
        setBudgetWarning(response.warnings.join(', '));
      }

      // Attendre un peu pour que l'utilisateur puisse voir l'avertissement
      if (response.warnings && response.warnings.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        onSuccess();
        onClose();
      }

    } catch (err: any) {
      console.error('Erreur soumission transaction:', err);
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'income': return '💰';
      case 'fixed_expense': return '🏠';
      case 'variable_expense': return '🛒';
      case 'savings': return '🐷';
      default: return '📄';
    }
  };

  const getCategoryTypeLabel = (type: string) => {
    switch (type) {
      case 'income': return 'Revenu';
      case 'fixed_expense': return 'Dépense fixe';
      case 'variable_expense': return 'Dépense variable';
      case 'savings': return 'Épargne';
      default: return 'Autre';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingTransaction ? 'Modifier la transaction' : 'Nouvelle dépense'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl font-bold"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {budgetWarning && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ {budgetWarning}
                </p>
              </div>
            )}

            {/* Debug: Afficher le nombre de catégories disponibles */}
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Debug: {categories.length} catégorie(s) disponible(s)
                  {categories.length > 0 && (
                    <span> - Types: {categories.map(c => c.type).join(', ')}</span>
                  )}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Montant (€) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="50000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Catégorie *
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              >
                <option value="">Sélectionner une catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {getCategoryIcon(category.type)} {category.name} ({getCategoryTypeLabel(category.type)})
                  </option>
                ))}
              </select>
              {categories.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  ⚠️ Aucune catégorie disponible. Vérifiez que des catégories existent dans votre système.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                rows={3}
                maxLength={500}
                placeholder="Description optionnelle (ex: Courses chez Carrefour)"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.description.length}/500 caractères
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || categories.length === 0}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Enregistrement...' : editingTransaction ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TransactionForm;