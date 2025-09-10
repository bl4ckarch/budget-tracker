import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

// ==================== INTERFACES POUR LES LOGS ====================
interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: number;
  userEmail?: string;
  duration?: number;
  statusCode?: number;
  contentLength?: number;
  error?: string;
  budgetOperation?: string;
}

interface BudgetLogContext {
  operation: 'salary_update' | 'savings_update' | 'transaction_add' | 'budget_check' | 'expense_calculation';
  userId: number;
  month?: number;
  year?: number;
  amount?: number;
  category?: string;
  result?: 'success' | 'warning' | 'error';
  details?: string;
}

// ==================== CONFIGURATION DU LOGGER ====================
const LOG_CONFIG = {
  enableBody: process.env.NODE_ENV === 'development',
  enableHeaders: process.env.NODE_ENV === 'development',
  enableBudgetDetails: true,
  maxBodySize: 1000,
  sensitiveFields: ['password', 'token', 'authorization', 'password_hash'],
  excludePaths: ['/api/health', '/favicon.ico', '/assets'],
  budgetPaths: ['/api/transactions', '/budget-settings']
};

// ==================== FONCTIONS UTILITAIRES ====================
const sanitizeData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = { ...data };
  
  LOG_CONFIG.sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getStatusColor = (status: number): string => {
  if (status >= 500) return '🔴'; // Erreur serveur
  if (status >= 400) return '🟠'; // Erreur client
  if (status >= 300) return '🟡'; // Redirection
  if (status >= 200) return '🟢'; // Succès
  return '⚪'; // Autre
};

const getMethodColor = (method: string): string => {
  switch (method) {
    case 'GET': return '🔵';
    case 'POST': return '🟢';
    case 'PUT': return '🟡';
    case 'DELETE': return '🔴';
    case 'PATCH': return '🟣';
    default: return '⚪';
  }
};

const getBudgetOperationIcon = (operation: string): string => {
  switch (operation) {
    case 'salary_update': return '💰';
    case 'savings_update': return '🐷';
    case 'transaction_add': return '💳';
    case 'budget_check': return '📊';
    case 'expense_calculation': return '🧮';
    default: return '📋';
  }
};

// ==================== LOGGER PRINCIPAL ====================
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  // Skip logging pour certains paths
  if (LOG_CONFIG.excludePaths.some(path => req.originalUrl.includes(path))) {
    return next();
  }

  const baseLog: Partial<LogEntry> = {
    timestamp,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown'
  };

  // Détecter si c'est une opération budgétaire
  const isBudgetOperation = LOG_CONFIG.budgetPaths.some(path => req.originalUrl.includes(path));

  // Log de la requête entrante
  console.log(`\n📡 ${getMethodColor(req.method)} REQUÊTE ENTRANTE ${isBudgetOperation ? '💰 [BUDGET]' : ''}`);
  console.log(`⏰ ${timestamp}`);
  console.log(`🌐 ${req.method} ${req.originalUrl}`);
  console.log(`📍 IP: ${baseLog.ip}`);
  
  // Log de l'authentification
  if (req.headers.authorization) {
    console.log(`🔑 Token présent`);
  }

  // Log du user si authentifié
  const authReq = req as AuthRequest;
  if (authReq.user) {
    console.log(`👤 User: ${authReq.user.id} (${authReq.user.email})`);
    baseLog.userId = authReq.user.id;
    baseLog.userEmail = authReq.user.email;
    
    // Log spécial pour les opérations budgétaires
    if (isBudgetOperation) {
      logBudgetOperation(req, authReq.user);
    }
  }

  // Log du body pour POST/PUT en développement
  if (LOG_CONFIG.enableBody && (req.method === 'POST' || req.method === 'PUT')) {
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = sanitizeData(req.body);
      const bodyStr = JSON.stringify(sanitizedBody, null, 2);
      
      if (isBudgetOperation) {
        console.log(`💰 DONNÉES BUDGÉTAIRES:`);
        logBudgetData(req.body, req.originalUrl);
      }
      
      if (bodyStr.length > LOG_CONFIG.maxBodySize) {
        console.log(`📦 Body (${formatBytes(bodyStr.length)}): [TRUNCATED]`);
        console.log(bodyStr.substring(0, LOG_CONFIG.maxBodySize) + '...');
      } else {
        console.log(`📦 Body (${formatBytes(bodyStr.length)}):`, sanitizedBody);
      }
    }
  }

  // Log des headers en développement
  if (LOG_CONFIG.enableHeaders && req.headers) {
    const sanitizedHeaders = sanitizeData(req.headers);
    console.log(`📨 Headers:`, sanitizedHeaders);
  }

  // Override de res.json pour capturer les réponses
  const originalJson = res.json;
  res.json = function(body: any) {
    res.locals.responseBody = body;
    
    // Log spécial pour les réponses budgétaires
    if (isBudgetOperation && body) {
      logBudgetResponse(body, req.originalUrl, res.statusCode);
    }
    
    return originalJson.call(this, body);
  };

  // Log de la réponse
  res.on('finish', () => {
    const duration = Date.now() - start;
    const contentLength = res.get('content-length');
    
    const logEntry: LogEntry = {
      ...baseLog,
      duration,
      statusCode: res.statusCode,
      contentLength: contentLength ? parseInt(contentLength) : undefined
    } as LogEntry;

    // Log coloré de la réponse
    console.log(`\n📤 ${getStatusColor(res.statusCode)} RÉPONSE ${isBudgetOperation ? '💰 [BUDGET]' : ''}`);
    console.log(`⏰ ${new Date().toISOString()}`);
    console.log(`🔄 ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    
    if (contentLength) {
      console.log(`📦 Taille: ${formatBytes(parseInt(contentLength))}`);
    }

    // Métriques de performance
    if (duration > 1000) {
      console.log(`⚠️  Requête lente détectée: ${duration}ms`);
    }

    if (duration > 5000) {
      console.log(`🚨 Requête très lente: ${duration}ms - Investigation requise`);
    }

    // Log spécial pour les erreurs budgétaires
    if (res.statusCode >= 400 && isBudgetOperation) {
      console.log(`💰❌ ERREUR BUDGÉTAIRE: ${res.statusCode}`);
      if (res.locals.responseBody && res.locals.responseBody.error) {
        console.log(`💰📝 Détail: ${res.locals.responseBody.error}`);
      }
    }

    // Séparateur pour lisibilité
    console.log(`${'─'.repeat(60)}\n`);

    // Log structuré pour les outils de monitoring
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
};

// ==================== LOGGER SPÉCIALISÉ POUR LES OPÉRATIONS BUDGÉTAIRES ====================
const logBudgetOperation = (req: Request, user: any): void => {
  const url = req.originalUrl;
  
  if (url.includes('/budget-settings')) {
    if (req.method === 'POST') {
      console.log(`💰⚙️  DÉFINITION BUDGET: User ${user.id}`);
    } else if (req.method === 'GET') {
      console.log(`💰📊 CONSULTATION BUDGET: User ${user.id}`);
    }
  } else if (url.includes('/transactions')) {
    if (req.method === 'POST') {
      console.log(`💰➕ AJOUT TRANSACTION: User ${user.id}`);
    } else if (url.includes('/summary')) {
      console.log(`💰📋 RÉSUMÉ MENSUEL: User ${user.id}`);
    } else if (req.method === 'GET') {
      console.log(`💰📄 CONSULTATION TRANSACTIONS: User ${user.id}`);
    }
  }
};

const logBudgetData = (body: any, url: string): void => {
  if (url.includes('/budget-settings')) {
    if (body.monthly_salary) {
      console.log(`💰 Salaire mensuel: ${body.monthly_salary}€`);
    }
    if (body.savings_goal) {
      console.log(`🐷 Objectif épargne: ${body.savings_goal}€`);
    }
  } else if (url.includes('/transactions') && body.amount) {
    console.log(`💳 Montant transaction: ${body.amount}€`);
    if (body.category_id) {
      console.log(`📁 Catégorie ID: ${body.category_id}`);
    }
    if (body.description) {
      console.log(`📝 Description: ${body.description}`);
    }
  }
};

const logBudgetResponse = (body: any, url: string, statusCode: number): void => {
  if (statusCode >= 200 && statusCode < 300) {
    if (url.includes('/summary')) {
      console.log(`💰✅ RÉSUMÉ CALCULÉ:`);
      if (body.monthlySalary) console.log(`  💰 Salaire: ${body.monthlySalary}€`);
      if (body.totalExpenses) console.log(`  💸 Dépenses: ${body.totalExpenses}€`);
      if (body.actualSavings) console.log(`  🐷 Épargne: ${body.actualSavings}€`);
      if (body.remainingBudget !== undefined) {
        const icon = body.remainingBudget >= 0 ? '✅' : '❌';
        console.log(`  ${icon} Reste: ${body.remainingBudget}€`);
      }
      if (body.alerts) {
        console.log(`  🚨 Alertes: ${JSON.stringify(body.alerts)}`);
      }
    } else if (url.includes('/budget-settings')) {
      console.log(`💰✅ PARAMÈTRES SAUVEGARDÉS`);
    } else if (body.budgetInfo) {
      console.log(`💰✅ TRANSACTION AVEC BUDGET INFO:`);
      console.log(`  💰 Reste: ${body.budgetInfo.remainingBudget}€`);
      if (body.warnings && body.warnings.length > 0) {
        console.log(`  ⚠️  Avertissements: ${body.warnings.join(', ')}`);
      }
    }
  }
};

// ==================== LOGGER POUR L'AUTHENTIFICATION ====================
export const authLogger = (req: Request, res: Response, next: NextFunction): void => {
  console.log(`🔐 AUTH: ${req.method} ${req.originalUrl}`);
  
  if (req.method === 'POST') {
    if (req.originalUrl.includes('/login')) {
      console.log(`📧 Tentative de connexion: ${req.body?.email || 'email manquant'}`);
    } else if (req.originalUrl.includes('/register')) {
      console.log(`📝 Tentative d'inscription: ${req.body?.email || 'email manquant'}`);
      console.log(`👤 Nom: ${req.body?.firstName || 'nom manquant'}`);
    }
  }

  // Log du résultat après traitement
  res.on('finish', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      if (req.originalUrl.includes('/login')) {
        console.log(`✅ Connexion réussie pour: ${req.body?.email}`);
      } else if (req.originalUrl.includes('/register')) {
        console.log(`✅ Inscription réussie pour: ${req.body?.email}`);
      }
    } else {
      console.log(`❌ Échec authentification (${res.statusCode}): ${req.body?.email}`);
    }
  });

  next();
};

// ==================== LOGGER POUR LES TRANSACTIONS ====================
export const transactionLogger = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  console.log(`💰 TRANSACTION: ${req.method} ${req.originalUrl}`);
  
  if (authReq.user) {
    console.log(`👤 User ${authReq.user.id} (${authReq.user.email})`);
    
    // Log détaillé selon l'opération
    if (req.method === 'POST' && req.body) {
      console.log(`➕ Ajout transaction: ${req.body.amount}€`);
    } else if (req.method === 'PUT') {
      console.log(`✏️ Modification transaction ID: ${req.params.id}`);
    } else if (req.method === 'DELETE') {
      console.log(`🗑️ Suppression transaction ID: ${req.params.id}`);
    } else if (req.method === 'GET' && req.originalUrl.includes('/summary')) {
      console.log(`📊 Demande résumé: ${req.params.month}/${req.params.year}`);
    } else if (req.method === 'GET') {
      console.log(`📄 Consultation transactions: ${req.params.month}/${req.params.year}`);
    }
  }

  next();
};

// ==================== LOGGER POUR LES CATÉGORIES ====================
export const categoryLogger = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  console.log(`📁 CATEGORY: ${req.method} ${req.originalUrl}`);
  
  if (authReq.user) {
    console.log(`👤 User ${authReq.user.id} (${authReq.user.email})`);
    
    if (req.method === 'POST' && req.body) {
      console.log(`➕ Création catégorie: ${req.body.name} (${req.body.type}) - Budget: ${req.body.budget_amount}€`);
    } else if (req.method === 'PUT') {
      console.log(`✏️ Modification catégorie ID: ${req.params.id}`);
    } else if (req.method === 'DELETE') {
      console.log(`🗑️ Suppression catégorie ID: ${req.params.id}`);
    }
  }

  next();
};

// ==================== LOGGER POUR LES PARAMÈTRES BUDGÉTAIRES ====================
export const budgetSettingsLogger = (req: Request, res: Response, next: NextFunction): void => {
  const authReq = req as AuthRequest;
  console.log(`⚙️ BUDGET SETTINGS: ${req.method} ${req.originalUrl}`);
  
  if (authReq.user) {
    console.log(`👤 User ${authReq.user.id} (${authReq.user.email})`);
    console.log(`📅 Période: ${req.params.month}/${req.params.year}`);
    
    if (req.method === 'POST' && req.body) {
      console.log(`💰 Nouveau salaire: ${req.body.monthly_salary}€`);
      console.log(`🐷 Nouvel objectif épargne: ${req.body.savings_goal}€`);
      
      // Calculer et afficher la répartition budgétaire
      const salary = req.body.monthly_salary;
      const savings = req.body.savings_goal;
      const remaining = salary - savings;
      const savingsPercentage = ((savings / salary) * 100).toFixed(1);
      
      console.log(`📊 Répartition budgétaire:`);
      console.log(`   💰 Salaire: ${salary}€ (100%)`);
      console.log(`   🐷 Épargne: ${savings}€ (${savingsPercentage}%)`);
      console.log(`   💸 Disponible dépenses: ${remaining}€ (${(100 - parseFloat(savingsPercentage)).toFixed(1)}%)`);
      
      if (remaining < 0) {
        console.log(`   ❌ ATTENTION: Budget incohérent (épargne > salaire)`);
      } else if (remaining < 500) {
        console.log(`   ⚠️  ATTENTION: Marge très faible pour les dépenses`);
      }
    }
  }

  next();
};

// ==================== LOGGER D'ERREURS SPÉCIALISÉ ====================
export const errorLogger = (error: any, req: Request): void => {
  console.error('\n💥 ==================== ERREUR DÉTAILLÉE ====================');
  console.error(`📍 URL: ${req.method} ${req.originalUrl}`);
  console.error(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.error(`🔍 IP: ${req.ip}`);
  
  // Log spécial pour utilisateur authentifié
  const authReq = req as AuthRequest;
  if (authReq.user) {
    console.error(`👤 User: ${authReq.user.id} (${authReq.user.email})`);
  }

  console.error(`💥 Error Type: ${error.constructor.name}`);
  console.error(`📝 Message: ${error.message}`);
  console.error(`📊 Status Code: ${error.statusCode || 'N/A'}`);
  
  // Log spécial pour les erreurs budgétaires
  if (error.budgetRelated) {
    console.error(`💰 ERREUR BUDGÉTAIRE DÉTECTÉE`);
    if (req.body) {
      console.error(`💰 Données concernées:`, sanitizeData(req.body));
    }
  }
  
  // Log des erreurs de validation
  if (error.validationErrors && error.validationErrors.length > 0) {
    console.error(`📋 Erreurs de validation:`);
    error.validationErrors.forEach((err: any, index: number) => {
      console.error(`   ${index + 1}. ${err.field}: ${err.message} (valeur: ${err.value})`);
    });
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.error(`🔍 Stack trace:\n${error.stack}`);
  }
  
  console.error('💥 =========================================================\n');
};

// ==================== LOGGER DE PERFORMANCE BUDGÉTAIRE ====================
export const budgetPerformanceLogger = (): void => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  console.log('\n📊 ==================== PERFORMANCE BUDGET ====================');
  console.log(`⏰ Check à: ${now.toISOString()}`);
  console.log(`📅 Mois actuel: ${currentMonth}/${currentYear}`);
  console.log(`💾 Mémoire utilisée: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log(`⏱️  Uptime: ${Math.floor(process.uptime())}s`);
  console.log(`💰 Système: Budget Tracker basé sur salaire mensuel`);
  console.log(`🎯 Fonctionnalités actives:`);
  console.log(`   ✅ Calculs automatiques de budget`);
  console.log(`   ✅ Alertes de dépassement`);
  console.log(`   ✅ Suivi pourcentages vs salaire`);
  console.log(`   ✅ Validation cohérence budgétaire`);
  console.log('📊 ============================================================\n');
};

// ==================== LOGGER POUR LES OPÉRATIONS CRITIQUES ====================
export const criticalOperationLogger = (
  operation: string, 
  userId: number, 
  details: any,
  success: boolean = true
): void => {
  const timestamp = new Date().toISOString();
  const status = success ? '✅' : '❌';
  
  console.log(`\n🚨 ${status} OPÉRATION CRITIQUE: ${operation}`);
  console.log(`⏰ ${timestamp}`);
  console.log(`👤 User ID: ${userId}`);
  console.log(`📋 Détails:`, details);
  
  if (!success) {
    console.log(`💥 Échec de l'opération critique - Investigation requise`);
  }
  
  console.log(`🚨 ================================================\n`);
};

// ==================== LOGGER POUR LES MÉTRIQUES BUDGÉTAIRES ====================
export const budgetMetricsLogger = (
  userId: number,
  metrics: {
    month: number;
    year: number;
    salary: number;
    totalExpenses: number;
    savings: number;
    budgetUsage: number;
    savingsRate: number;
  }
): void => {
  console.log(`\n📊 MÉTRIQUES BUDGÉTAIRES - User ${userId}`);
  console.log(`📅 Période: ${metrics.month}/${metrics.year}`);
  console.log(`💰 Salaire: ${metrics.salary}€`);
  console.log(`💸 Dépenses: ${metrics.totalExpenses}€ (${((metrics.totalExpenses / metrics.salary) * 100).toFixed(1)}%)`);
  console.log(`🐷 Épargne: ${metrics.savings}€ (${metrics.savingsRate.toFixed(1)}%)`);
  console.log(`📊 Utilisation budget: ${metrics.budgetUsage.toFixed(1)}%`);
  
  // Indicateurs de santé budgétaire
  if (metrics.budgetUsage > 100) {
    console.log(`🚨 ALERTE: Budget dépassé de ${(metrics.budgetUsage - 100).toFixed(1)}%`);
  } else if (metrics.budgetUsage > 90) {
    console.log(`⚠️  ATTENTION: Budget presque épuisé (${metrics.budgetUsage.toFixed(1)}%)`);
  } else if (metrics.budgetUsage < 50) {
    console.log(`💡 INFO: Utilisation budget faible - Potentiel d'épargne supplémentaire`);
  } else {
    console.log(`✅ Utilisation budget saine`);
  }
  
  console.log(`📊 ===============================================\n`);
};

// ==================== SYSTÈME DE NOTIFICATION CONSOLE ====================
export const logBudgetAlert = (
  type: 'budget_exceeded' | 'savings_goal_achieved' | 'low_balance' | 'high_spending',
  userId: number,
  details: any
): void => {
  const icons = {
    budget_exceeded: '🚨',
    savings_goal_achieved: '🎉',
    low_balance: '⚠️',
    high_spending: '📈'
  };
  
  const messages = {
    budget_exceeded: 'BUDGET DÉPASSÉ',
    savings_goal_achieved: 'OBJECTIF ÉPARGNE ATTEINT',
    low_balance: 'SOLDE FAIBLE',
    high_spending: 'DÉPENSES ÉLEVÉES'
  };
  
  console.log(`\n${icons[type]} ALERTE BUDGÉTAIRE: ${messages[type]}`);
  console.log(`👤 User: ${userId}`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log(`📋 Détails:`, details);
  console.log(`${icons[type]} ===============================================\n`);
};

// ==================== EXPORT DES FONCTIONS ====================


// ==================== INITIALISATION DU MONITORING ====================
// Lancer le monitoring de performance toutes les 5 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(budgetPerformanceLogger, 300000);
}