import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse, ValidationError } from '../types/index.js';

// ==================== CLASSE D'ERREUR PERSONNALISÉE ====================
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public validationErrors?: ValidationError[];
  public budgetRelated: boolean;

  constructor(
    message: string, 
    statusCode: number = 500, 
    validationErrors?: ValidationError[],
    budgetRelated: boolean = false
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.validationErrors = validationErrors;
    this.budgetRelated = budgetRelated;

    Error.captureStackTrace(this, this.constructor);
  }
}

// ==================== ERREURS SPÉCIFIQUES AU BUDGET ====================
export class BudgetError extends AppError {
  constructor(message: string, statusCode: number = 400, validationErrors?: ValidationError[]) {
    super(message, statusCode, validationErrors, true);
  }
}

export class SalaryValidationError extends BudgetError {
  constructor(salary: number) {
    super(`Salaire invalide: ${salary}€. Doit être entre 1000€ et 50000€`, 400);
  }
}

export class SavingsGoalError extends BudgetError {
  constructor(savings: number, salary: number) {
    super(`Objectif d'épargne trop élevé: ${savings}€ pour un salaire de ${salary}€`, 400);
  }
}

export class BudgetExceededError extends BudgetError {
  constructor(exceeded: number) {
    super(`Budget mensuel dépassé de ${exceeded.toFixed(2)}€`, 400);
  }
}

// ==================== MIDDLEWARE DE GESTION D'ERREUR PRINCIPAL ====================
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const ENV = process.env.NODE_ENV || 'development';
  
  // Déterminer le status code
  let statusCode = 500;
  if (err instanceof AppError) {
    statusCode = err.statusCode;
  }

  // Log détaillé de l'erreur
  console.error('\n💥 ==================== ERREUR ====================');
  console.error(`📍 URL: ${req.method} ${req.originalUrl}`);
  console.error(`🔍 IP: ${req.ip}`);
  console.error(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.error(`📋 User-Agent: ${req.get('User-Agent')}`);
  
  // Log spécial pour utilisateur authentifié
  if ((req as any).user) {
    console.error(`👤 User ID: ${(req as any).user.id} (${(req as any).user.email})`);
  }

  console.error(`💥 Error: ${err.message}`);
  console.error(`📊 Status: ${statusCode}`);
  
  // Log spécial pour les erreurs budgétaires
  if (err instanceof AppError && err.budgetRelated) {
    console.error(`💰 ERREUR BUDGÉTAIRE DÉTECTÉE`);
    console.error(`🎯 Type: ${err.constructor.name}`);
  }
  
  if (ENV === 'development') {
    console.error(`🔍 Stack:\n${err.stack}`);
    
    // Log des headers en développement
    if (req.headers.authorization) {
      console.error(`🔑 Auth header présent`);
    }
    
    // Log du body pour les erreurs POST/PUT
    if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
      console.error(`📦 Body:`, req.body);
    }
  }
  
  console.error('💥 ================================================\n');

  // Préparer la réponse d'erreur
  const errorResponse: ApiErrorResponse = {
    error: err.message || 'Erreur serveur interne',
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  };

  // Ajouter les détails en développement
  if (ENV === 'development') {
    errorResponse.details = err.stack;
  }

  // Ajouter les erreurs de validation si présentes
  if (err instanceof AppError && err.validationErrors) {
    errorResponse.validationErrors = err.validationErrors;
  }

  // Messages d'erreur spécifiques selon le statut
  switch (statusCode) {
    case 400:
      if (err instanceof BudgetError) {
        errorResponse.error = `Erreur budgétaire: ${err.message}`;
      } else {
        errorResponse.error = 'Requête invalide';
      }
      break;
    case 401:
      errorResponse.error = 'Authentification requise';
      break;
    case 403:
      errorResponse.error = 'Accès refusé - Permissions insuffisantes';
      break;
    case 404:
      errorResponse.error = 'Ressource non trouvée';
      break;
    case 409:
      errorResponse.error = 'Conflit de données - Ressource déjà existante';
      break;
    case 429:
      errorResponse.error = 'Trop de requêtes - Veuillez patienter';
      break;
    case 500:
    default:
      errorResponse.error = 'Erreur serveur interne';
      // En production, ne pas exposer les détails internes
      if (ENV === 'production') {
        errorResponse.error = 'Une erreur inattendue s\'est produite';
      }
      break;
  }

  res.status(statusCode).json(errorResponse);
};

// ==================== MIDDLEWARE POUR ROUTES NON TROUVÉES ====================
export const notFoundHandler = (req: Request, res: Response): void => {
  console.warn(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
  
  const suggestions: string[] = [];
  
  // Suggestions basées sur l'URL
  if (req.originalUrl.includes('/transaction')) {
    suggestions.push('Essayez /api/transactions/:month/:year pour récupérer les transactions');
    suggestions.push('Ou /api/transactions pour ajouter une transaction');
  }
  
  if (req.originalUrl.includes('/budget')) {
    suggestions.push('Essayez /api/transactions/budget-settings/:month/:year');
  }
  
  if (req.originalUrl.includes('/categor')) {
    suggestions.push('Essayez /api/categories pour gérer les catégories');
  }
  
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestions: suggestions.length > 0 ? suggestions : [
      'Vérifiez l\'URL et la méthode HTTP',
      'Consultez /api/info pour voir les routes disponibles'
    ]
  });
};

// ==================== WRAPPER POUR FONCTIONS ASYNC ====================
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// ==================== FONCTIONS POUR LANCER DES ERREURS SPÉCIFIQUES ====================
export const throwValidationError = (errors: ValidationError[]): never => {
  throw new AppError('Erreurs de validation', 400, errors);
};

export const throwNotFoundError = (resource: string = 'Ressource'): never => {
  throw new AppError(`${resource} non trouvée`, 404);
};

export const throwUnauthorizedError = (message: string = 'Authentification requise'): never => {
  throw new AppError(message, 401);
};

export const throwForbiddenError = (message: string = 'Accès refusé'): never => {
  throw new AppError(message, 403);
};

export const throwConflictError = (message: string = 'Conflit de données'): never => {
  throw new AppError(message, 409);
};

export const throwBudgetError = (message: string): never => {
  throw new BudgetError(message);
};

export const throwSalaryError = (salary: number): never => {
  throw new SalaryValidationError(salary);
};

export const throwSavingsError = (savings: number, salary: number): never => {
  throw new SavingsGoalError(savings, salary);
};

export const throwBudgetExceededError = (exceeded: number): never => {
  throw new BudgetExceededError(exceeded);
};

// ==================== FONCTIONS DE VALIDATION ====================
export const validateRequired = (data: any, fields: string[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  fields.forEach(field => {
    if (!data[field] || data[field] === '' || data[field] === null || data[field] === undefined) {
      errors.push({
        field,
        message: `Le champ '${field}' est requis`,
        value: data[field]
      });
    }
  });
  
  return errors;
};

export const validateNumber = (
  value: any, 
  field: string, 
  min?: number, 
  max?: number
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (value === null || value === undefined || value === '') {
    errors.push({
      field,
      message: `${field} est requis`,
      value
    });
    return errors;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    errors.push({
      field,
      message: `${field} doit être un nombre valide`,
      value
    });
    return errors;
  }
  
  if (min !== undefined && numValue < min) {
    errors.push({
      field,
      message: `${field} doit être supérieur ou égal à ${min}€`,
      value: numValue
    });
  }
  
  if (max !== undefined && numValue > max) {
    errors.push({
      field,
      message: `${field} doit être inférieur ou égal à ${max}€`,
      value: numValue
    });
  }
  
  return errors;
};

export const validateString = (
  value: any, 
  field: string, 
  minLength?: number, 
  maxLength?: number
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (typeof value !== 'string') {
    errors.push({
      field,
      message: `${field} doit être une chaîne de caractères`,
      value
    });
    return errors;
  }
  
  if (minLength !== undefined && value.length < minLength) {
    errors.push({
      field,
      message: `${field} doit contenir au moins ${minLength} caractères`,
      value
    });
  }
  
  if (maxLength !== undefined && value.length > maxLength) {
    errors.push({
      field,
      message: `${field} ne peut pas dépasser ${maxLength} caractères`,
      value
    });
  }
  
  return errors;
};

export const validateEmail = (email: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    errors.push({
      field: 'email',
      message: 'Format d\'email invalide',
      value: email
    });
  }
  
  return errors;
};

export const validateDate = (date: string, field: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const parsedDate = new Date(date);
  
  if (isNaN(parsedDate.getTime())) {
    errors.push({
      field,
      message: `${field} doit être une date valide (format YYYY-MM-DD)`,
      value: date
    });
    return errors;
  }
  
  // Vérifier que la date n'est pas trop ancienne ou future
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  if (parsedDate < twoYearsAgo) {
    errors.push({
      field,
      message: `${field} ne peut pas être antérieure à 2 ans`,
      value: date
    });
  }
  
  if (parsedDate > oneYearFromNow) {
    errors.push({
      field,
      message: `${field} ne peut pas être dans plus d'un an`,
      value: date
    });
  }
  
  return errors;
};

// ==================== VALIDATIONS SPÉCIFIQUES AU BUDGET ====================
export const validateSalary = (salary: number): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (salary < 1000) {
    errors.push({
      field: 'monthly_salary',
      message: 'Le salaire mensuel doit être d\'au moins 1000€',
      value: salary
    });
  }
  
  if (salary > 50000) {
    errors.push({
      field: 'monthly_salary',
      message: 'Le salaire mensuel ne peut pas dépasser 50000€',
      value: salary
    });
  }
  
  return errors;
};

export const validateSavingsGoal = (savings: number, salary?: number): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (savings < 0) {
    errors.push({
      field: 'savings_goal',
      message: 'L\'objectif d\'épargne ne peut pas être négatif',
      value: savings
    });
  }
  
  if (savings > 10000) {
    errors.push({
      field: 'savings_goal',
      message: 'L\'objectif d\'épargne ne peut pas dépasser 10000€ par mois',
      value: savings
    });
  }
  
  // Vérifier que l'épargne n'est pas trop élevée par rapport au salaire
  if (salary && savings > salary * 0.8) {
    errors.push({
      field: 'savings_goal',
      message: `L'objectif d'épargne (${savings}€) est trop élevé par rapport au salaire (${salary}€)`,
      value: savings
    });
  }
  
  return errors;
};

export const validateCategoryBudget = (budget: number, type: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  if (budget < 0) {
    errors.push({
      field: 'budget_amount',
      message: 'Le budget ne peut pas être négatif',
      value: budget
    });
  }
  
  if (budget > 10000) {
    errors.push({
      field: 'budget_amount',
      message: 'Le budget d\'une catégorie ne peut pas dépasser 10000€',
      value: budget
    });
  }
  
  // Validations spécifiques par type
  if (type === 'savings' && budget > 5000) {
    errors.push({
      field: 'budget_amount',
      message: 'L\'objectif d\'épargne mensuel ne devrait pas dépasser 5000€',
      value: budget
    });
  }
  
  return errors;
};

// ==================== VALIDATION COMPLÈTE D'UNE TRANSACTION ====================
export const validateTransactionData = (data: any): ValidationError[] => {
  let errors: ValidationError[] = [];
  
  // Champs requis
  errors = errors.concat(validateRequired(data, ['amount', 'category_id', 'transaction_date']));
  
  // Validation du montant
  if (data.amount !== undefined) {
    errors = errors.concat(validateNumber(data.amount, 'amount', 0.01, 50000));
  }
  
  // Validation de la date
  if (data.transaction_date) {
    errors = errors.concat(validateDate(data.transaction_date, 'transaction_date'));
  }
  
  // Validation de la description (optionnelle)
  if (data.description && data.description !== '') {
    errors = errors.concat(validateString(data.description, 'description', undefined, 500));
  }
  
  return errors;
};

// ==================== VALIDATION COMPLÈTE DES PARAMÈTRES BUDGÉTAIRES ====================
export const validateBudgetSettings = (data: any): ValidationError[] => {
  let errors: ValidationError[] = [];
  
  // Champs requis
  errors = errors.concat(validateRequired(data, ['monthly_salary', 'savings_goal']));
  
  if (data.monthly_salary !== undefined) {
    // Validation basique du nombre
    errors = errors.concat(validateNumber(data.monthly_salary, 'monthly_salary'));
    
    // Validation spécifique du salaire
    if (typeof data.monthly_salary === 'number') {
      errors = errors.concat(validateSalary(data.monthly_salary));
    }
  }
  
  if (data.savings_goal !== undefined) {
    // Validation basique du nombre
    errors = errors.concat(validateNumber(data.savings_goal, 'savings_goal'));
    
    // Validation spécifique de l'épargne
    if (typeof data.savings_goal === 'number') {
      errors = errors.concat(validateSavingsGoal(data.savings_goal, data.monthly_salary));
    }
  }
  
  return errors;
};

// ==================== HELPER POUR CHECKER LA COHÉRENCE BUDGÉTAIRE ====================
export const checkBudgetCoherence = (
  salary: number, 
  savingsGoal: number, 
  fixedExpenses: number, 
  variableExpenses: number
): { isValid: boolean; message?: string; suggestedAdjustment?: string } => {
  const totalExpenses = fixedExpenses + variableExpenses + savingsGoal;
  const remaining = salary - totalExpenses;
  
  if (remaining < 0) {
    return {
      isValid: false,
      message: `Budget incohérent: dépenses totales (${totalExpenses}€) > salaire (${salary}€)`,
      suggestedAdjustment: `Réduisez vos budgets de ${Math.abs(remaining).toFixed(2)}€ ou augmentez votre salaire`
    };
  }
  
  if (remaining < 50) {
    return {
      isValid: true,
      message: `Attention: il ne vous reste que ${remaining.toFixed(2)}€ de marge`,
      suggestedAdjustment: 'Considérez laisser plus de marge pour les imprévus'
    };
  }
  
  return { isValid: true };
};