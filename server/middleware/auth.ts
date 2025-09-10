import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, User } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Interface pour le payload JWT
interface JWTPayload {
  id: number;
  email: string;
  firstName: string;
  iat?: number;
  exp?: number;
}

// Middleware d'authentification
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    console.log('❌ Aucun token fourni');
    res.status(401).json({ 
      error: 'Token d\'accès requis',
      message: 'Veuillez vous connecter pour accéder à cette ressource'
    });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('❌ Token invalide:', err.message);
      
      if (err.name === 'TokenExpiredError') {
        res.status(401).json({ 
          error: 'Token expiré',
          message: 'Votre session a expiré, veuillez vous reconnecter'
        });
      } else if (err.name === 'JsonWebTokenError') {
        res.status(401).json({ 
          error: 'Token invalide',
          message: 'Le token fourni n\'est pas valide'
        });
      } else {
        res.status(401).json({ 
          error: 'Erreur d\'authentification',
          message: 'Impossible de vérifier votre identité'
        });
      }
      return;
    }

    const payload = decoded as JWTPayload;
    
    // Ajouter les informations utilisateur à la requête
    req.user = {
      id: payload.id,
      email: payload.email,
      firstName: payload.firstName,
      created_at: '', // Ces champs seront remplis si nécessaire
      updated_at: ''
    };

    console.log(`✅ Utilisateur authentifié: ${req.user.email} (ID: ${req.user.id})`);
    next();
  });
};

// Fonction pour générer un JWT
export const generateToken = (user: { id: number; email: string; firstName: string }): string => {
  const payload: JWTPayload = {
    id: user.id,
    email: user.email,
    firstName: user.firstName
  };

  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '24h' // Token valable 24h
  });
};

// Fonction pour vérifier un token sans middleware (utile pour les tests)
export const verifyToken = (token: string): Promise<JWTPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as JWTPayload);
      }
    });
  });
};

// Middleware optionnel pour l'authentification (ne bloque pas si pas de token)
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Pas de token, mais on continue quand même
    next();
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      const payload = decoded as JWTPayload;
      req.user = {
        id: payload.id,
        email: payload.email,
        firstName: payload.firstName,
        created_at: '',
        updated_at: ''
      };
    }
    // On continue dans tous les cas (avec ou sans user)
    next();
  });
};

// Middleware pour vérifier que l'utilisateur est propriétaire de la ressource
export const checkResourceOwnership = (resourceUserIdField: string = 'user_id') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentification requise' });
      return;
    }

    // Si l'ID utilisateur est dans les paramètres d'URL
    if (req.params.userId && parseInt(req.params.userId) !== req.user.id) {
      res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Vous ne pouvez accéder qu\'à vos propres données'
      });
      return;
    }

    // Si l'ID utilisateur est dans le body de la requête
    if (req.body && req.body[resourceUserIdField] && req.body[resourceUserIdField] !== req.user.id) {
      res.status(403).json({ 
        error: 'Accès refusé',
        message: 'Vous ne pouvez modifier que vos propres données'
      });
      return;
    }

    next();
  };
};

// Fonction utilitaire pour extraire l'utilisateur du token
export const getUserFromToken = async (token: string): Promise<User | null> => {
  try {
    const payload = await verifyToken(token);
    return {
      id: payload.id,
      email: payload.email,
      firstName: payload.firstName,
      created_at: '',
      updated_at: ''
    };
  } catch (error) {
    console.error('❌ Erreur extraction utilisateur du token:', error);
    return null;
  }
};

// Middleware pour logger les tentatives d'authentification
export const authAttemptLogger = (req: Request, res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  console.log(`🔐 [${timestamp}] Tentative d'authentification:`);
  console.log(`   📍 IP: ${ip}`);
  console.log(`   🌐 User-Agent: ${userAgent}`);
  console.log(`   📱 Endpoint: ${req.method} ${req.originalUrl}`);
  
  // Log du résultat après traitement
  res.on('finish', () => {
    const success = res.statusCode === 200 || res.statusCode === 201;
    const statusIcon = success ? '✅' : '❌';
    console.log(`   ${statusIcon} Résultat: ${res.statusCode}`);
  });
  
  next();
};

export default {
  authenticateToken,
  generateToken,
  verifyToken,
  optionalAuth,
  checkResourceOwnership,
  getUserFromToken,
  authAttemptLogger
};