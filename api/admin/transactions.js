/**
 * GET /api/admin/transactions — Epargn+
 * Retourne TOUTES les transactions (pas seulement pending).
 * Supporte ?limit=200&offset=0&statut=pending|completed|failed
 *
 * Headers requis : Authorization: Bearer <ADMIN_SECRET>
 */

const { supabaseRequest } = require('../_lib/supabase');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });

  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  try {
    const limit  = Math.min(parseInt(req.query?.limit  || '500', 10), 500);
    const offset = parseInt(req.query?.offset || '0', 10);
    const statut = req.query?.statut || null;

    let query = `/transactions?select=id,user_id,type,amount,operator,project_id,statut,status,label,note,created_at,validated_at&order=created_at.desc&limit=${limit}&offset=${offset}`;
    if (statut) query += `&statut=eq.${encodeURIComponent(statut)}`;

    let transactions = [];
    try {
      transactions = await supabaseRequest('GET', query);
      if (!Array.isArray(transactions)) transactions = [];
    } catch (e) {
      console.warn('[admin/transactions] fetch error:', e.message);
    }

    // Enrichir avec les infos utilisateur (phone)
    let users = [];
    try {
      users = await supabaseRequest('GET', '/users?select=id,phone,prenom,nom&limit=500');
      if (!Array.isArray(users)) users = [];
    } catch (e) {}

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    const enriched = transactions.map(t => {
      const u = userMap[t.user_id] || {};
      return {
        ...t,
        montant: t.amount || 0,   // alias pour compatibilité front
        userPhone: u.phone || t.user_id,
        userName: [u.prenom, u.nom].filter(Boolean).join(' ') || null,
      };
    });

    return res.status(200).json({ transactions: enriched, total: enriched.length });
  } catch (err) {
    console.error('[admin/transactions] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
