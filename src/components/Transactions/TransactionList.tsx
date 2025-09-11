import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../hooks/useApi';
import TransactionForm from './TransactionForm';

interface Transaction {
  id: number;
  amount: number;
  description: string;
  category_id: number;
  category_name: string;
  category_type: string;
  category_color?: string;
  transaction_date: string;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
  type: string;
}

interface TransactionListProps {
  currentDate: Date;
  onRefresh?: () => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ currentDate, onRefresh }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // États pour le formulaire de transaction
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, [currentDate]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      
      console.log('🔍 Récupération transactions pour:', { month, year });
      
      const data = await apiRequest(`/transactions/${month}/${year}`);
      console.log('📊 Données reçues:', data);
      
      // Vérification de sécurité - s'assurer que c'est un tableau
      if (data && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      } else if (data && Array.isArray(data)) {
        setTransactions(data);
      } else {
        console.warn('Format de données inattendu:', data);
        setTransactions([]);
      }
      
    } catch (err: any) {
      console.error('❌ Erreur récupération transactions:', err);
      setError(err.message || 'Erreur lors de la récupération des transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Fonction sécurisée pour obtenir les catégories uniques
  const getUniqueCategories = (): Category[] => {
    // Vérification de sécurité critique
    if (!Array.isArray(transactions)) {
      console.warn('transactions n\'est pas un tableau:', transactions);
      return [];
    }

    const uniqueCategories = transactions.reduce((acc: Category[], transaction) => {
      const exists = acc.find(cat => cat.id === transaction.category_id);
      if (!exists && transaction.category_id && transaction.category_name) {
        acc.push({
          id: transaction.category_id,
          name: transaction.category_name,
          type: transaction.category_type,
        });
      }
      return acc;
    }, []);

    return uniqueCategories;
  };

  // Fonction pour supprimer une transaction
  const handleDeleteTransaction = async (transactionId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      return;
    }

    try {
      await apiRequest(`/transactions/${transactionId}`, {
        method: 'DELETE'
      });
      
      fetchTransactions(); // Actualiser la liste
      if (onRefresh) onRefresh(); // Notifier le parent
    } catch (err: any) {
      alert('Erreur lors de la suppression : ' + err.message);
    }
  };

  // Filtrer les transactions par catégorie sélectionnée
  const filteredTransactions = selectedCategory === 'all' 
    ? transactions 
    : transactions.filter(t => t.category_id.toString() === selectedCategory);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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

  const getCategoryColor = (type: string) => {
    switch (type) {
      case 'income': return 'text-green-600 bg-green-50';
      case 'fixed_expense': return 'text-red-600 bg-red-50';
      case 'variable_expense': return 'text-orange-600 bg-orange-50';
      case 'savings': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Erreur de chargement
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
          <button
            onClick={fetchTransactions}
            className="mt-3 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const uniqueCategories = getUniqueCategories();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transactions - {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowTransactionForm(true)}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
            >
              + Ajouter une dépense
            </button>
            <button
              onClick={fetchTransactions}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
            >
              Actualiser
            </button>
          </div>
        </div>

        {/* Filtre par catégorie */}
        {uniqueCategories.length > 0 && (
          <div className="mb-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Toutes les catégories ({transactions.length})</option>
              {uniqueCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {getCategoryIcon(category.type)} {category.name} ({transactions.filter(t => t.category_id === category.id).length})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredTransactions.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p>Aucune transaction trouvée pour cette période.</p>
            {selectedCategory !== 'all' && (
              <button
                onClick={() => setSelectedCategory('all')}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Voir toutes les transactions
              </button>
            )}
          </div>
        ) : (
          filteredTransactions.map((transaction) => (
            <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(transaction.category_type)}`}>
                      {getCategoryIcon(transaction.category_type)} {transaction.category_name}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-900 dark:text-white font-medium">
                    {transaction.description || 'Sans description'}
                  </p>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(transaction.transaction_date)}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className={`text-lg font-semibold mb-2 ${
                    transaction.category_type === 'income' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {transaction.category_type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </p>
                  
                  {/* Boutons d'action (seulement pour les dépenses, pas le salaire) */}
                  {transaction.category_type !== 'income' && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setEditingTransaction(transaction);
                          setShowTransactionForm(true);
                        }}
                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(transaction.id)}
                        className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredTransactions.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredTransactions.length} transaction(s) affichée(s)
            {selectedCategory !== 'all' && ` sur ${transactions.length} au total`}
          </div>
        </div>
      )}

      {/* Formulaire de transaction */}
      <TransactionForm
        isOpen={showTransactionForm}
        onClose={() => {
          setShowTransactionForm(false);
          setEditingTransaction(null);
        }}
        onSuccess={() => {
          fetchTransactions();
          if (onRefresh) onRefresh();
        }}
        editingTransaction={editingTransaction}
        currentDate={currentDate}
      />
    </div>
  );
};

export default TransactionList;