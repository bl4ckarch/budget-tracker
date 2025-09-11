import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import { generalLimiter, securityHeaders } from './middleware/security.js';

const app = express();
const PORT = process.env.PORT || 3001;
const ENV = process.env.NODE_ENV || 'development';
const API_VERSION = 'v1';

console.log('🔧 Initialisation Budget Tracker Server (Salary-Based)...');
console.log(`📝 Environnement: ${ENV}`);
console.log(`🔌 Port: ${PORT}`);
console.log(`📊 API Version: ${API_VERSION}`);
console.log(`💰 Logique: Budget basé sur salaire mensuel`);

// ==================== MIDDLEWARE DE SÉCURITÉ ====================
console.log('🛡️ Configuration sécurité...');

// Helmet pour les headers de sécurité
app.use(helmet({
  contentSecurityPolicy: ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// Compression gzip
app.use(compression());

// Headers de sécurité personnalisés
app.use(securityHeaders);

// Rate limiting
app.use(generalLimiter);

// ==================== CONFIGURATION CORS ====================
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'https://budget.blackarch.fr',
      'http://budget.blackarch.fr'
    ];
    
    if (!origin && ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin!)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS: Origin ${origin} non autorisé`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400
};

console.log(`🌐 Configuration CORS pour environnement: ${ENV}`);
app.use(cors(corsOptions));

// ==================== PARSING DES REQUÊTES ====================
console.log('⚙️ Configuration du parsing...');
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  verify: (req, res, buf): void => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      // Ne pas envoyer de réponse ici, laisser Express gérer l'erreur
      throw new Error('JSON invalide');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// ==================== MIDDLEWARE DE LOGGING ====================
app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const timestamp = new Date().toISOString();
  const start = Date.now();
  
  console.log(`📡 [${timestamp}] ${req.method} ${req.url} - IP: ${req.ip}`);
  
  if (req.headers.authorization) {
    console.log(`🔑 Authorization header présent`);
  }
  
  if ((req.method === 'POST' || req.method === 'PUT') && req.url !== '/api/auth/login' && req.body) {
    console.log(`📦 Body size: ${JSON.stringify(req.body).length} caractères`);
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 400 ? '🔴' : status >= 300 ? '🟡' : '🟢';
    console.log(`${statusColor} ${req.method} ${req.url} - ${status} (${duration}ms)`);
  });
  
  next();
});

// ==================== ROUTES API ====================
console.log('🛣️ Configuration des routes API...');

// Route de santé avec informations budgétaires
app.get('/api/health', (req, res): void => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: ENV,
    version: API_VERSION,
    port: PORT,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    node_version: process.version,
    platform: process.platform,
    features: {
      salary_based_budget: true,
      automatic_calculations: true,
      monthly_settings: true,
      savings_tracking: true
    }
  };
  
  console.log('❤️ Health check OK');
  res.json(healthData);
});

// Route info API avec détails budgétaires
app.get('/api/info', (req, res): void => {
  res.json({
    name: 'Budget Tracker API - Salary Based',
    version: API_VERSION,
    description: 'API de gestion budgétaire basée sur le salaire mensuel',
    budget_logic: {
      base: 'Salaire mensuel défini par l\'utilisateur',
      default_salary: 2750,
      default_savings_goal: 800,
      calculation: 'Budget restant = Salaire - Dépenses - Épargne',
      categories: {
        income: 'Revenus (salaire, primes, etc.)',
        fixed_expense: 'Dépenses fixes (loyer, crédits, assurances)',
        variable_expense: 'Dépenses variables (alimentation, loisirs)',
        savings: 'Épargne (objectif mensuel)'
      }
    },
    features: [
      'Paramétrage du salaire mensuel',
      'Objectifs d\'épargne personnalisés',
      'Calcul automatique du budget restant',
      'Alertes de dépassement budgétaire',
      'Suivi des pourcentages par rapport au salaire',
      'Validation des transactions vs budget disponible'
    ],
    endpoints: {
      auth: '/api/auth/*',
      transactions: '/api/transactions/*',
      categories: '/api/categories/*',
      budget_settings: '/api/transactions/budget-settings/:month/:year'
    }
  });
});

// Routes principales avec middleware de logging spécialisé
app.use('/api/auth', (req, res, next): void => {
  console.log(`🔐 Auth: ${req.method} ${req.originalUrl}`);
  next();
}, authRoutes);

app.use('/api/transactions', (req, res, next): void => {
  console.log(`💰 Transactions: ${req.method} ${req.originalUrl}`);
  if (req.originalUrl.includes('budget-settings')) {
    console.log(`⚙️ Budget Settings Operation`);
  }
  next();
}, transactionRoutes);

app.use('/api/categories', (req, res, next): void => {
  console.log(`📁 Categories: ${req.method} ${req.originalUrl}`);
  next();
}, categoryRoutes);

// Route pour initialiser les catégories par défaut d'un utilisateur
app.post('/api/init-default-categories', async (req, res): Promise<void> => {
  const { userId } = req.body;
  
  if (!userId) {
    res.status(400).json({ error: 'User ID requis' });
    return;
  }

  const defaultCategories = [
    { name: 'Salaire', type: 'income', budget_amount: 2750, color: '#10b981' },
    { name: 'Primes', type: 'income', budget_amount: 0, color: '#059669' },
    { name: 'Logement', type: 'fixed_expense', budget_amount: 800, color: '#ef4444' },
    { name: 'Crédit Auto', type: 'fixed_expense', budget_amount: 120, color: '#dc2626' },
    { name: 'Assurance Auto', type: 'fixed_expense', budget_amount: 100, color: '#b91c1c' },
    { name: 'Téléphone/Internet', type: 'fixed_expense', budget_amount: 50, color: '#991b1b' },
    { name: 'Alimentation', type: 'variable_expense', budget_amount: 250, color: '#f59e0b' },
    { name: 'Transport', type: 'variable_expense', budget_amount: 120, color: '#d97706' },
    { name: 'Loisirs', type: 'variable_expense', budget_amount: 350, color: '#b45309' },
    { name: 'Santé', type: 'variable_expense', budget_amount: 100, color: '#92400e' },
    { name: 'Vêtements', type: 'variable_expense', budget_amount: 80, color: '#78350f' },
    { name: 'Épargne Mensuelle', type: 'savings', budget_amount: 800, color: '#3b82f6' }
  ];

  try {
    const db = require('./database/init').db;
    console.log(`🎯 Initialisation des catégories par défaut pour user ${userId}`);
    
    const insertPromises = defaultCategories.map(category => {
      return new Promise<number>((resolve, reject) => {
        db.run(
          'INSERT INTO categories (user_id, name, type, budget_amount, color) VALUES (?, ?, ?, ?, ?)',
          [userId, category.name, category.type, category.budget_amount, category.color],
          function(this: { lastID: number }, err: any): void {
            if (err) {
              console.error(`❌ Erreur création catégorie ${category.name}:`, err);
              reject(err);
            } else {
              console.log(`✅ Catégorie créée: ${category.name}`);
              resolve(this.lastID);
            }
          }
        );
      });
    });

    await Promise.all(insertPromises);
    
    console.log(`🎉 Toutes les catégories par défaut créées pour user ${userId}`);
    res.status(201).json({ 
      message: 'Catégories par défaut créées avec succès',
      categoriesCount: defaultCategories.length 
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des catégories par défaut:', error);
    res.status(500).json({ error: 'Erreur lors de la création des catégories par défaut' });
  }
});

// ==================== FICHIERS STATIQUES (PRODUCTION) ====================
if (ENV === 'production') {
  console.log('📁 Mode production: configuration des fichiers statiques...');
  
  const staticPath = path.join(__dirname, '../dist');
  console.log(`📂 Chemin statique: ${staticPath}`);
  
  app.use('/assets', express.static(path.join(staticPath, 'assets'), {
    maxAge: '1y',
    etag: true,
    lastModified: true
  }));
  
  app.use(express.static(staticPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));
  
  // Route catch-all pour SPA en production - utilisation d'un middleware
  app.use((req, res, next): void => {
    if (req.originalUrl.startsWith('/api/')) {
      next(); // Passer au gestionnaire 404
      return;
    }
    
    const indexPath = path.join(staticPath, 'index.html');
    console.log(`📄 SPA fallback: ${req.originalUrl} -> index.html`);
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('❌ Erreur serving index.html:', err);
        res.status(500).json({ error: 'Erreur serveur' });
      }
    });
  });
} else {
  console.log('🔧 Mode développement: SPA géré par Vite');
  // Pas de route catch-all en développement pour éviter les erreurs
}

// ==================== GESTIONNAIRE 404 POUR ROUTES NON TROUVÉES ====================
app.use((req, res): void => {
  if (req.originalUrl.startsWith('/api/')) {
    console.log(`❌ Route API non trouvée: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      error: 'Route API non trouvée',
      path: req.originalUrl,
      method: req.method,
      availableRoutes: [
        'GET /api/health - Statut du serveur',
        'GET /api/info - Informations sur l\'API',
        'POST /api/auth/register - Inscription utilisateur',
        'POST /api/auth/login - Connexion utilisateur',
        'GET /api/categories - Liste des catégories',
        'POST /api/categories - Créer une catégorie',
        'GET /api/transactions/:month/:year - Transactions du mois',
        'POST /api/transactions - Ajouter une transaction',
        'PUT /api/transactions/:id - Modifier une transaction',
        'DELETE /api/transactions/:id - Supprimer une transaction',
        'GET /api/transactions/summary/:month/:year - Résumé mensuel',
        'POST /api/transactions/budget-settings/:month/:year - Définir salaire/épargne',
        'GET /api/transactions/budget-settings/:month/:year - Récupérer paramètres',
        'POST /api/init-default-categories - Initialiser catégories par défaut'
      ]
    });
    return;
  }
  
  res.status(404).json({ 
    error: 'Page non trouvée',
    message: 'En mode développement, utilisez le serveur Vite pour l\'interface utilisateur',
    suggestion: 'Lancez "npm run dev" pour démarrer le serveur de développement complet'
  });
});

// ==================== GESTIONNAIRE D'ERREURS ====================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  console.error('💥 Erreur serveur:');
  console.error(`📍 URL: ${req.method} ${req.originalUrl}`);
  console.error(`🔍 Stack trace:`, err.stack);
  console.error(`📝 Message:`, err.message);
  
  if (err.message.includes('budget') || err.message.includes('salary')) {
    console.error(`💰 Erreur liée au budget détectée`);
  }
  
  res.status(err.status || 500).json({ 
    error: 'Erreur serveur interne',
    timestamp: new Date().toISOString(),
    ...(ENV === 'development' && { details: err.message, stack: err.stack })
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
const server = app.listen(PORT, (): void => {
  console.log('\n🎉 =============================================');
  console.log(`🚀 Budget Tracker API (Salary-Based) démarré!`);
  console.log(`🌍 URL: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`📖 Info: http://localhost:${PORT}/api/info`);
  console.log(`⚙️ Environnement: ${ENV}`);
  console.log(`📅 Démarré: ${new Date().toLocaleString('fr-FR')}`);
  console.log('🎉 =============================================\n');
  
  console.log('💰 LOGIQUE BUDGÉTAIRE:');
  console.log('   • Salaire mensuel configurable (défaut: 2750€)');
  console.log('   • Objectif épargne configurable (défaut: 800€)');
  console.log('   • Calcul automatique: Budget = Salaire - Dépenses - Épargne');
  console.log('   • Alertes de dépassement budgétaire');
  console.log('   • Suivi pourcentages par rapport au salaire');
  console.log('');
  
  console.log('🔍 Routes API spécialisées:');
  console.log('   🔐 Authentication:');
  console.log('      POST /api/auth/register');
  console.log('      POST /api/auth/login');
  console.log('   💰 Transactions avec budget:');
  console.log('      GET  /api/transactions/:month/:year');
  console.log('      POST /api/transactions');
  console.log('      PUT  /api/transactions/:id');
  console.log('      DELETE /api/transactions/:id');
  console.log('      GET  /api/transactions/summary/:month/:year');
  console.log('   ⚙️  Budget Settings:');
  console.log('      POST /api/transactions/budget-settings/:month/:year');
  console.log('      GET  /api/transactions/budget-settings/:month/:year');
  console.log('   📁 Categories:');
  console.log('      GET  /api/categories');
  console.log('      POST /api/categories');
  console.log('      PUT  /api/categories/:id');
  console.log('      DELETE /api/categories/:id');
  console.log('   🎯 Utilitaires:');
  console.log('      POST /api/init-default-categories');
  console.log('      GET  /api/health');
  console.log('      GET  /api/info');
  console.log('');
});

// Gestion graceful shutdown
const gracefulShutdown = (): void => {
  console.log('\n🛑 Arrêt graceful du serveur Budget Tracker...');
  
  server.close(() => {
    console.log('✅ Serveur HTTP fermé');
    console.log('📊 Données budget sauvegardées');
    console.log('✅ Connexions DB fermées');
    console.log('👋 Arrêt complet du Budget Tracker (Salary-Based)');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('❌ Arrêt forcé du serveur (timeout)');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Monitoring des performances avec focus budget
setInterval((): void => {
  const memoryUsage = process.memoryUsage();
  const uptime = Math.floor(process.uptime());
  
  console.log('📊 Performance & Budget Monitor:');
  console.log(`   💾 Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`   ⏱️  Uptime: ${uptime}s`);
  console.log(`   💰 Mode: Salary-Based Budget Tracking`);
  console.log(`   🎯 Features: Auto-calculations, Alerts, Percentage tracking`);
}, 300000);

export default app;