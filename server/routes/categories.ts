import express from 'express';
import { db, dbManager } from '../database/init';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest, Category, CreateCategoryData, CategoryType } from '../types';
import { 
  validateRequired, 
  validateString, 
  validateCategoryBudget, 
  throwValidationError 
} from '../middleware/errorHandler';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Types pour les réponses de la base de données
interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  type: CategoryType;
  budget_amount: number;
  color: string;
  created_at: string;
  updated_at: string;
}

interface TransactionCountResult {
  count: number;
}

interface CategoryStatsResult {
  month: string;
  transaction_count: number;
  total_amount: number;
  avg_amount: number;
  min_amount: number;
  max_amount: number;
}

interface GlobalStatsResult {
  total_transactions: number;
  total_spent: number;
  avg_transaction: number;
  first_transaction: string | null;
  last_transaction: string | null;
}

// Obtenir toutes les catégories de l'utilisateur
router.get('/', (req: AuthRequest, res) => {
  console.log('📁 GET /categories appelé');
  const userId = req.user!.id;
  const { type } = req.query;

  let query = `
    SELECT 
      id,
      name,
      type,
      budget_amount,
      color,
      created_at,
      updated_at
    FROM categories 
    WHERE user_id = ?
  `;
  
  const queryParams: any[] = [userId];

  // Filtrer par type si spécifié
  if (type && typeof type === 'string') {
    const validTypes: CategoryType[] = ['income', 'fixed_expense', 'variable_expense', 'savings'];
    if (!validTypes.includes(type as CategoryType)) {
      res.status(400).json({ 
        error: 'Type de catégorie invalide',
        validTypes 
      });
      return;
    }
    query += ' AND type = ?';
    queryParams.push(type);
  }

  query += ' ORDER BY type, name';

  console.log(`🔍 Recherche catégories pour user ${userId}${type ? ` de type ${type}` : ''}`);

  db.all<CategoryRow>(query, queryParams, (err, categories) => {
    if (err) {
      console.error('❌ Erreur récupération catégories:', err);
      res.status(500).json({ error: 'Erreur lors de la récupération des catégories' });
      return;
    }

    console.log(`📊 ${categories?.length || 0} catégories trouvées`);

    // S'assurer que categories est un tableau
    const categoriesList = categories || [];

    // Grouper par type pour faciliter l'affichage côté client
    const groupedCategories = {
      income: categoriesList.filter(c => c.type === 'income'),
      fixed_expense: categoriesList.filter(c => c.type === 'fixed_expense'),
      variable_expense: categoriesList.filter(c => c.type === 'variable_expense'),
      savings: categoriesList.filter(c => c.type === 'savings')
    };

    res.json({
      categories: categoriesList,
      grouped: groupedCategories,
      stats: {
        total: categoriesList.length,
        income: groupedCategories.income.length,
        fixed_expense: groupedCategories.fixed_expense.length,
        variable_expense: groupedCategories.variable_expense.length,
        savings: groupedCategories.savings.length,
        totalBudget: categoriesList.reduce((sum, cat) => sum + (cat.budget_amount || 0), 0)
      }
    });
  });
});

// Obtenir une catégorie spécifique
router.get('/:id', (req: AuthRequest, res) => {
  console.log('📁 GET /categories/:id appelé');
  const { id } = req.params;
  const userId = req.user!.id;

  // Validation de l'ID
  const categoryId = parseInt(id);
  if (isNaN(categoryId)) {
    res.status(400).json({ error: 'ID de catégorie invalide' });
    return;
  }

  db.get<CategoryRow>(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, userId],
    (err, category) => {
      if (err) {
        console.error('❌ Erreur récupération catégorie:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération de la catégorie' });
        return;
      }

      if (!category) {
        res.status(404).json({ error: 'Catégorie non trouvée' });
        return;
      }

      console.log('✅ Catégorie trouvée:', category);
      res.json(category);
    }
  );
});

// Créer une nouvelle catégorie
router.post('/', (req: AuthRequest, res) => {
  console.log('📁 POST /categories appelé');
  console.log('📋 Body:', req.body);
  
  const { name, type, budget_amount = 0, color = '#6366f1' }: CreateCategoryData = req.body;
  const userId = req.user!.id;

  // Validation des champs requis
  const requiredErrors = validateRequired(req.body, ['name', 'type']);
  if (requiredErrors.length > 0) {
    res.status(400).json({
      error: 'Champs requis manquants',
      validationErrors: requiredErrors
    });
    return;
  }

  // Validation du nom
  const nameErrors = validateString(name, 'name', 2, 100);
  if (nameErrors.length > 0) {
    res.status(400).json({
      error: 'Nom de catégorie invalide',
      validationErrors: nameErrors
    });
    return;
  }

  // Validation du type
  const validTypes: CategoryType[] = ['income', 'fixed_expense', 'variable_expense', 'savings'];
  if (!validTypes.includes(type)) {
    res.status(400).json({
      error: 'Type de catégorie invalide',
      validValues: validTypes
    });
    return;
  }

  // Validation du budget
  const budgetErrors = validateCategoryBudget(budget_amount, type);
  if (budgetErrors.length > 0) {
    res.status(400).json({
      error: 'Budget invalide',
      validationErrors: budgetErrors
    });
    return;
  }

  // Validation de la couleur (format hex)
  const colorRegex = /^#[0-9A-F]{6}$/i;
  if (color && !colorRegex.test(color)) {
    res.status(400).json({
      error: 'Format de couleur invalide (utilisez #RRGGBB)'
    });
    return;
  }

  const trimmedName = name.trim();

  // Vérifier que le nom n'existe pas déjà pour cet utilisateur
  db.get<{ id: number }>(
    'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ?',
    [trimmedName, userId],
    (err, existingCategory) => {
      if (err) {
        console.error('❌ Erreur vérification nom catégorie:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (existingCategory) {
        res.status(409).json({
          error: 'Une catégorie avec ce nom existe déjà',
          suggestion: 'Choisissez un nom différent'
        });
        return;
      }

      // Créer la catégorie
      db.run(
        'INSERT INTO categories (user_id, name, type, budget_amount, color) VALUES (?, ?, ?, ?, ?)',
        [userId, trimmedName, type, budget_amount, color],
        function(err) {
          if (err) {
            console.error('❌ Erreur création catégorie:', err);
            res.status(500).json({ error: 'Erreur lors de la création de la catégorie' });
            return;
          }

          const categoryId = this.lastID;
          console.log('✅ Catégorie créée avec ID:', categoryId);

          // Retourner la catégorie créée
          db.get<CategoryRow>(
            'SELECT * FROM categories WHERE id = ?',
            [categoryId],
            (err, newCategory) => {
              if (err) {
                console.error('❌ Erreur récupération nouvelle catégorie:', err);
                res.status(500).json({ error: 'Catégorie créée mais erreur de récupération' });
                return;
              }

              res.status(201).json({
                message: 'Catégorie créée avec succès',
                category: newCategory
              });
            }
          );
        }
      );
    }
  );
});

// Modifier une catégorie
router.put('/:id', (req: AuthRequest, res) => {
  console.log('📁 PUT /categories/:id appelé');
  const { id } = req.params;
  const { name, type, budget_amount, color } = req.body;
  const userId = req.user!.id;

  // Validation de l'ID
  const categoryId = parseInt(id);
  if (isNaN(categoryId)) {
    res.status(400).json({ error: 'ID de catégorie invalide' });
    return;
  }

  // Validation des champs requis
  const requiredErrors = validateRequired(req.body, ['name', 'type']);
  if (requiredErrors.length > 0) {
    res.status(400).json({
      error: 'Champs requis manquants',
      validationErrors: requiredErrors
    });
    return;
  }

  // Vérifier que la catégorie existe et appartient à l'utilisateur
  db.get<CategoryRow>(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, userId],
    (err, category) => {
      if (err) {
        console.error('❌ Erreur vérification catégorie:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (!category) {
        res.status(404).json({ error: 'Catégorie non trouvée ou non autorisée' });
        return;
      }

      const trimmedName = name.trim();

      // Fonction pour effectuer la mise à jour
      function performUpdate() {
        // Validation du type
        const validTypes: CategoryType[] = ['income', 'fixed_expense', 'variable_expense', 'savings'];
        if (!validTypes.includes(type)) {
          res.status(400).json({
            error: 'Type de catégorie invalide',
            validValues: validTypes
          });
          return;
        }

        // Validation du budget
        const budgetToUpdate = budget_amount !== undefined ? budget_amount : category.budget_amount;
        const budgetErrors = validateCategoryBudget(budgetToUpdate, type);
        if (budgetErrors.length > 0) {
          res.status(400).json({
            error: 'Budget invalide',
            validationErrors: budgetErrors
          });
          return;
        }

        // Validation de la couleur
        const colorToUpdate = color || category.color;
        const colorRegex = /^#[0-9A-F]{6}$/i;
        if (!colorRegex.test(colorToUpdate)) {
          res.status(400).json({
            error: 'Format de couleur invalide (utilisez #RRGGBB)'
          });
          return;
        }

        // Mettre à jour la catégorie
        db.run(
          `UPDATE categories 
           SET name = ?, type = ?, budget_amount = ?, color = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ? AND user_id = ?`,
          [trimmedName, type, budgetToUpdate, colorToUpdate, categoryId, userId],
          function(err) {
            if (err) {
              console.error('❌ Erreur mise à jour catégorie:', err);
              res.status(500).json({ error: 'Erreur lors de la modification de la catégorie' });
              return;
            }

            if (this.changes === 0) {
              res.status(404).json({ error: 'Catégorie non trouvée' });
              return;
            }

            console.log('✅ Catégorie mise à jour');

            // Retourner la catégorie mise à jour
            db.get<CategoryRow>(
              'SELECT * FROM categories WHERE id = ?',
              [categoryId],
              (err, updatedCategory) => {
                if (err) {
                  console.error('❌ Erreur récupération catégorie mise à jour:', err);
                  res.status(500).json({ error: 'Modification réussie mais erreur de récupération' });
                  return;
                }

                res.json({
                  message: 'Catégorie modifiée avec succès',
                  category: updatedCategory
                });
              }
            );
          }
        );
      }

      // Validation du nom si différent
      if (trimmedName.toLowerCase() !== category.name.toLowerCase()) {
        const nameErrors = validateString(name, 'name', 2, 100);
        if (nameErrors.length > 0) {
          res.status(400).json({
            error: 'Nom de catégorie invalide',
            validationErrors: nameErrors
          });
          return;
        }

        // Vérifier l'unicité du nouveau nom
        db.get<{ id: number }>(
          'SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND user_id = ? AND id != ?',
          [trimmedName, userId, categoryId],
          (err, existingCategory) => {
            if (err) {
              console.error('❌ Erreur vérification unicité nom:', err);
              res.status(500).json({ error: 'Erreur serveur' });
              return;
            }

            if (existingCategory) {
              res.status(409).json({
                error: 'Une autre catégorie avec ce nom existe déjà'
              });
              return;
            }

            performUpdate();
          }
        );
      } else {
        performUpdate();
      }
    }
  );
});

// Supprimer une catégorie
router.delete('/:id', (req: AuthRequest, res) => {
  console.log('📁 DELETE /categories/:id appelé');
  const { id } = req.params;
  const userId = req.user!.id;

  // Validation de l'ID
  const categoryId = parseInt(id);
  if (isNaN(categoryId)) {
    res.status(400).json({ error: 'ID de catégorie invalide' });
    return;
  }

  // Vérifier d'abord s'il y a des transactions liées à cette catégorie
  db.get<TransactionCountResult>(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ? AND user_id = ?',
    [categoryId, userId],
    (err, result) => {
      if (err) {
        console.error('❌ Erreur vérification transactions liées:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (result && result.count > 0) {
        res.status(400).json({
          error: 'Impossible de supprimer cette catégorie',
          reason: `${result.count} transaction(s) sont liées à cette catégorie`,
          suggestion: 'Supprimez d\'abord les transactions ou changez leur catégorie'
        });
        return;
      }

      // Vérifier que la catégorie existe et appartient à l'utilisateur
      db.get<{ name: string }>(
        'SELECT name FROM categories WHERE id = ? AND user_id = ?',
        [categoryId, userId],
        (err, category) => {
          if (err) {
            console.error('❌ Erreur vérification catégorie:', err);
            res.status(500).json({ error: 'Erreur serveur' });
            return;
          }

          if (!category) {
            res.status(404).json({ error: 'Catégorie non trouvée ou non autorisée' });
            return;
          }

          // Supprimer la catégorie
          db.run(
            'DELETE FROM categories WHERE id = ? AND user_id = ?',
            [categoryId, userId],
            function(err) {
              if (err) {
                console.error('❌ Erreur suppression catégorie:', err);
                res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie' });
                return;
              }

              if (this.changes === 0) {
                res.status(404).json({ error: 'Catégorie non trouvée' });
                return;
              }

              console.log('✅ Catégorie supprimée:', category.name);
              res.json({
                message: 'Catégorie supprimée avec succès',
                deletedCategory: {
                  id: categoryId,
                  name: category.name
                }
              });
            }
          );
        }
      );
    }
  );
});

// Obtenir les statistiques d'utilisation des catégories
router.get('/:id/stats', (req: AuthRequest, res) => {
  console.log('📁 GET /categories/:id/stats appelé');
  const { id } = req.params;
  const userId = req.user!.id;
  const yearParam = req.query.year;
  
  // Validation de l'ID
  const categoryId = parseInt(id);
  if (isNaN(categoryId)) {
    res.status(400).json({ error: 'ID de catégorie invalide' });
    return;
  }

  // Validation de l'année
  const currentYear = new Date().getFullYear();
  let year = currentYear;
  
  if (yearParam) {
    year = parseInt(yearParam as string);
    if (isNaN(year) || year < 2000 || year > currentYear + 1) {
      res.status(400).json({ 
        error: 'Année invalide',
        validRange: `2000-${currentYear + 1}`
      });
      return;
    }
  }

  // Vérifier que la catégorie appartient à l'utilisateur
  db.get<CategoryRow>(
    'SELECT * FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, userId],
    (err, category) => {
      if (err) {
        console.error('❌ Erreur vérification catégorie:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (!category) {
        res.status(404).json({ error: 'Catégorie non trouvée' });
        return;
      }

      // Obtenir les statistiques mensuelles pour l'année
      db.all<CategoryStatsResult>(
        `SELECT 
           strftime('%m', transaction_date) as month,
           COUNT(*) as transaction_count,
           SUM(amount) as total_amount,
           AVG(amount) as avg_amount,
           MIN(amount) as min_amount,
           MAX(amount) as max_amount
         FROM transactions 
         WHERE category_id = ? AND user_id = ? AND strftime('%Y', transaction_date) = ?
         GROUP BY strftime('%m', transaction_date)
         ORDER BY month`,
        [categoryId, userId, year.toString()],
        (err, monthlyStats) => {
          if (err) {
            console.error('❌ Erreur récupération stats:', err);
            res.status(500).json({ error: 'Erreur lors du calcul des statistiques' });
            return;
          }

          // Obtenir les statistiques globales
          db.get<GlobalStatsResult>(
            `SELECT 
               COUNT(*) as total_transactions,
               COALESCE(SUM(amount), 0) as total_spent,
               AVG(amount) as avg_transaction,
               MIN(transaction_date) as first_transaction,
               MAX(transaction_date) as last_transaction
             FROM transactions 
             WHERE category_id = ? AND user_id = ?`,
            [categoryId, userId],
            (err, globalStats) => {
              if (err) {
                console.error('❌ Erreur stats globales:', err);
                res.status(500).json({ error: 'Erreur lors du calcul des statistiques globales' });
                return;
              }

              // Calculer le pourcentage d'utilisation du budget
              const yearlyBudget = category.budget_amount * 12;
              const budgetUsagePercentage = yearlyBudget > 0 
                ? ((globalStats?.total_spent || 0) / yearlyBudget) * 100 
                : 0;

              res.json({
                category: {
                  id: category.id,
                  name: category.name,
                  type: category.type,
                  budget_amount: category.budget_amount,
                  color: category.color
                },
                year,
                monthlyStats: monthlyStats || [],
                globalStats: {
                  total_transactions: globalStats?.total_transactions || 0,
                  total_spent: globalStats?.total_spent || 0,
                  avg_transaction: globalStats?.avg_transaction || 0,
                  first_transaction: globalStats?.first_transaction || null,
                  last_transaction: globalStats?.last_transaction || null
                },
                budgetAnalysis: {
                  monthlyBudget: category.budget_amount,
                  yearlyBudget,
                  totalSpent: globalStats?.total_spent || 0,
                  budgetUsagePercentage: Math.round(budgetUsagePercentage * 100) / 100,
                  remainingBudget: Math.max(0, yearlyBudget - (globalStats?.total_spent || 0)),
                  isOverBudget: (globalStats?.total_spent || 0) > yearlyBudget
                }
              });
            }
          );
        }
      );
    }
  );
});

// Route pour obtenir les catégories avec leurs transactions récentes
router.get('/with-transactions/recent', (req: AuthRequest, res) => {
  console.log('📁 GET /categories/with-transactions/recent appelé');
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string) || 5;

  if (limit < 1 || limit > 20) {
    res.status(400).json({ 
      error: 'Limite invalide',
      validRange: '1-20'
    });
    return;
  }

  // Récupérer toutes les catégories
  db.all<CategoryRow>(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY type, name',
    [userId],
    (err, categories) => {
      if (err) {
        console.error('❌ Erreur récupération catégories:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (!categories || categories.length === 0) {
        res.json({ categories: [] });
        return;
      }

      // Pour chaque catégorie, récupérer les transactions récentes
      const categoriesWithTransactions: any[] = [];
      let processedCount = 0;
      let hasError = false;

      categories.forEach(category => {
        if (hasError) return; // Arrêter si une erreur s'est produite

        db.all(
          `SELECT 
             id,
             amount,
             description,
             transaction_date,
             payment_method
           FROM transactions 
           WHERE category_id = ? AND user_id = ?
           ORDER BY transaction_date DESC
           LIMIT ?`,
          [category.id, userId, limit],
          (err, transactions) => {
            if (hasError) return; // Ne pas traiter si une erreur s'est déjà produite

            if (err) {
              console.error(`❌ Erreur récupération transactions pour catégorie ${category.id}:`, err);
              hasError = true;
              res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
              return;
            }

            categoriesWithTransactions.push({
              ...category,
              recentTransactions: transactions || []
            });

            processedCount++;

            // Si toutes les catégories ont été traitées, envoyer la réponse
            if (processedCount === categories.length && !hasError) {
              res.json({
                categories: categoriesWithTransactions.sort((a, b) => {
                  // Trier par type puis par nom
                  if (a.type !== b.type) {
                    const typeOrder = ['income', 'fixed_expense', 'variable_expense', 'savings'];
                    return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
                  }
                  return a.name.localeCompare(b.name);
                })
              });
            }
          }
        );
      });
    }
  );
});

export default router;