import express from 'express';
import { db } from '../database/init';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();
router.use(authenticateToken);

// Définir le revenu du mois
router.post('/:month/:year', (req: AuthRequest, res): void => {
  console.log('💰 POST income appelé');
  console.log('📋 Params:', req.params);
  console.log('📋 Body:', req.body);
  
  const { month, year } = req.params;
  const { income_amount } = req.body;
  const userId = req.user!.id;

  if (!income_amount || income_amount <= 0) {
    res.status(400).json({ error: 'Montant de revenu invalide' });
    return;
  }

  console.log(`💰 Définition revenu: ${income_amount}€ pour ${month}/${year} user ${userId}`);

  db.run(
    `INSERT OR REPLACE INTO monthly_income (user_id, month, year, income_amount, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [userId, month, year, income_amount],
    function (err): void {
      if (err) {
        console.error('❌ Erreur lors de la définition du revenu:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      console.log('✅ Revenu défini avec succès');
      res.json({
        message: 'Revenu défini avec succès',
        income_amount,
        month,
        year
      });
    }
  );
});

// Récupérer le revenu du mois
router.get('/:month/:year', (req: AuthRequest, res): void => {
  console.log('💰 GET income appelé');
  console.log('📋 Params:', req.params);
  
  const { month, year } = req.params;
  const userId = req.user!.id;

  db.get(
    'SELECT * FROM monthly_income WHERE user_id = ? AND month = ? AND year = ?',
    [userId, month, year],
    (err, income): void => {
      if (err) {
        console.error('❌ Erreur récupération revenu:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      console.log('💰 Revenu trouvé:', income);
      res.json(income || { income_amount: 0 });
    }
  );
});

// Historique des revenus
router.get('/history', (req: AuthRequest, res): void => {
  const userId = req.user!.id;

  db.all(
    'SELECT * FROM monthly_income WHERE user_id = ? ORDER BY year DESC, month DESC LIMIT 12',
    [userId],
    (err, incomes): void => {
      if (err) {
        console.error('❌ Erreur historique revenus:', err);
        res.status(500).json({ error: 'Erreur serveur' });
        return;
      }

      res.json(incomes);
    }
  );
});

export default router;