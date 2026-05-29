/**
 * GET /api/notifications — liste les notifications de l'utilisateur
 * POST /api/notifications — crée une notification (usage interne)
 */

const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT }       = require('../_lib/auth');

function extractToken(req) {
  const auth = (req.headers['authorization'] || '').trim();
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawToken = extractToken(req);
  if (!rawToken) return res.status(401).json({ error: 'Non authentifié' });
  const jwtPayload = verifyJWT(rawToken);
  if (!jwtPayload) return res.status(401).json({ error: 'Session expirée' });

  const userId = jwtPayload.userId;

  /* ── GET : liste des notifications ── */
  if (req.method === 'GET') {
    try {
      // Générer des notifications dynamiques basées sur l'état du compte
      const [userRows, txRows] = await Promise.all([
        supabaseRequest('GET', `/users?id=eq.${encodeURIComponent(userId)}&select=kyc_status,epargne,pending_deposit`).catch(() => []),
        supabaseRequest('GET', `/transactions?user_id=eq.${encodeURIComponent(userId)}&select=id,type,amount,statut,created_at&order=created_at.desc&limit=10`).catch(() => []),
      ]);

      const user = Array.isArray(userRows) ? userRows[0] : null;
      const txns = Array.isArray(txRows) ? txRows : [];

      const notifications = [];
      const now = new Date();

      // Notification KYC en attente
      if (user?.kyc_status === 'pending') {
        notifications.push({
          id: 'kyc-pending',
          title: 'Vérification KYC en cours',
          body: 'Votre demande de vérification d\'identité est en cours d\'examen. Délai : 24-48h.',
          read: false,
          date: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
          type: 'kyc',
        });
      }

      // Notification KYC vérifié
      if (user?.kyc_status === 'verified') {
        notifications.push({
          id: 'kyc-verified',
          title: '✅ Identité vérifiée',
          body: 'Votre compte est maintenant vérifié. Vous pouvez effectuer des dépôts illimités.',
          read: true,
          date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          type: 'kyc',
        });
      }

      // Transactions récentes validées
      txns.filter(t => t.statut === 'completed').slice(0, 3).forEach(t => {
        notifications.push({
          id: `tx-${t.id}`,
          title: '✅ Dépôt confirmé',
          body: `Votre dépôt de ${(t.amount || 0).toLocaleString('fr-FR')} GNF a été validé.`,
          read: true,
          date: t.created_at,
          type: 'transaction',
        });
      });

      // Dépôt en attente
      if (user?.pending_deposit) {
        try {
          const pd = JSON.parse(user.pending_deposit);
          if (pd?.amount > 0) {
            notifications.push({
              id: 'pending-deposit',
              title: '⏳ Dépôt en attente',
              body: `Votre dépôt de ${pd.amount.toLocaleString('fr-FR')} GNF est en attente de validation.`,
              read: false,
              date: pd.requestedAt || now.toISOString(),
              type: 'transaction',
            });
          }
        } catch {}
      }

      // Trier par date décroissante
      notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return res.status(200).json({ success: true, data: notifications });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non supportée' });
};
