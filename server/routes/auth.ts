import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/init.js';
import { generateToken, authAttemptLogger } from '../middleware/auth.js';
import { authLimiter } from '../middleware/security.js';
import { validateRequired, validateEmail, throwValidationError } from '../middleware/errorHandler.js';
import { LoginCredentials, RegisterData, User } from '../types.js';
import { dbManager } from '../database/init.js';

const router = express.Router();

// Appliquer le rate limiting sur toutes les routes d'auth
router.use(authLimiter);

// Appliquer le logger d'authentification
router.use(authAttemptLogger);

// Route d'inscription
router.post('/register', async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { email, password, firstName }: RegisterData = req.body;

    // Validation des champs requis
    const requiredErrors = validateRequired(req.body, ['email', 'password', 'firstName']);
    if (requiredErrors.length > 0) {
      return res.status(400).json({
        error: 'Champs requis manquants',
        validationErrors: requiredErrors
      });
    }

    // Validation de l'email
    const emailErrors = validateEmail(email);
    if (emailErrors.length > 0) {
      return res.status(400).json({
        error: 'Email invalide',
        validationErrors: emailErrors
      });
    }

    // Validation du mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Validation du prénom
    if (firstName.length < 2) {
      return res.status(400).json({
        error: 'Le prénom doit contenir au moins 2 caractères'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    db.get(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()],
      async (err, existingUser): Promise<Response | void> => {
        if (err) {
          console.error('❌ Erreur vérification utilisateur existant:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (existingUser) {
          return res.status(409).json({ 
            error: 'Un compte avec cet email existe déjà',
            suggestion: 'Essayez de vous connecter ou utilisez un autre email'
          });
        }

        try {
          // Hasher le mot de passe
          const saltRounds = 12;
          const hashedPassword = await bcrypt.hash(password, saltRounds);

          // Créer l'utilisateur
          db.run(
            'INSERT INTO users (email, password_hash, firstName) VALUES (?, ?, ?)',
            [email.toLowerCase(), hashedPassword, firstName],
            async function (err): Promise<Response | void> {
              if (err) {
                console.error('❌ Erreur création utilisateur:', err);
                return res.status(500).json({ error: 'Erreur lors de la création du compte' });
              }

              const userId = this.lastID;

              // Générer un token JWT
              const token = generateToken({
                id: userId,
                email: email.toLowerCase(),
                firstName
              });

              // Créer les paramètres budgétaires par défaut pour le mois actuel
              const now = new Date();
              const currentMonth = now.getMonth() + 1;
              const currentYear = now.getFullYear();

              db.run(
                'INSERT INTO user_budget_settings (user_id, month, year, monthly_salary, savings_goal) VALUES (?, ?, ?, ?, ?)',
                [userId, currentMonth, currentYear, 2750.00, 800.00],
                (err) => {
                  if (err) {
                    console.error('❌ Erreur création paramètres budget:', err);
                    // On continue même si ça échoue
                  } else {
                    console.log(`✅ Paramètres budgétaires par défaut créés pour ${currentMonth}/${currentYear}`);
                  }
                }
              );

              // AJOUTER LES CATÉGORIES PAR DÉFAUT
              try {
                await dbManager.addMissingCategories(userId);
                console.log('✅ Catégories par défaut ajoutées pour le nouvel utilisateur');
              } catch (categoryError) {
                console.error('❌ Erreur création catégories par défaut:', categoryError);
                // On continue même si ça échoue, l'utilisateur pourra créer ses catégories manuellement
              }

              return res.status(201).json({
                message: 'Compte créé avec succès',
                token,
                user: {
                  id: userId,
                  email: email.toLowerCase(),
                  firstName
                }
              });
            }
          );
        } catch (hashError) {
          console.error('❌ Erreur hashage mot de passe:', hashError);
          return res.status(500).json({ error: 'Erreur lors de la création du compte' });
        }
      }
    );
  } catch (error) {
    console.error('❌ Erreur générale inscription:', error);
    return res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Route de connexion
router.post('/login', (req: Request, res: Response): Response | void => {
  try {
    const { email, password }: LoginCredentials = req.body;

    // Validation des champs requis
    const requiredErrors = validateRequired(req.body, ['email', 'password']);
    if (requiredErrors.length > 0) {
      return res.status(400).json({
        error: 'Email et mot de passe requis',
        validationErrors: requiredErrors
      });
    }

    // Validation de l'email
    const emailErrors = validateEmail(email);
    if (emailErrors.length > 0) {
      return res.status(400).json({
        error: 'Format d\'email invalide',
        validationErrors: emailErrors
      });
    }

    // Rechercher l'utilisateur
    db.get(
      'SELECT id, email, password_hash, firstName, created_at FROM users WHERE email = ?',
      [email.toLowerCase()],
      async (err, user: any): Promise<Response | void> => {
        if (err) {
          console.error('❌ Erreur recherche utilisateur:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (!user) {
          console.log('❌ Utilisateur non trouvé:', email);
          return res.status(401).json({ 
            error: 'Email ou mot de passe incorrect',
            message: 'Vérifiez vos identifiants et réessayez'
          });
        }

        try {
          // Vérifier le mot de passe
          const passwordMatch = await bcrypt.compare(password, user.password_hash);

          if (!passwordMatch) {
            console.log('❌ Mot de passe incorrect pour:', email);
            return res.status(401).json({ 
              error: 'Email ou mot de passe incorrect',
              message: 'Vérifiez vos identifiants et réessayez'
            });
          }

          console.log('✅ Connexion réussie pour:', email);

          // Générer un token JWT
          const token = generateToken({
            id: user.id,
            email: user.email,
            firstName: user.firstName
          });

          return res.json({
            message: 'Connexion réussie',
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              created_at: user.created_at
            }
          });
        } catch (compareError) {
          console.error('❌ Erreur comparaison mot de passe:', compareError);
          return res.status(500).json({ error: 'Erreur lors de la vérification du mot de passe' });
        }
      }
    );
  } catch (error) {
    console.error('❌ Erreur générale connexion:', error);
    return res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// Route pour vérifier le token (utile pour le frontend)
router.get('/verify', (req: Request, res: Response): Response | void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Vérifier que l'utilisateur existe toujours
    db.get(
      'SELECT id, email, firstName, created_at FROM users WHERE id = ?',
      [decoded.id],
      (err, user: any): Response | void => {
        if (err) {
          console.error('❌ Erreur vérification utilisateur:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        return res.json({
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            created_at: user.created_at
          }
        });
      }
    );
  } catch (error) {
    console.error('❌ Token invalide:', error);
    return res.status(401).json({ error: 'Token invalide' });
  }
});

// Route de déconnexion (côté client seulement, mais utile pour les logs)
router.post('/logout', (req: Request, res: Response): Response => {
  console.log('👋 POST /auth/logout appelé');
  
  // En JWT, la déconnexion se fait côté client en supprimant le token
  // Ici on peut juste logger l'événement
  
  return res.json({ 
    message: 'Déconnexion réussie',
    instruction: 'Supprimez le token côté client'
  });
});

// Route pour changer le mot de passe (nécessite d'être connecté)
router.post('/change-password', (req: Request, res: Response): Response | void => {
  console.log('🔑 POST /auth/change-password appelé');
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  }

  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérifier l'utilisateur et le mot de passe actuel
    db.get(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [decoded.id],
      async (err, user: any): Promise<Response | void> => {
        if (err) {
          console.error('❌ Erreur recherche utilisateur:', err);
          return res.status(500).json({ error: 'Erreur serveur' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        try {
          // Vérifier le mot de passe actuel
          const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);

          if (!passwordMatch) {
            return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
          }

          // Hasher le nouveau mot de passe
          const saltRounds = 12;
          const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

          // Mettre à jour le mot de passe
          db.run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedNewPassword, user.id],
            (err): Response | void => {
              if (err) {
                console.error('❌ Erreur mise à jour mot de passe:', err);
                return res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe' });
              }

              console.log('✅ Mot de passe changé pour l\'utilisateur:', user.id);
              return res.json({ message: 'Mot de passe modifié avec succès' });
            }
          );
        } catch (error) {
          console.error('❌ Erreur traitement mot de passe:', error);
          return res.status(500).json({ error: 'Erreur serveur' });
        }
      }
    );
  } catch (error) {
    console.error('❌ Token invalide:', error);
    return res.status(401).json({ error: 'Token invalide' });
  }
});

export default router;