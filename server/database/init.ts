import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';

class DatabaseManager {
  private db: Database;

  constructor() {
    const dbPath = path.join(process.cwd(), 'budget_tracker.db');
    console.log('📁 Chemin de la base de données:', dbPath);
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erreur de connexion à la base de données:', err);
      } else {
        console.log('✅ Connecté à la base de données SQLite');
        this.initTables();
      }
    });
    
    // Activer les contraintes de clés étrangères
    this.db.run("PRAGMA foreign_keys = ON", (err) => {
      if (err) {
        console.error('❌ Erreur activation foreign keys:', err);
      } else {
        console.log('✅ Contraintes de clés étrangères activées');
      }
    });
  }

  private initTables(): void {
    console.log('🔧 Initialisation des tables (logique budget basée sur salaire)...');
    
    const tables = [
      {
        name: 'users',
        sql: `CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          firstName TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'user_budget_settings',
        sql: `CREATE TABLE IF NOT EXISTS user_budget_settings (
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
        )`
      },
      {
        name: 'categories',
        sql: `CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT CHECK (type IN ('income', 'fixed_expense', 'variable_expense', 'savings')),
          user_id INTEGER NOT NULL,
          budget_amount DECIMAL(10,2) DEFAULT 0,
          color TEXT DEFAULT '#6366f1',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      },
      {
        name: 'transactions',
        sql: `CREATE TABLE IF NOT EXISTS transactions (
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
        )`
      }
    ];

    this.createTablesSequentially(tables, 0);
  }

  private createTablesSequentially(tables: {name: string, sql: string}[], index: number): void {
    if (index >= tables.length) {
      console.log('✅ Toutes les tables ont été créées');
      this.createIndexes();
      this.createTriggers();
      this.createViews();
      return;
    }

    const table = tables[index];
    console.log(`🔧 Création de la table ${table.name}...`);
    
    this.db.run(table.sql, (err) => {
      if (err) {
        console.error(`❌ Erreur lors de la création de la table ${table.name}:`, err);
      } else {
        console.log(`✅ Table ${table.name} créée/vérifiée`);
      }
      
      this.createTablesSequentially(tables, index + 1);
    });
  }

  private createIndexes(): void {
    console.log('🔧 Création des index pour optimisation...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_budget_settings_user_date ON user_budget_settings(user_id, year, month)',
      'CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(user_id, type)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, transaction_date)',
      'CREATE INDEX IF NOT EXISTS idx_transactions_month ON transactions(user_id, strftime("%Y-%m", transaction_date))',
      'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)'
    ];

    indexes.forEach((indexSql, i) => {
      this.db.run(indexSql, (err) => {
        if (err) {
          console.error(`❌ Erreur création index ${i + 1}:`, err);
        } else {
          console.log(`✅ Index ${i + 1}/${indexes.length} créé`);
        }
      });
    });
  }

  private createTriggers(): void {
    console.log('🔧 Création des triggers...');
    
    const triggers = [
      // Trigger pour mettre à jour updated_at sur users
      `CREATE TRIGGER IF NOT EXISTS tr_users_updated_at
       AFTER UPDATE ON users
       BEGIN
         UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
      
      // Trigger pour mettre à jour updated_at sur user_budget_settings
      `CREATE TRIGGER IF NOT EXISTS tr_budget_settings_updated_at
       AFTER UPDATE ON user_budget_settings
       BEGIN
         UPDATE user_budget_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
      
      // Trigger pour mettre à jour updated_at sur categories
      `CREATE TRIGGER IF NOT EXISTS tr_categories_updated_at
       AFTER UPDATE ON categories
       BEGIN
         UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
      
      // Trigger pour mettre à jour updated_at sur transactions
      `CREATE TRIGGER IF NOT EXISTS tr_transactions_updated_at
       AFTER UPDATE ON transactions
       BEGIN
         UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
      
      // Trigger pour valider que les catégories appartiennent au bon utilisateur
      `CREATE TRIGGER IF NOT EXISTS tr_validate_transaction_category
       BEFORE INSERT ON transactions
       BEGIN
         SELECT CASE
           WHEN (SELECT user_id FROM categories WHERE id = NEW.category_id) != NEW.user_id
           THEN RAISE(ABORT, 'La catégorie ne peut pas appartenir à un autre utilisateur')
         END;
       END`,
      
      // Trigger pour valider les montants positifs
      `CREATE TRIGGER IF NOT EXISTS tr_validate_positive_amounts
       BEFORE INSERT ON transactions
       BEGIN
         SELECT CASE
           WHEN NEW.amount <= 0
           THEN RAISE(ABORT, 'Le montant doit être positif')
         END;
       END`
    ];

    triggers.forEach((triggerSql, i) => {
      this.db.run(triggerSql, (err) => {
        if (err) {
          console.error(`❌ Erreur création trigger ${i + 1}:`, err);
        } else {
          console.log(`✅ Trigger ${i + 1}/${triggers.length} créé`);
        }
      });
    });
  }

  private createViews(): void {
    console.log('🔧 Création des vues...');
    
    const views = [
      // Vue pour les transactions avec informations de catégorie
      `CREATE VIEW IF NOT EXISTS v_transactions_with_category AS
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
       JOIN categories c ON t.category_id = c.id`,
      
      // Vue pour les résumés mensuels par utilisateur
      `CREATE VIEW IF NOT EXISTS v_monthly_summary AS
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
       GROUP BY t.user_id, strftime('%Y-%m', t.transaction_date), c.type`
    ];

    views.forEach((viewSql, i) => {
      this.db.run(viewSql, (err) => {
        if (err) {
          console.error(`❌ Erreur création vue ${i + 1}:`, err);
        } else {
          console.log(`✅ Vue ${i + 1}/${views.length} créée`);
        }
      });
    });
  }

  // Méthode pour migrer les anciennes tables vers la nouvelle structure
  public async migrateOldTables(): Promise<void> {
    console.log('🔄 Vérification des migrations nécessaires...');
    
    // Vérifier si les anciennes tables existent
    this.db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('monthly_goals', 'monthly_income')",
      (err, row) => {
        if (err) {
          console.error('❌ Erreur vérification migration:', err);
          return;
        }
        
        if (row) {
          console.log('🔄 Anciennes tables détectées, migration en cours...');
          this.performMigration();
        } else {
          console.log('✅ Aucune migration nécessaire');
        }
      }
    );
  }

  private performMigration(): void {
    console.log('🔄 Migration des données vers user_budget_settings...');
    
    // Migrer monthly_goals vers user_budget_settings
    this.db.run(`
      INSERT OR IGNORE INTO user_budget_settings (user_id, month, year, monthly_salary, savings_goal)
      SELECT 
        user_id,
        month,
        year,
        COALESCE(total_budget, 2750.00) as monthly_salary,
        COALESCE(savings_goal, 800.00) as savings_goal
      FROM monthly_goals
    `, (err) => {
      if (err) {
        console.error('❌ Erreur migration monthly_goals:', err);
      } else {
        console.log('✅ Migration monthly_goals terminée');
        
        // Optionnel: supprimer les anciennes tables après confirmation
        console.log('💡 Les anciennes tables monthly_goals et monthly_income peuvent être supprimées manuellement');
      }
    });
  }

  getDatabase(): Database {
    return this.db;
  }

  close(): void {
    console.log('🔒 Fermeture de la connexion à la base de données...');
    this.db.close((err) => {
      if (err) {
        console.error('❌ Erreur fermeture DB:', err);
      } else {
        console.log('✅ Base de données fermée');
      }
    });
  }

  testConnection(): void {
    console.log('🔍 Test de connexion à la base de données...');
    
    this.db.get("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
      if (err) {
        console.error('❌ Test de connexion échoué:', err);
      } else {
        console.log('✅ Test de connexion réussi');
        this.listTables();
      }
    });
  }

  private listTables(): void {
    this.db.all(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      (err, rows) => {
        if (err) {
          console.error('❌ Erreur listage tables:', err);
        } else {
          console.log('📋 Tables disponibles:');
          rows.forEach((row: any) => {
            console.log(`   📄 ${row.name}`);
          });
        }
      }
    );
  }

  // Méthodes utilitaires pour le développement
  public runQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  public getQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  public allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // NOUVELLE MÉTHODE : Ajouter les catégories manquantes pour un utilisateur existant
  public async addMissingCategories(userId: number): Promise<void> {
    console.log(`🔧 Ajout des catégories manquantes pour l'utilisateur ${userId}...`);
    
    try {
      // Vérifier quelles catégories existent déjà
      const existingCategories = await this.allQuery(
        'SELECT name, type FROM categories WHERE user_id = ?',
        [userId]
      );
      
      const existingCategoryNames = existingCategories.map((cat: any) => cat.name.toLowerCase());
      console.log(`📋 Catégories existantes: ${existingCategoryNames.join(', ')}`);
      
      // Définir toutes les catégories par défaut
      const allDefaultCategories = [
        { name: 'Salaire', type: 'income', budget: 2750, color: '#10b981' },
        { name: 'Primes', type: 'income', budget: 0, color: '#059669' },
        { name: 'Logement', type: 'fixed_expense', budget: 800, color: '#ef4444' },
        { name: 'Crédit Auto', type: 'fixed_expense', budget: 120, color: '#dc2626' },
        { name: 'Assurance Auto', type: 'fixed_expense', budget: 100, color: '#b91c1c' },
        { name: 'Téléphone/Internet', type: 'fixed_expense', budget: 50, color: '#991b1b' },
        { name: 'Alimentation', type: 'variable_expense', budget: 250, color: '#f59e0b' },
        { name: 'Transport', type: 'variable_expense', budget: 120, color: '#d97706' },
        { name: 'Loisirs', type: 'variable_expense', budget: 350, color: '#b45309' },
        { name: 'Santé', type: 'variable_expense', budget: 100, color: '#92400e' },
        { name: 'Vêtements', type: 'variable_expense', budget: 80, color: '#78350f' },
        { name: 'Épargne Mensuelle', type: 'savings', budget: 800, color: '#3b82f6' }
      ];
      
      // Filtrer les catégories qui n'existent pas encore
      const categoriesToAdd = allDefaultCategories.filter(
        category => !existingCategoryNames.includes(category.name.toLowerCase())
      );
      
      console.log(`➕ ${categoriesToAdd.length} nouvelle(s) catégorie(s) à ajouter`);
      
      // Ajouter chaque catégorie manquante
      for (const category of categoriesToAdd) {
        await this.runQuery(
          'INSERT INTO categories (user_id, name, type, budget_amount, color) VALUES (?, ?, ?, ?, ?)',
          [userId, category.name, category.type, category.budget, category.color]
        );
        console.log(`✅ Catégorie ajoutée: ${category.name} (${category.type})`);
      }
      
      if (categoriesToAdd.length > 0) {
        console.log(`🎉 ${categoriesToAdd.length} catégorie(s) ajoutée(s) avec succès!`);
      } else {
        console.log('✅ Toutes les catégories par défaut existent déjà');
      }
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout des catégories manquantes:', error);
      throw error;
    }
  }

  // NOUVELLE MÉTHODE : Ajouter les catégories manquantes pour tous les utilisateurs
  public async addMissingCategoriesForAllUsers(): Promise<void> {
    console.log('🔧 Ajout des catégories manquantes pour tous les utilisateurs...');
    
    try {
      const users = await this.allQuery('SELECT id, email FROM users');
      console.log(`👥 ${users.length} utilisateur(s) trouvé(s)`);
      
      for (const user of users) {
        console.log(`\n🔄 Traitement de l'utilisateur ${user.id} (${user.email})`);
        await this.addMissingCategories(user.id);
      }
      
      console.log('\n🎉 Catégories manquantes ajoutées pour tous les utilisateurs!');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout des catégories pour tous les utilisateurs:', error);
    }
  }

  // Méthode pour créer un utilisateur de test avec ses catégories par défaut
  public async createTestUser(): Promise<void> {
    console.log('🧪 Création d\'un utilisateur de test...');
    
    try {
      // Créer l'utilisateur (mot de passe: "password123")
      const hashedPassword = '$2b$10$rOlrqI5Vm7CZJGhUV8zWMOJCjrMEPZ9Xz1kY2mWqRvN5sQ8sB1XyG'; // hash de "password123"
      
      const userResult = await this.runQuery(
        'INSERT INTO users (email, password_hash, firstName) VALUES (?, ?, ?)',
        ['test@example.com', hashedPassword, 'Test User']
      );
      
      const userId = userResult.lastID;
      console.log(`✅ Utilisateur test créé avec ID: ${userId}`);
      
      // Créer les paramètres budgétaires pour le mois actuel
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      await this.runQuery(
        'INSERT INTO user_budget_settings (user_id, month, year, monthly_salary, savings_goal) VALUES (?, ?, ?, ?, ?)',
        [userId, currentMonth, currentYear, 2750.00, 800.00]
      );
      
      console.log(`✅ Paramètres budgétaires créés pour ${currentMonth}/${currentYear}`);
      
      // Utiliser la nouvelle méthode pour ajouter toutes les catégories
      await this.addMissingCategories(userId);
      
      console.log('🎉 Utilisateur de test complet créé!');
      console.log('📧 Email: test@example.com');
      console.log('🔑 Password: password123');
      
    } catch (error) {
      console.error('❌ Erreur création utilisateur test:', error);
    }
  }

  // Méthode pour afficher des statistiques de la base
  public async showStats(): Promise<void> {
    try {
      const userCount = await this.getQuery('SELECT COUNT(*) as count FROM users');
      const transactionCount = await this.getQuery('SELECT COUNT(*) as count FROM transactions');
      const categoryCount = await this.getQuery('SELECT COUNT(*) as count FROM categories');
      const budgetSettingsCount = await this.getQuery('SELECT COUNT(*) as count FROM user_budget_settings');
      
      console.log('\n📊 STATISTIQUES DE LA BASE DE DONNÉES:');
      console.log(`👥 Utilisateurs: ${userCount.count}`);
      console.log(`💳 Transactions: ${transactionCount.count}`);
      console.log(`📁 Catégories: ${categoryCount.count}`);
      console.log(`⚙️  Paramètres budgétaires: ${budgetSettingsCount.count}`);
      
      // Statistiques par type de catégorie
      const categoryStats = await this.allQuery(`
        SELECT type, COUNT(*) as count, AVG(budget_amount) as avg_budget
        FROM categories 
        GROUP BY type
      `);
      
      console.log('\n📁 RÉPARTITION DES CATÉGORIES:');
      categoryStats.forEach((stat: any) => {
        console.log(`   ${stat.type}: ${stat.count} catégories (budget moyen: ${stat.avg_budget?.toFixed(2)}€)`);
      });
      
    } catch (error) {
      console.error('❌ Erreur récupération statistiques:', error);
    }
  }

  // NOUVELLE MÉTHODE : Forcer la vérification et ajout des catégories
  public async forceCheckAndAddCategories(): Promise<void> {
    console.log('🚀 FORÇAGE DE LA VÉRIFICATION DES CATÉGORIES...');
    
    try {
      const userCount = await this.getQuery('SELECT COUNT(*) as count FROM users');
      console.log(`👥 Nombre d'utilisateurs trouvés: ${userCount.count}`);
      
      if (userCount.count === 0) {
        console.log('🧪 Aucun utilisateur détecté, création d\'un utilisateur de test...');
        await this.createTestUser();
      } else {
        console.log('🔍 Vérification des catégories manquantes pour les utilisateurs existants...');
        await this.addMissingCategoriesForAllUsers();
      }
      
      await this.showStats();
    } catch (error) {
      console.error('❌ Erreur lors de la vérification forcée:', error);
    }
  }
}

export const dbManager = new DatabaseManager();
export const db = dbManager.getDatabase();

// Tests de connexion et migration après initialisation
setTimeout(async () => {
  console.log('🔍 DÉBUT DU TIMEOUT DE VÉRIFICATION');
  console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
  
  dbManager.testConnection();
  await dbManager.migrateOldTables();
  
  // FORCER LA VÉRIFICATION INDÉPENDAMMENT DE NODE_ENV
  console.log('🚀 FORÇAGE DE LA VÉRIFICATION DES CATÉGORIES (ignorant NODE_ENV)...');
  
  try {
    await dbManager.forceCheckAndAddCategories();
  } catch (error) {
    console.error('❌ Erreur lors de la vérification forcée des utilisateurs:', error);
  }
  
  // Version originale commentée pour comparaison
  /*
  if (process.env.NODE_ENV === 'development') {
    try {
      const userCount = await dbManager.getQuery('SELECT COUNT(*) as count FROM users');
      if (userCount.count === 0) {
        console.log('🧪 Aucun utilisateur détecté, création d\'un utilisateur de test...');
        await dbManager.createTestUser();
      } else {
        console.log('🔍 Vérification des catégories manquantes pour les utilisateurs existants...');
        await dbManager.addMissingCategoriesForAllUsers();
      }
      
      await dbManager.showStats();
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des utilisateurs:', error);
    }
  }
  */
}, 1000);

// Gestion propre de la fermeture
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur détecté...');
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur détecté...');
  dbManager.close();
  process.exit(0);
});