/**
 * GET /api/admin/data — Epargn+ v4
 * Données réelles depuis Supabase pour le tableau de bord administrateur.
 * Retourne utilisateurs + transactions en attente + statistiques.
 *
 * Headers requis :
 *   Authorization: Bearer <ADMIN_SECRET>
 *
 * Retourne :
 *   { users[], pendingTransactions[], stats: { total, epargneTotal, kycPending, kycVerified, byCountry, pendingCount } }
 */

const { supabaseRequest } = require('../_lib/supabase');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });

  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    /* ── 1. Utilisateurs avec toutes les colonnes ── */
    let users;
    try {
      users = await supabaseRequest('GET',
        '/users?select=id,phone,country,prenom,nom,operator,epargne,pending_deposit,kyc_status,' +
        'kyc_document_url,kyc_selfie_url,kyc_doc_number,kyc_doc_type,kyc_submitted_at,' +
        'aml_status,risk_score,role,updated_at,created_at&order=created_at.desc&limit=500'
      );
    } catch (e) {
      try {
        users = await supabaseRequest('GET',
          '/users?select=id,phone,country,prenom,nom,operator,epargne,pending_deposit,kyc_status,role,updated_at,created_at&order=created_at.desc&limit=500'
        );
      } catch (e2) {
        users = await supabaseRequest('GET',
          '/users?select=id,phone,prenom,nom,epargne,kyc_status,role,created_at&order=created_at.desc&limit=500'
        );
      }
    }
    if (!Array.isArray(users)) return res.status(500).json({ error: 'Réponse Supabase inattendue' });

    /* ── 2. Transactions en attente (table transactions) ── */
    let pendingTransactions = [];
    try {
      pendingTransactions = await supabaseRequest('GET',
        '/transactions?statut=eq.pending&select=id,user_id,amount,operator,project_id,statut,status,label,created_at,validated_by,validated_at&order=created_at.desc&limit=200'
      );
      if (!Array.isArray(pendingTransactions)) pendingTransactions = [];
    } catch (txnErr) {
      console.warn('[admin/data] transactions table:', txnErr.message);
      /* La table n'existe pas encore — on utilisera pending_deposit sur users */
    }

    /* ── 2b. Toutes les transactions récentes (historique complet) ── */
    let allTransactions = [];
    try {
      allTransactions = await supabaseRequest('GET',
        '/transactions?select=id,user_id,type,amount,operator,project_id,statut,status,label,created_at&order=created_at.desc&limit=300'
      );
      if (!Array.isArray(allTransactions)) allTransactions = [];
    } catch (e) {
      /* Retry sans colonnes optionnelles */
      try {
        allTransactions = await supabaseRequest('GET',
          '/transactions?select=id,user_id,type,amount,operator,statut,status,created_at&order=created_at.desc&limit=300'
        );
        if (!Array.isArray(allTransactions)) allTransactions = [];
      } catch (e2) {
        console.warn('[admin/data] allTransactions:', e2.message);
      }
    }

    /* ── 3. Projets de tous les utilisateurs ── */
    let allProjects = [];
    try {
      allProjects = await supabaseRequest('GET',
        '/projects?select=id,user_id,name,goal,actuel,status,color,duree,created_at&order=created_at.desc&limit=500'
      );
      if (!Array.isArray(allProjects)) allProjects = [];
    } catch (projErr) {
      console.warn('[admin/data] projects table:', projErr.message);
    }

    /* ── 4. Statistiques ── */
    const total        = users.length;
    const epargneTotal = users.reduce((s, u) => s + (u.epargne || 0), 0);
    const kycPending   = users.filter(u => u.kyc_status === 'pending').length;
    const kycVerified  = users.filter(u => u.kyc_status === 'verified').length;
    const pendingCount = pendingTransactions.length ||
      users.filter(u => { try { const pd = JSON.parse(u.pending_deposit || 'null'); return pd && pd.amount > 0; } catch { return false; } }).length;
    const byCountry = { gn: 0, bj: 0, ci: 0, other: 0 };
    users.forEach(u => {
      const c = u.country || 'gn';
      if (c === 'gn') byCountry.gn++;
      else if (c === 'bj') byCountry.bj++;
      else if (c === 'ci') byCountry.ci++;
      else byCountry.other++;
    });

    return res.status(200).json({
      users,
      pendingTransactions,
      allTransactions,
      allProjects,
      stats: { total, epargneTotal, kycPending, kycVerified, pendingCount, byCountry },
    });
  } catch (err) {
    console.error('[admin/data] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
