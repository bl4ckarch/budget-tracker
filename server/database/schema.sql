-- =====================================================
-- BUDGET TRACKER DATABASE SCHEMA (SALARY-BASED)
-- =====================================================

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  firstName VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les recherches par email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- TABLE PARAMÈTRES BUDGÉTAIRES PAR MOIS
-- =====================================================
-- Cette table stocke le salaire mensuel et les objectifs d'épargne
-- pour chaque utilisateur, par mois/année
CREATE TABLE IF NOT EXISTS user_budget_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2030),
  monthly_salary DECIMAL(10,2) NOT NULL DEFAULT 2750.00,
  savings_goal DECIMAL(10,2) NOT NULL DEFAULT 800.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, month, year)
);

-- Index pour optimiser les recherches par utilisateur/mois/année
CREATE INDEX IF NOT EXISTS idx_budget_settings_user_date ON user_budget_settings(user_id, year, month);

-- =====================================================
-- TABLE CATÉGORIES
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'fixed_expense', 'variable_expense', 'savings')),
  budget_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  color VARCHAR(7) DEFAULT '#6366f1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(user_id, type);

-- =====================================================
-- TABLE TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  transaction_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Index pour optimiser les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions(user_id, strftime('%Y-%m', transaction_date));
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- =====================================================
-- VUES POUR FACILITER LES REQUÊTES
-- =====================================================

-- Vue pour les transactions avec informations de catégorie
CREATE VIEW IF NOT EXISTS v_transactions_with_category AS
SELECT 
  t.id,
  t.user_id,
  t.amount,
  t.description,
  t.transaction_date,
  t.created_at,
  t.updated_at,
  c.id as category_id,
  c.name as category_name,
  c.type as category_type,
  c.budget_amount as category_budget,
  c.color as category_color,
  strftime('%Y', t.transaction_date) as year,
  strftime('%m', t.transaction_date) as month,
  strftime('%Y-%m', t.transaction_date) as year_month
FROM transactions t
JOIN categories c ON t.category_id = c.id;

-- Vue pour les résumés mensuels par utilisateur
CREATE VIEW IF NOT EXISTS v_monthly_summary AS
SELECT 
  t.user_id,
  strftime('%Y', t.transaction_date) as year,
  strftime('%m', t.transaction_date) as month,
  c.type as category_type,
  SUM(t.amount) as total_amount,
  COUNT(t.id) as transaction_count,
  AVG(t.amount) as avg_amount
FROM transactions t
JOIN categories c ON t.category_id = c.id
GROUP BY t.user_id, strftime('%Y-%m', t.transaction_date), c.type;

-- =====================================================
-- TRIGGERS POUR MAINTENIR LES TIMESTAMPS
-- =====================================================

-- Trigger pour mettre à jour updated_at sur users
CREATE TRIGGER IF NOT EXISTS tr_users_updated_at
  AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger pour mettre à jour updated_at sur user_budget_settings
CREATE TRIGGER IF NOT EXISTS tr_budget_settings_updated_at
  AFTER UPDATE ON user_budget_settings
BEGIN
  UPDATE user_budget_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger pour mettre à jour updated_at sur categories
CREATE TRIGGER IF NOT EXISTS tr_categories_updated_at
  AFTER UPDATE ON categories
BEGIN
  UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger pour mettre à jour updated_at sur transactions
CREATE TRIGGER IF NOT EXISTS tr_transactions_updated_at
  AFTER UPDATE ON transactions
BEGIN
  UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- TRIGGERS DE VALIDATION MÉTIER
-- =====================================================

-- Trigger pour valider que les catégories appartiennent au bon utilisateur
CREATE TRIGGER IF NOT EXISTS tr_validate_transaction_category
  BEFORE INSERT ON transactions
BEGIN
  SELECT CASE
    WHEN (
      SELECT user_id FROM categories WHERE id = NEW.category_id
    ) != NEW.user_id
    THEN RAISE(ABORT, 'La catégorie ne peut pas appartenir à un autre utilisateur')
  END;
END;

-- Trigger pour valider les montants positifs
CREATE TRIGGER IF NOT EXISTS tr_validate_positive_amounts
  BEFORE INSERT ON transactions
BEGIN
  SELECT CASE
    WHEN NEW.amount <= 0
    THEN RAISE(ABORT, 'Le montant doit être positif')
  END;
END;

-- =====================================================
-- FONCTIONS UTILITAIRES (REQUÊTES FRÉQUENTES)
-- =====================================================

-- Requête pour obtenir le budget mensuel d'un utilisateur
-- SELECT * FROM user_budget_settings WHERE user_id = ? AND month = ? AND year = ?;

-- Requête pour calculer les dépenses mensuelles par type
-- SELECT 
--   c.type,
--   SUM(t.amount) as total
-- FROM transactions t
-- JOIN categories c ON t.category_id = c.id
-- WHERE t.user_id = ? 
--   AND strftime('%m', t.transaction_date) = ?
--   AND strftime('%Y', t.transaction_date) = ?
-- GROUP BY c.type;

-- Requête pour vérifier le budget restant
-- SELECT 
--   ubs.monthly_salary,
--   ubs.savings_goal,
--   COALESCE(expenses.total, 0) as total_expenses,
--   COALESCE(savings.total, 0) as current_savings,
--   (ubs.monthly_salary - COALESCE(expenses.total, 0) - COALESCE(savings.total, 0)) as remaining_budget
-- FROM user_budget_settings ubs
-- LEFT JOIN (
--   SELECT 
--     t.user_id,
--     SUM(t.amount) as total
--   FROM transactions t
--   JOIN categories c ON t.category_id = c.id
--   WHERE c.type IN ('fixed_expense', 'variable_expense')
--     AND strftime('%m', t.transaction_date) = ?
--     AND strftime('%Y', t.transaction_date) = ?
--   GROUP BY t.user_id
-- ) expenses ON ubs.user_id = expenses.user_id
-- LEFT JOIN (
--   SELECT 
--     t.user_id,
--     SUM(t.amount) as total
--   FROM transactions t
--   JOIN categories c ON t.category_id = c.id
--   WHERE c.type = 'savings'
--     AND strftime('%m', t.transaction_date) = ?
--     AND strftime('%Y', t.transaction_date) = ?
--   GROUP BY t.user_id
-- ) savings ON ubs.user_id = savings.user_id
-- WHERE ubs.user_id = ? AND ubs.month = ? AND ubs.year = ?;

-- =====================================================
-- DONNÉES INITIALES DE TEST (OPTIONNEL)
-- =====================================================

-- Insérer un utilisateur de test (mot de passe: "password123")
-- INSERT OR IGNORE INTO users (email, password_hash, firstName) 
-- VALUES ('test@example.com', '$2b$10$hash...', 'Test User');

-- =====================================================
-- STATISTIQUES ET MAINTENANCE
-- =====================================================

-- Requête pour analyser l'utilisation des index
-- SELECT * FROM sqlite_stat1;

-- Requête pour obtenir la taille de la base
-- SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size;

-- =====================================================
-- PROCÉDURES DE MAINTENANCE
-- =====================================================

-- Nettoyer les données anciennes (> 5 ans)
-- DELETE FROM transactions 
-- WHERE transaction_date < date('now', '-5 years');

-- Nettoyer les paramètres budgétaires anciens
-- DELETE FROM user_budget_settings 
-- WHERE year < strftime('%Y', 'now') - 5;

-- Optimiser la base de données
-- VACUUM;
-- ANALYZE;

-- =====================================================
-- EXEMPLES D'INSERTION POUR TESTS
-- =====================================================

-- Catégories par défaut pour un nouvel utilisateur
/*
INSERT INTO categories (user_id, name, type, budget_amount, color) VALUES
-- Revenus
(1, 'Salaire', 'income', 2750.00, '#10b981'),
(1, 'Primes', 'income', 0.00, '#059669'),

-- Dépenses fixes
(1, 'Logement', 'fixed_expense', 800.00, '#ef4444'),
(1, 'Crédit Auto', 'fixed_expense', 120.00, '#dc2626'),
(1, 'Assurance Auto', 'fixed_expense', 100.00, '#b91c1c'),
(1, 'Téléphone/Internet', 'fixed_expense', 50.00, '#991b1b'),

-- Dépenses variables
(1, 'Alimentation', 'variable_expense', 250.00, '#f59e0b'),
(1, 'Transport', 'variable_expense', 120.00, '#d97706'),
(1, 'Loisirs', 'variable_expense', 350.00, '#b45309'),
(1, 'Santé', 'variable_expense', 100.00, '#92400e'),
(1, 'Vêtements', 'variable_expense', 80.00, '#78350f'),

-- Épargne
(1, 'Épargne Mensuelle', 'savings', 800.00, '#3b82f6');
*/

-- Paramètres budgétaires par défaut
/*
INSERT INTO user_budget_settings (user_id, month, year, monthly_salary, savings_goal) VALUES
(1, 9, 2025, 2750.00, 800.00);
*/

-- Transactions d'exemple
/*
INSERT INTO transactions (user_id, category_id, amount, description, transaction_date) VALUES
-- Revenus
(1, 1, 2750.00, 'Salaire septembre 2025', '2025-09-01'),

-- Dépenses fixes
(1, 3, 800.00, 'Loyer septembre', '2025-09-01'),
(1, 4, 120.00, 'Crédit auto', '2025-09-05'),
(1, 5, 100.00, 'Assurance auto', '2025-09-10'),
(1, 6, 45.00, 'Forfait mobile + internet', '2025-09-15'),

-- Dépenses variables
(1, 7, 65.50, 'Courses alimentaires', '2025-09-02'),
(1, 8, 35.00, 'Essence', '2025-09-03'),
(1, 9, 85.00, 'Restaurant avec amis', '2025-09-07'),

-- Épargne
(1, 12, 800.00, 'Virement épargne mensuelle', '2025-09-30');
*/

-- =====================================================
-- REQUÊTES D'ANALYSE BUDGÉTAIRE
-- =====================================================

-- 1. Résumé complet pour un mois donné
/*
SELECT 
  'RÉSUMÉ BUDGÉTAIRE' as section,
  ubs.monthly_salary as "Salaire Mensuel",
  ubs.savings_goal as "Objectif Épargne",
  COALESCE(income.total, 0) as "Revenus Réels",
  COALESCE(fixed_exp.total, 0) as "Dépenses Fixes",
  COALESCE(var_exp.total, 0) as "Dépenses Variables", 
  COALESCE(savings.total, 0) as "Épargne Réelle",
  (COALESCE(income.total, ubs.monthly_salary) - COALESCE(fixed_exp.total, 0) - COALESCE(var_exp.total, 0) - COALESCE(savings.total, 0)) as "Budget Restant",
  ROUND(((COALESCE(fixed_exp.total, 0) + COALESCE(var_exp.total, 0) + COALESCE(savings.total, 0)) / ubs.monthly_salary * 100), 2) as "% Salaire Utilisé"
FROM user_budget_settings ubs
LEFT JOIN (
  SELECT user_id, SUM(amount) as total FROM v_transactions_with_category 
  WHERE category_type = 'income' AND year_month = '2025-09' AND user_id = 1
) income ON ubs.user_id = income.user_id
LEFT JOIN (
  SELECT user_id, SUM(amount) as total FROM v_transactions_with_category 
  WHERE category_type = 'fixed_expense' AND year_month = '2025-09' AND user_id = 1
) fixed_exp ON ubs.user_id = fixed_exp.user_id
LEFT JOIN (
  SELECT user_id, SUM(amount) as total FROM v_transactions_with_category 
  WHERE category_type = 'variable_expense' AND year_month = '2025-09' AND user_id = 1
) var_exp ON ubs.user_id = var_exp.user_id
LEFT JOIN (
  SELECT user_id, SUM(amount) as total FROM v_transactions_with_category 
  WHERE category_type = 'savings' AND year_month = '2025-09' AND user_id = 1
) savings ON ubs.user_id = savings.user_id
WHERE ubs.user_id = 1 AND ubs.month = 9 AND ubs.year = 2025;
*/

-- 2. Détail par catégorie avec pourcentages
/*
SELECT 
  c.name as "Catégorie",
  c.type as "Type",
  c.budget_amount as "Budget",
  COALESCE(spent.total, 0) as "Dépensé",
  (c.budget_amount - COALESCE(spent.total, 0)) as "Restant",
  CASE 
    WHEN c.budget_amount > 0 THEN ROUND((COALESCE(spent.total, 0) / c.budget_amount * 100), 1)
    ELSE 0 
  END as "% Budget",
  ROUND((COALESCE(spent.total, 0) / ubs.monthly_salary * 100), 2) as "% Salaire"
FROM categories c
LEFT JOIN (
  SELECT category_id, SUM(amount) as total 
  FROM transactions 
  WHERE strftime('%Y-%m', transaction_date) = '2025-09' 
  GROUP BY category_id
) spent ON c.id = spent.category_id
JOIN user_budget_settings ubs ON c.user_id = ubs.user_id 
WHERE c.user_id = 1 AND ubs.month = 9 AND ubs.year = 2025
ORDER BY c.type, c.name;
*/

-- 3. Évolution mensuelle sur l'année
/*
SELECT 
  month,
  SUM(CASE WHEN category_type = 'income' THEN total_amount ELSE 0 END) as revenus,
  SUM(CASE WHEN category_type = 'fixed_expense' THEN total_amount ELSE 0 END) as fixes,
  SUM(CASE WHEN category_type = 'variable_expense' THEN total_amount ELSE 0 END) as variables,
  SUM(CASE WHEN category_type = 'savings' THEN total_amount ELSE 0 END) as epargne,
  (SUM(CASE WHEN category_type = 'income' THEN total_amount ELSE 0 END) - 
   SUM(CASE WHEN category_type IN ('fixed_expense', 'variable_expense', 'savings') THEN total_amount ELSE 0 END)) as solde
FROM v_monthly_summary 
WHERE user_id = 1 AND year = '2025'
GROUP BY month
ORDER BY month;
*/

-- 4. Alertes budgétaires
/*
SELECT 
  'ALERTE' as type,
  c.name as categorie,
  c.budget_amount as budget,
  spent.total as depense,
  (spent.total - c.budget_amount) as depassement,
  ROUND((spent.total / c.budget_amount * 100), 1) as pourcentage
FROM categories c
JOIN (
  SELECT category_id, SUM(amount) as total 
  FROM transactions 
  WHERE strftime('%Y-%m', transaction_date) = '2025-09' 
  GROUP BY category_id
) spent ON c.id = spent.category_id
WHERE c.user_id = 1 
  AND c.budget_amount > 0 
  AND spent.total > c.budget_amount
ORDER BY (spent.total - c.budget_amount) DESC;
*/

-- =====================================================
-- FONCTIONS DE VALIDATION
-- =====================================================

-- Vérifier la cohérence des données
/*
SELECT 
  'Vérification cohérence' as test,
  COUNT(*) as transactions_sans_categorie
FROM transactions t 
LEFT JOIN categories c ON t.category_id = c.id 
WHERE c.id IS NULL;

SELECT 
  'Vérification cohérence' as test,
  COUNT(*) as transactions_utilisateur_different
FROM transactions t 
JOIN categories c ON t.category_id = c.id 
WHERE t.user_id != c.user_id;
*/