import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// ==================== RATE LIMITING ====================

// Rate limiter général
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 110000000000000, // Maximum 100 requêtes par IP par fenêtre
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting pour les routes de santé
    return req.url === '/api/health';
  }
});

// Rate limiter strict pour l'authentification
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5100000000000000, // Maximum 5 tentatives de connexion par IP
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Ne pas compter les connexions réussies
});

// Rate limiter pour les transactions (éviter le spam)
export const transactionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1100000000000000000000000000000, // Maximum 10 transactions par minute
  message: {
    error: 'Trop de transactions ajoutées, veuillez patienter',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter pour les paramètres budgétaires
export const budgetSettingsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000000000000000000000000000, // Maximum 3 modifications de budget par 5 minutes
  message: {
    error: 'Trop de modifications de paramètres budgétaires, veuillez patienter',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ==================== HEADERS DE SÉCURITÉ ====================
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Sécurité générale
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Politique de sécurité du contenu (CSP)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
  );
  
  // Headers spécifiques API
  res.setHeader('X-API-Version', '1.0');
  res.setHeader('X-Budget-Tracker', 'Salary-Based-System');
  
  // Cache control pour les données sensibles
  if (req.url.includes('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// ==================== VALIDATION DES ENTRÉES ====================
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Nettoyer les paramètres d'URL
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        // Supprimer les caractères dangereux
        req.params[key] = req.params[key].replace(/[<>'"]/g, '');
      }
    });
  }
  
  // Nettoyer les paramètres de requête
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = (req.query[key] as string).replace(/[<>'"]/g, '');
      }
    });
  }
  
  // Nettoyer le body pour les chaînes de caractères
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Supprimer les scripts et balises HTML dangereuses
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<[^>]*>/g, '')
          .trim();
      }
    });
  }
  
  next();
};

// ==================== MIDDLEWARE DE VALIDATION DES MONTANTS ====================
export const validateCurrency = (req: Request, res: Response, next: NextFunction): Response | void => {
  if (req.body && req.body.amount) {
    const amount = parseFloat(req.body.amount);
    
    if (isNaN(amount)) {
      return res.status(400).json({
        error: 'Le montant doit être un nombre valide',
        field: 'amount',
        value: req.body.amount
      });
    }
    
    if (amount < 0) {
      return res.status(400).json({
        error: 'Le montant ne peut pas être négatif',
        field: 'amount',
        value: amount
      });
    }
    
    if (amount > 1000000) {
      return res.status(400).json({
        error: 'Le montant ne peut pas dépasser 1 000 000€',
        field: 'amount',
        value: amount
      });
    }
    
    // Arrondir à 2 décimales
    req.body.amount = Math.round(amount * 100) / 100;
  }
  
  // Validation pour les paramètres budgétaires
  if (req.body && req.body.monthly_salary) {
    const salary = parseFloat(req.body.monthly_salary);
    
    if (isNaN(salary) || salary < 1000 || salary > 50000) {
      return res.status(400).json({
        error: 'Le salaire mensuel doit être entre 1 000€ et 50 000€',
        field: 'monthly_salary',
        value: req.body.monthly_salary
      });
    }
    
    req.body.monthly_salary = Math.round(salary * 100) / 100;
  }
  
  if (req.body && req.body.savings_goal) {
    const savings = parseFloat(req.body.savings_goal);
    
    if (isNaN(savings) || savings < 0 || savings > 10000) {
      return res.status(400).json({
        error: 'L\'objectif d\'épargne doit être entre 0€ et 10 000€',
        field: 'savings_goal',
        value: req.body.savings_goal
      });
    }
    
    req.body.savings_goal = Math.round(savings * 100) / 100;
  }
  
  next();
};

// ==================== MIDDLEWARE DE VALIDATION DES DATES ====================
export const validateDates = (req: Request, res: Response, next: NextFunction): Response | void => {
  // Validation des paramètres de date dans l'URL
  if (req.params.month || req.params.year) {
    const month = parseInt(req.params.month);
    const year = parseInt(req.params.year);
    
    if (req.params.month && (isNaN(month) || month < 1 || month > 12)) {
      return res.status(400).json({
        error: 'Le mois doit être entre 1 et 12',
        field: 'month',
        value: req.params.month
      });
    }
    
    if (req.params.year && (isNaN(year) || year < 2020 || year > 2030)) {
      return res.status(400).json({
        error: 'L\'année doit être entre 2020 et 2030',
        field: 'year',
        value: req.params.year
      });
    }
  }
  
  // Validation des dates de transaction
  if (req.body && req.body.transaction_date) {
    const date = new Date(req.body.transaction_date);
    
    if (isNaN(date.getTime())) {
      return res.status(400).json({
        error: 'Format de date invalide (utilisez YYYY-MM-DD)',
        field: 'transaction_date',
        value: req.body.transaction_date
      });
    }
    
    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);
    
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(now.getFullYear() + 1);
    
    if (date < twoYearsAgo || date > oneYearFromNow) {
      return res.status(400).json({
        error: 'La date doit être comprise entre 2 ans dans le passé et 1 an dans le futur',
        field: 'transaction_date',
        value: req.body.transaction_date
      });
    }
  }
  
  next();
};

// ==================== MIDDLEWARE DE LOGGING SÉCURISÉ ====================
export const securityLogger = (req: Request, res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Log des tentatives de connexion
  if (req.url.includes('/auth/')) {
    console.log(`🔐 [${timestamp}] Auth attempt: ${req.method} ${req.url} from ${ip}`);
  }
  
  // Log des opérations sensibles
  if (req.url.includes('/budget-settings') || req.url.includes('/transactions')) {
    console.log(`💰 [${timestamp}] Budget operation: ${req.method} ${req.url} from ${ip}`);
  }
  
  // Détecter les tentatives d'attaque
  const suspiciousPatterns = [
    /script/i,
    /union.*select/i,
    /drop.*table/i,
    /\.\.\/\.\./,
    /<[^>]*>/
  ];
  
  const fullUrl = req.originalUrl + JSON.stringify(req.body || {});
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(fullUrl));
  
  if (isSuspicious) {
    console.warn(`🚨 [${timestamp}] SUSPICIOUS REQUEST: ${req.method} ${req.url} from ${ip}`);
    console.warn(`🚨 User-Agent: ${userAgent}`);
    console.warn(`🚨 Body: ${JSON.stringify(req.body)}`);
  }
  
  next();
};