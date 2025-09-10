import express from 'express';
import { db } from '../database/init';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest, Transaction, BudgetSummary, CategoryBreakdown } from '../types';
import { AppError, validateRequired, validateNumber, throwNotFoundError } from '../middleware/errorHandler';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Obtenir les transactions du mois avec calcul budgétaire automatique
router.get('/:month/:year', (req: AuthRequest, res): void => {
  console.log('📅 GET transactions appelé');
  const { month, year } = req.params;
  const { page = 1, limit = 50, category, sort = 'date_desc' } = req.query;
  const userId = req.user!.id;

  // Validation des paramètres
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  
  if (monthNum < 1 || monthNum > 12 || yearNum < 2020 || yearNum > 2030) {
    res.status(400).json({ error: 'Paramètres de date invalides' });
    return;
  }

  let orderBy = 'ORDER BY t.transaction_date DESC, t.id DESC';
  if (sort === 'amount_asc') orderBy = 'ORDER BY t.amount ASC';
  else if (sort === 'amount_desc') orderBy = 'ORDER BY t.amount DESC';
  else if (sort === 'category') orderBy = 'ORDER BY c.name ASC';

  let categoryFilter = '';
  let queryParams: any[] = [userId, month.padStart(2, '0'), year];
  
  if (category && category !== 'all') {
    categoryFilter = 'AND c.id = ?';
    queryParams.push(category);
  }

  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
  queryParams.push(parseInt(limit as string), offset);

  // D'abord récupérer le salaire de l'utilisateur pour ce mois
  db.get(
    'SELECT monthly_salary FROM user_budget_settings WHERE user_id = ? AND month = ? AND year = ?',
    [userId, monthNum, yearNum],
    (err, budgetSettings: any): void => {
      if (err) {
        console.error('❌ Erreur récupération budget:', err);
        res.status(500).json({ error: 'Erreur lors de la récupération du budget' });
        return;
      }

      // Si pas de budget défini, utiliser les valeurs par défaut
      const monthlySalary = budgetSettings?.monthly_salary || 2750;

      const query = `
        SELECT 
          t.id,
          t.amount,
          t.description,
          t.transaction_date,
          t.created_at,
          c.id as category_id,
          c.name as category_name,
          c.type as category_type,
          c.budget_amount,
          c.color as category_color
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ? 
        AND strftime('%m', t.transaction_date) = ? 
        AND strftime('%Y', t.transaction_date) = ?
        ${categoryFilter}
        ${orderBy}
        LIMIT ? OFFSET ?
      `;

      // Requête pour le total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ? 
        AND strftime('%m', t.transaction_date) = ? 
        AND strftime('%Y', t.transaction_date) = ?
        ${categoryFilter}
      `;

      db.get(countQuery, queryParams.slice(0, -2), (err, countResult: any): void => {
        if (err) {
          console.error('❌ Erreur comptage:', err);
          res.status(500).json({ error: 'Erreur lors du comptage' });
          return;
        }

        db.all(query, queryParams, (err, transactions): void => {
          if (err) {
            console.error('❌ Erreur DB transactions:', err);
            res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
            return;
          }
          
          console.log(`📊 ${transactions.length} transactions trouvées sur ${countResult.total}`);
          
          res.json({
            transactions,
            pagination: {
              page: parseInt(page as string),
              limit: parseInt(limit as string),
              total: countResult.total,
              totalPages: Math.ceil(countResult.total / parseInt(limit as string))
            },
            budgetInfo: {
              monthlySalary,
              month: monthNum,
              year: yearNum
            }
          });
        });
      });
    }
  );
});

// Ajouter une transaction avec validation du budget
router.post('/', (req: AuthRequest, res): void => {
  console.log('➕ POST transaction appelé');
  const { amount, description, category_id, transaction_date } = req.body;
  const userId = req.user!.id;
  let hasError = false; // Flag pour éviter les réponses multiples

  // Validation des champs requis
  const requiredErrors = validateRequired(req.body, ['amount', 'category_id', 'transaction_date']);
  if (requiredErrors.length > 0) {
    res.status(400).json({ 
      error: 'Champs requis manquants',
      validationErrors: requiredErrors
    });
    return;
  }

  // Validation du montant
  const amountErrors = validateNumber(amount, 'amount', 0.01, 50000);
  if (amountErrors.length > 0) {
    res.status(400).json({
      error: 'Montant invalide',
      validationErrors: amountErrors
    });
    return;
  }

  // Validation de la date
  const transactionDate = new Date(transaction_date);
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  if (transactionDate < twoYearsAgo || transactionDate > oneYearFromNow) {
    res.status(400).json({ error: 'Date de transaction invalide' });
    return;
  }

  // Récupérer le mois et l'année de la transaction
  const transactionMonth = transactionDate.getMonth() + 1;
  const transactionYear = transactionDate.getFullYear();

  // Vérifier que la catégorie appartient à l'utilisateur
  db.get(
    'SELECT id, type, budget_amount FROM categories WHERE id = ? AND user_id = ?',
    [category_id, userId],
    (err, category: any): void => {
      if (err) {
        console.error('❌ Erreur vérification catégorie:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (!category) {
        res.status(404).json({ error: 'Catégorie non trouvée ou non autorisée' });
        return;
      }

      // Récupérer ou créer le budget mensuel de l'utilisateur
      db.get(
        'SELECT * FROM user_budget_settings WHERE user_id = ? AND month = ? AND year = ?',
        [userId, transactionMonth, transactionYear],
        (err, budgetSettings: any): void => {
          if (err) {
            console.error('❌ Erreur budget settings:', err);
            res.status(500).json({ error: 'Erreur serveur' });
            return;
          }

          // Si pas de budget défini, créer avec les valeurs par défaut
          if (!budgetSettings) {
            const defaultSalary = 2750;
            const defaultSavingsGoal = 800;
            
            db.run(
              'INSERT INTO user_budget_settings (user_id, month, year, monthly_salary, savings_goal) VALUES (?, ?, ?, ?, ?)',
              [userId, transactionMonth, transactionYear, defaultSalary, defaultSavingsGoal],
              function(err): void {
                if (err) {
                  console.error('❌ Erreur création budget:', err);
                  res.status(500).json({ error: 'Erreur serveur' });
                  return;
                }
                
                // Continuer avec les valeurs par défaut
                processTransaction(defaultSalary, defaultSavingsGoal);
              }
            );
          } else {
            processTransaction(budgetSettings.monthly_salary, budgetSettings.savings_goal);
          }
        }
      );

      function processTransaction(monthlySalary: number, savingsGoal: number): void {
        if (hasError) return; // Éviter le traitement si erreur déjà survenue
        
        // Vérifier le budget disponible si c'est une dépense
        if (category.type !== 'income') {
          // Calculer les dépenses actuelles du mois
          db.get(
            `SELECT 
               COALESCE(SUM(CASE WHEN c.type = 'fixed_expense' THEN t.amount ELSE 0 END), 0) as fixed_expenses,
               COALESCE(SUM(CASE WHEN c.type = 'variable_expense' THEN t.amount ELSE 0 END), 0) as variable_expenses,
               COALESCE(SUM(CASE WHEN c.type = 'savings' THEN t.amount ELSE 0 END), 0) as current_savings
             FROM transactions t 
             JOIN categories c ON t.category_id = c.id
             WHERE t.user_id = ? 
             AND strftime('%m', t.transaction_date) = ? 
             AND strftime('%Y', t.transaction_date) = ?`,
            [userId, transactionMonth.toString().padStart(2, '0'), transactionYear.toString()],
            (err, currentSpending: any): void => {
              if (err) {
                console.error('❌ Erreur calcul dépenses:', err);
                if (!hasError) {
                  hasError = true;
                  res.status(500).json({ error: 'Erreur serveur' });
                }
                return;
              }

              const totalCurrentExpenses = currentSpending.fixed_expenses + currentSpending.variable_expenses;
              const remainingBudget = monthlySalary - totalCurrentExpenses - currentSpending.current_savings;
              
              // Calculer le nouveau reste après cette transaction
              let newRemainingBudget = remainingBudget;
              if (category.type === 'fixed_expense' || category.type === 'variable_expense') {
                newRemainingBudget = remainingBudget - amount;
              } else if (category.type === 'savings') {
                newRemainingBudget = remainingBudget - amount;
              }

              const warnings: string[] = [];
              
              // Vérifications budgétaires
              if (category.type === 'savings') {
                const newTotalSavings = currentSpending.current_savings + amount;
                if (newTotalSavings > savingsGoal) {
                  warnings.push(`Objectif d'épargne dépassé (${newTotalSavings}€ > ${savingsGoal}€)`);
                }
              }

              if (newRemainingBudget < 0) {
                warnings.push(`Budget mensuel dépassé de ${Math.abs(newRemainingBudget).toFixed(2)}€`);
              }

              if (newRemainingBudget < 100 && newRemainingBudget >= 0) {
                warnings.push(`Attention: il ne vous reste que ${newRemainingBudget.toFixed(2)}€ ce mois-ci`);
              }

              // Insérer la transaction
              const sqliteDate = transactionDate.toISOString().split('T')[0];

              db.run(
                'INSERT INTO transactions (user_id, category_id, amount, description, transaction_date) VALUES (?, ?, ?, ?, ?)',
                [userId, category_id, amount, description || '', sqliteDate],
                function (err): void {
                  if (err) {
                    console.error('❌ Erreur insertion transaction:', err);
                    if (!hasError) {
                      hasError = true;
                      res.status(500).json({ error: 'Erreur lors de l\'ajout de la transaction' });
                    }
                    return;
                  }

                  console.log('✅ Transaction créée avec ID:', this.lastID);
                  
                  if (!hasError) {
                    res.status(201).json({
                      message: 'Transaction ajoutée avec succès',
                      id: this.lastID,
                      budgetInfo: {
                        monthlySalary,
                        savingsGoal,
                        remainingBudget: newRemainingBudget,
                        totalExpenses: totalCurrentExpenses + (category.type !== 'income' && category.type !== 'savings' ? amount : 0)
                      },
                      warnings
                    });
                  }
                }
              );
            }
          );
        } else {
          // Pour les revenus, insérer directement
          const sqliteDate = transactionDate.toISOString().split('T')[0];
          
          db.run(
            'INSERT INTO transactions (user_id, category_id, amount, description, transaction_date) VALUES (?, ?, ?, ?, ?)',
            [userId, category_id, amount, description || '', sqliteDate],
            function (err): void {
              if (err) {
                console.error('❌ Erreur insertion transaction:', err);
                if (!hasError) {
                  hasError = true;
                  res.status(500).json({ error: 'Erreur lors de l\'ajout de la transaction' });
                }
                return;
              }

              console.log('✅ Transaction (revenu) créée avec ID:', this.lastID);
              
              if (!hasError) {
                res.status(201).json({
                  message: 'Revenu ajouté avec succès',
                  id: this.lastID,
                  budgetInfo: {
                    monthlySalary,
                    savingsGoal
                  }
                });
              }
            }
          );
        }
      }
    }
  );
});

// Modifier une transaction
router.put('/:id', (req: AuthRequest, res): void => {
  console.log('✏️ PUT transaction appelé');
  const { id } = req.params;
  const { amount, description, category_id, transaction_date } = req.body;
  const userId = req.user!.id;

  // Validation
  const requiredErrors = validateRequired(req.body, ['amount', 'category_id', 'transaction_date']);
  if (requiredErrors.length > 0) {
    res.status(400).json({ 
      error: 'Champs requis manquants',
      validationErrors: requiredErrors
    });
    return;
  }

  const amountErrors = validateNumber(amount, 'amount', 0.01, 50000);
  if (amountErrors.length > 0) {
    res.status(400).json({
      error: 'Montant invalide',
      validationErrors: amountErrors
    });
    return;
  }

  // Vérifier que la transaction appartient à l'utilisateur
  db.get(
    'SELECT id, amount as old_amount, category_id as old_category_id FROM transactions WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, transaction: any): void => {
      if (err) {
        console.error('❌ Erreur vérification transaction:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (!transaction) {
        res.status(404).json({ error: 'Transaction non trouvée ou non autorisée' });
        return;
      }

      // Vérifier que la catégorie appartient à l'utilisateur
      db.get(
        'SELECT id, type FROM categories WHERE id = ? AND user_id = ?',
        [category_id, userId],
        (err, category: any): void => {
          if (err) {
            console.error('❌ Erreur vérification catégorie:', err);
            res.status(500).json({ error: 'Erreur serveur' });
            return;
          }

          if (!category) {
            res.status(404).json({ error: 'Catégorie non trouvée ou non autorisée' });
            return;
          }

          const sqliteDate = new Date(transaction_date).toISOString().split('T')[0];

          db.run(
            'UPDATE transactions SET amount = ?, description = ?, category_id = ?, transaction_date = ? WHERE id = ? AND user_id = ?',
            [amount, description || '', category_id, sqliteDate, id, userId],
            function (err): void {
              if (err) {
                console.error('❌ Erreur mise à jour:', err);
                res.status(500).json({ error: 'Erreur lors de la modification' });
                return;
              }

              if (this.changes === 0) {
                res.status(404).json({ error: 'Transaction non trouvée' });
                return;
              }

              console.log('✅ Transaction mise à jour');
              res.json({ 
                message: 'Transaction modifiée avec succès',
                changes: {
                  oldAmount: transaction.old_amount,
                  newAmount: amount,
                  oldCategoryId: transaction.old_category_id,
                  newCategoryId: category_id
                }
              });
            }
          );
        }
      );
    }
  );
});

// Supprimer une transaction
router.delete('/:id', (req: AuthRequest, res): void => {
  console.log('🗑️ DELETE transaction appelé');
  const { id } = req.params;
  const userId = req.user!.id;

  // Récupérer les infos de la transaction avant suppression
  db.get(
    'SELECT amount, category_id FROM transactions WHERE id = ? AND user_id = ?',
    [id, userId],
    (err, transaction: any): void => {
      if (err) {
        console.error('❌ Erreur récupération transaction:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (!transaction) {
        res.status(404).json({ error: 'Transaction non trouvée ou non autorisée' });
        return;
      }

      db.run(
        'DELETE FROM transactions WHERE id = ? AND user_id = ?',
        [id, userId],
        function (err): void {
          if (err) {
            console.error('❌ Erreur suppression:', err);
            res.status(500).json({ error: 'Erreur lors de la suppression' });
            return;
          }

          if (this.changes === 0) {
            res.status(404).json({ error: 'Transaction non trouvée ou non autorisée' });
            return;
          }

          console.log('✅ Transaction supprimée');
          res.json({ 
            message: 'Transaction supprimée avec succès',
            deletedTransaction: {
              amount: transaction.amount,
              categoryId: transaction.category_id
            }
          });
        }
      );
    }
  );
});

// Obtenir le résumé mensuel basé sur le salaire
router.get('/summary/:month/:year', (req: AuthRequest, res): void => {
  console.log('📊 GET summary appelé');
  const { month, year } = req.params;
  const userId = req.user!.id;
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);

  // Récupérer les paramètres budgétaires de l'utilisateur
  db.get(
    'SELECT monthly_salary, savings_goal FROM user_budget_settings WHERE user_id = ? AND month = ? AND year = ?',
    [userId, monthNum, yearNum],
    (err, budgetSettings: any): void => {
      if (err) {
        console.error('❌ Erreur budget settings:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      // Valeurs par défaut si pas de settings
      const monthlySalary = budgetSettings?.monthly_salary || 2750;
      const savingsGoal = budgetSettings?.savings_goal || 800;

      const monthPadded = month.padStart(2, '0');

      const query = `
        SELECT 
          c.id,
          c.name as category,
          c.type,
          c.budget_amount,
          c.color,
          COALESCE(SUM(t.amount), 0) as spent,
          COUNT(t.id) as transaction_count
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id 
          AND t.user_id = ? 
          AND strftime('%m', t.transaction_date) = ? 
          AND strftime('%Y', t.transaction_date) = ?
        WHERE c.user_id = ?
        GROUP BY c.id, c.name, c.type, c.budget_amount, c.color
        ORDER BY c.type, c.name
      `;

      db.all(query, [userId, monthPadded, year, userId], (err, results: any[]): void => {
        if (err) {
          console.error('❌ Erreur calcul résumé:', err);
          res.status(500).json({ error: 'Erreur lors du calcul du résumé' });
          return;
        }

        // Calculs des totaux
        const totalIncome = results
          .filter(r => r.type === 'income')
          .reduce((sum, r) => sum + r.spent, 0);

        const totalFixedExpenses = results
          .filter(r => r.type === 'fixed_expense')
          .reduce((sum, r) => sum + r.spent, 0);

        const totalVariableExpenses = results
          .filter(r => r.type === 'variable_expense')
          .reduce((sum, r) => sum + r.spent, 0);

        const totalExpenses = totalFixedExpenses + totalVariableExpenses;

        const actualSavings = results
          .filter(r => r.type === 'savings')
          .reduce((sum, r) => sum + r.spent, 0);

        // Calcul basé sur le salaire mensuel
        const budgetBasedOnSalary = monthlySalary - totalExpenses - actualSavings;
        const remainingToSavingsGoal = Math.max(0, savingsGoal - actualSavings);
        const totalBudgetUsed = totalExpenses + actualSavings;
        const budgetUsagePercentage = (totalBudgetUsed / monthlySalary) * 100;

        // Breakdown par catégorie avec calculs basés sur le salaire
        const categoryBreakdown: CategoryBreakdown[] = results.map(r => {
          const percentage = r.budget_amount > 0 ? (r.spent / r.budget_amount) * 100 : 0;
          const isOverBudget = r.budget_amount > 0 && r.spent > r.budget_amount;
          const remaining = Math.max(0, r.budget_amount - r.spent);
          const salaryPercentage = (r.spent / monthlySalary) * 100;

          return {
            id: r.id,
            category: r.category,
            type: r.type,
            spent: r.spent,
            budget: r.budget_amount,
            remaining,
            percentage,
            salaryPercentage,
            isOverBudget,
            transactionCount: r.transaction_count,
            color: r.color || '#6366f1'
          };
        });

        const summary: BudgetSummary = {
          // Paramètres de base
          monthlySalary,
          savingsGoal,
          
          // Revenus et dépenses
          totalIncome,
          totalExpenses,
          totalFixedExpenses,
          totalVariableExpenses,
          actualSavings,
          
          // Calculs budgétaires
          remainingBudget: budgetBasedOnSalary,
          remainingToSavingsGoal,
          budgetUsagePercentage,
          
          // Breakdown et alertes
          categoryBreakdown,
          alerts: {
            overBudgetCategories: categoryBreakdown.filter(c => c.isOverBudget).length,
            savingsGoalAchieved: actualSavings >= savingsGoal,
            budgetExceeded: budgetBasedOnSalary < 0,
            lowBalance: budgetBasedOnSalary < 100 && budgetBasedOnSalary >= 0,
            highSpending: budgetUsagePercentage > 90
          }
        };

        console.log('📊 Summary calculé basé sur salaire:', summary);
        res.json(summary);
      });
    }
  );
});

// Définir/modifier le salaire mensuel et l'objectif d'épargne
router.post('/budget-settings/:month/:year', (req: AuthRequest, res): void => {
  console.log('⚙️ POST budget settings appelé');
  const { month, year } = req.params;
  const { monthly_salary, savings_goal } = req.body;
  const userId = req.user!.id;

  // Validation
  const requiredErrors = validateRequired(req.body, ['monthly_salary', 'savings_goal']);
  if (requiredErrors.length > 0) {
    res.status(400).json({ 
      error: 'Champs requis manquants',
      validationErrors: requiredErrors
    });
    return;
  }

  const salaryErrors = validateNumber(monthly_salary, 'monthly_salary', 1000, 50000);
  const savingsErrors = validateNumber(savings_goal, 'savings_goal', 0, 10000);

  if (salaryErrors.length > 0 || savingsErrors.length > 0) {
    res.status(400).json({
      error: 'Valeurs invalides',
      validationErrors: [...salaryErrors, ...savingsErrors]
    });
    return;
  }

  const monthNum = parseInt(month);
  const yearNum = parseInt(year);

  // Vérifier si des settings existent déjà
  db.get(
    'SELECT id FROM user_budget_settings WHERE user_id = ? AND month = ? AND year = ?',
    [userId, monthNum, yearNum],
    (err, existing): void => {
      if (err) {
        console.error('❌ Erreur vérification settings:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (existing) {
        // Mettre à jour
        db.run(
          'UPDATE user_budget_settings SET monthly_salary = ?, savings_goal = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND month = ? AND year = ?',
          [monthly_salary, savings_goal, userId, monthNum, yearNum],
          (err): void => {
            if (err) {
              console.error('❌ Erreur mise à jour settings:', err);
              res.status(500).json({ error: 'Erreur serveur' });
              return;
            }

            console.log('✅ Budget settings mis à jour');
            res.json({ 
              message: 'Paramètres budgétaires mis à jour',
              settings: { monthly_salary, savings_goal, month: monthNum, year: yearNum }
            });
          }
        );
      } else {
        // Créer
        db.run(
          'INSERT INTO user_budget_settings (user_id, month, year, monthly_salary, savings_goal) VALUES (?, ?, ?, ?, ?)',
          [userId, monthNum, yearNum, monthly_salary, savings_goal],
          (err): void => {
            if (err) {
              console.error('❌ Erreur création settings:', err);
              res.status(500).json({ error: 'Erreur serveur' });
              return;
            }

            console.log('✅ Budget settings créés');
            res.status(201).json({ 
              message: 'Paramètres budgétaires créés',
              settings: { monthly_salary, savings_goal, month: monthNum, year: yearNum }
            });
          }
        );
      }
    }
  );
});

// Obtenir les paramètres budgétaires
router.get('/budget-settings/:month/:year', (req: AuthRequest, res): void => {
  const { month, year } = req.params;
  const userId = req.user!.id;
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);

  db.get(
    'SELECT * FROM user_budget_settings WHERE user_id = ? AND month = ? AND year = ?',
    [userId, monthNum, yearNum],
    (err, settings: any): void => {
      if (err) {
        console.error('❌ Erreur récupération settings:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      if (!settings) {
        // Retourner les valeurs par défaut
        res.json({
          monthly_salary: 2750,
          savings_goal: 800,
          month: monthNum,
          year: yearNum,
          isDefault: true
        });
      } else {
        res.json({
          ...settings,
          isDefault: false
        });
      }
    }
  );
});

// Route de debug (à supprimer en production)
router.get('/debug/all', (req: AuthRequest, res): void => {
  const userId = req.user!.id;
  
  db.all(
    `SELECT 
       t.*, 
       c.name as category_name, 
       c.type as category_type,
       s.monthly_salary,
       s.savings_goal
     FROM transactions t 
     JOIN categories c ON t.category_id = c.id 
     LEFT JOIN user_budget_settings s ON s.user_id = t.user_id 
       AND s.month = strftime('%m', t.transaction_date)
       AND s.year = strftime('%Y', t.transaction_date)
     WHERE t.user_id = ? 
     ORDER BY t.transaction_date DESC 
     LIMIT 100`,
    [userId],
    (err, transactions): void => {
      if (err) {
        console.error('❌ Erreur debug:', err);
        res.status(500).json({ error: 'Erreur' });
        return;
      }
      
      res.json(transactions);
    }
  );
});

export default router;