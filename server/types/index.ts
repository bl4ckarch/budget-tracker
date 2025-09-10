import { Request } from 'express';

// ==================== INTERFACES UTILISATEUR ====================
export interface User {
  id: number;
  email: string;
  firstName: string;
  created_at: string;
  updated_at: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
}

// ==================== INTERFACES BUDGET MENSUEL ====================
export interface UserBudgetSettings {
  id: number;
  user_id: number;
  month: number;
  year: number;
  monthly_salary: number;
  savings_goal: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetSettingsData {
  month: number;
  year: number;
  monthly_salary: number;
  savings_goal: number;
}

export interface BudgetSettingsResponse extends UserBudgetSettings {
  isDefault: boolean;
}

// ==================== INTERFACES CATÉGORIES ====================
export type CategoryType = 'income' | 'fixed_expense' | 'variable_expense' | 'savings';

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  budget_amount: number;
  color: string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  type: CategoryType;
  budget_amount: number;
  color?: string;
}

// ==================== INTERFACES TRANSACTIONS ====================
export interface Transaction {
  id: number;
  user_id: number;
  category_id: number;
  amount: number;
  description?: string;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  // Relations
  category_name?: string;
  category_type?: CategoryType;
  category_color?: string;
  category_budget?: number;
}

export interface CreateTransactionData {
  amount: number;
  description?: string;
  category_id: number;
  transaction_date: string;
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  category?: string;
  sort?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'category';
  start_date?: string;
  end_date?: string;
}

export interface TransactionResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  budgetInfo: {
    monthlySalary: number;
    month: number;
    year: number;
  };
}

export interface TransactionCreateResponse {
  message: string;
  id: number;
  budgetInfo: {
    monthlySalary: number;
    savingsGoal: number;
    remainingBudget?: number;
    totalExpenses?: number;
  };
  warnings: string[];
}

// ==================== INTERFACES BUDGET ET RÉSUMÉS ====================
export interface CategoryBreakdown {
  id: number;
  category: string;
  type: CategoryType;
  spent: number;
  budget: number;
  remaining: number;
  percentage: number;
  salaryPercentage: number;
  isOverBudget: boolean;
  transactionCount: number;
  color: string;
}

export interface BudgetAlerts {
  overBudgetCategories: number;
  savingsGoalAchieved: boolean;
  budgetExceeded: boolean;
  lowBalance: boolean;
  highSpending: boolean;
}

export interface BudgetSummary {
  // Paramètres de base (configurés par l'utilisateur)
  monthlySalary: number;
  savingsGoal: number;
  
  // Revenus réels
  totalIncome: number;
  
  // Dépenses par type
  totalExpenses: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  
  // Épargne
  actualSavings: number;
  remainingToSavingsGoal: number;
  
  // Calculs budgétaires basés sur le salaire
  remainingBudget: number; // Salaire - Dépenses - Épargne
  budgetUsagePercentage: number; // % du salaire utilisé
  
  // Détails par catégorie
  categoryBreakdown: CategoryBreakdown[];
  
  // Alertes automatiques
  alerts: BudgetAlerts;
}

// ==================== INTERFACES STATISTIQUES ====================
export interface MonthlyStats {
  month: string;
  income: number;
  fixed_expense: number;
  variable_expense: number;
  savings: number;
  total_expenses: number;
  net_balance: number;
  salary_used_percentage: number;
  savings_goal_percentage: number;
}

export interface YearlyStats {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  averageMonthlyIncome: number;
  averageMonthlyExpenses: number;
  averageMonthlySavings: number;
  averageSalaryUsage: number;
  monthlyBreakdown: MonthlyStats[];
  topExpenseCategories: {
    name: string;
    total: number;
    type: CategoryType;
    salaryPercentage: number;
  }[];
}

export interface BudgetAnalytics {
  yearlyStats: YearlyStats;
  trends: {
    incomeGrowth: number;
    expenseGrowth: number;
    savingsRate: number;
    budgetEfficiency: number;
  };
  insights: {
    message: string;
    type: 'success' | 'warning' | 'danger' | 'info';
    category?: string;
  }[];
  recommendations: string[];
}

// ==================== INTERFACES API RESPONSES ====================
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  warnings?: string[];
  budgetInfo?: {
    monthlySalary: number;
    savingsGoal: number;
    remainingBudget: number;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
  timestamp: string;
  path?: string;
  validationErrors?: ValidationError[];
}

// ==================== INTERFACES DASHBOARD ====================
export interface DashboardData {
  currentMonth: {
    summary: BudgetSummary;
    recentTransactions: Transaction[];
    budgetProgress: {
      salaryUsed: number;
      savingsProgress: number;
      daysLeft: number;
    };
  };
  yearToDate: {
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    averageMonthlyBalance: number;
  };
  trends: {
    last6Months: MonthlyStats[];
    salaryUsageTrend: 'increasing' | 'decreasing' | 'stable';
    savingsRateTrend: 'improving' | 'declining' | 'stable';
  };
  alerts: {
    message: string;
    type: 'budget' | 'savings' | 'expense' | 'income';
    severity: 'low' | 'medium' | 'high';
  }[];
  quickActions: {
    addTransaction: boolean;
    reviewBudget: boolean;
    checkSavings: boolean;
    adjustSalary: boolean;
  };
}

// ==================== CONSTANTES DE BUDGET PAR DÉFAUT ====================
export const BUDGET_DEFAULTS = {
  // Valeurs par défaut selon votre discussion
  MONTHLY_SALARY: 2750,
  SAVINGS_GOAL: 800,
  
  // Répartition suggérée des dépenses fixes (en euros)
  FIXED_EXPENSES: {
    RENT: 800,
    CAR_LOAN: 120,
    CAR_INSURANCE: 100,
    PHONE_INTERNET: 50,
  },
  
  // Répartition suggérée des dépenses variables (en euros)
  VARIABLE_EXPENSES: {
    FOOD: 250,
    TRANSPORT: 120,
    ENTERTAINMENT: 350,
    HEALTH: 100,
    CLOTHING: 80,
  },
  
  // Calculé automatiquement: 2750 - 1070 (fixes) - 900 (variables) - 800 (épargne) = -20€
  // L'utilisateur devra ajuster ses budgets ou son salaire
} as const;

// ==================== CONSTANTES DE STYLE ====================
export const CATEGORY_COLORS = {
  income: '#10b981',
  fixed_expense: '#ef4444',
  variable_expense: '#f59e0b',
  savings: '#3b82f6'
} as const;

export const CATEGORY_ICONS = {
  income: '💰',
  fixed_expense: '🏠',
  variable_expense: '🛒',
  savings: '🐷'
} as const;

export const ALERT_COLORS = {
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6'
} as const;

// ==================== RÈGLES DE VALIDATION ====================
export interface ValidationRules {
  salary: {
    min: number;
    max: number;
  };
  savings: {
    min: number;
    max: number;
  };
  amount: {
    min: number;
    max: number;
  };
  description: {
    maxLength: number;
  };
  category: {
    nameMaxLength: number;
    budgetMax: number;
  };
}

export const VALIDATION_RULES: ValidationRules = {
  salary: {
    min: 1000,  // SMIC français approximatif
    max: 50000  // Plafond raisonnable
  },
  savings: {
    min: 0,
    max: 10000  // Maximum 10k€ d'épargne par mois
  },
  amount: {
    min: 0.01,
    max: 50000
  },
  description: {
    maxLength: 500
  },
  category: {
    nameMaxLength: 100,
    budgetMax: 10000
  }
} as const;

// ==================== TYPES POUR FORMULAIRES ====================
export interface BudgetSettingsFormData {
  monthly_salary: string;
  savings_goal: string;
}

export interface TransactionFormData {
  amount: string;
  description: string;
  category_id: string;
  transaction_date: string;
}

export interface CategoryFormData {
  name: string;
  type: CategoryType;
  budget_amount: string;
  color: string;
}

// ==================== INTERFACES POUR CALCULS BUDGÉTAIRES ====================
export interface BudgetCalculation {
  monthlySalary: number;
  savingsGoal: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  actualSavings: number;
  remainingBudget: number;
  isOverBudget: boolean;
  budgetUsagePercentage: number;
  savingsAchievementPercentage: number;
}

export interface CategoryBudgetStatus {
  categoryId: number;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usagePercentage: number;
  isOverBudget: boolean;
  salaryPercentage: number;
}

// ==================== TYPES POUR RAPPORTS ====================
export interface BudgetReport {
  period: {
    month: number;
    year: number;
    startDate: string;
    endDate: string;
  };
  summary: BudgetSummary;
  categoryDetails: CategoryBudgetStatus[];
  insights: {
    bestCategory: string;
    worstCategory: string;
    totalSavingsVsGoal: number;
    budgetEfficiencyScore: number;
  };
  recommendations: {
    action: string;
    impact: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

// ==================== EXPORT DES CONSTANTES ====================
export const API_ROUTES = {
  AUTH: '/api/auth',
  TRANSACTIONS: '/api/transactions',
  CATEGORIES: '/api/categories',
  BUDGET_SETTINGS: '/api/transactions/budget-settings',
  HEALTH: '/api/health',
  INFO: '/api/info',
  INIT_CATEGORIES: '/api/init-default-categories'
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
} as const;

// ==================== TYPES UTILITAIRES ====================
export type DateString = string; // Format YYYY-MM-DD
export type CurrencyAmount = number; // Montant en euros
export type Percentage = number; // Pourcentage (0-100)

// Helper type pour les réponses paginées
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Helper type pour les filtres de date
export interface DateFilter {
  startDate?: DateString;
  endDate?: DateString;
  month?: number;
  year?: number;
}

// Helper type pour les paramètres de tri
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// ==================== INTERFACES POUR L'INITIALISATION ====================
export interface DefaultCategory {
  name: string;
  type: CategoryType;
  budget_amount: number;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Revenus
  { name: 'Salaire', type: 'income', budget_amount: 2750, color: '#10b981' },
  { name: 'Primes', type: 'income', budget_amount: 0, color: '#059669' },
  
  // Dépenses fixes
  { name: 'Logement', type: 'fixed_expense', budget_amount: 800, color: '#ef4444' },
  { name: 'Crédit Auto', type: 'fixed_expense', budget_amount: 120, color: '#dc2626' },
  { name: 'Assurance Auto', type: 'fixed_expense', budget_amount: 100, color: '#b91c1c' },
  { name: 'Téléphone/Internet', type: 'fixed_expense', budget_amount: 50, color: '#991b1b' },
  
  // Dépenses variables
  { name: 'Alimentation', type: 'variable_expense', budget_amount: 250, color: '#f59e0b' },
  { name: 'Transport', type: 'variable_expense', budget_amount: 120, color: '#d97706' },
  { name: 'Loisirs', type: 'variable_expense', budget_amount: 350, color: '#b45309' },
  { name: 'Santé', type: 'variable_expense', budget_amount: 100, color: '#92400e' },
  { name: 'Vêtements', type: 'variable_expense', budget_amount: 80, color: '#78350f' },
  
  // Épargne
  { name: 'Épargne Mensuelle', type: 'savings', budget_amount: 800, color: '#3b82f6' }
] as const;