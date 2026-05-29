/**
 * GET /api/transactions/list — Epargn+
 * Retourne l'historique des transactions de l'utilisateur connecté.
 *
 * Headers requis : Authorization: Bearer <JWT_TOKEN>
 * Query params  : ?limit=50&type=depot|retrait
 */

const { supabaseRequest } = require('../_lib/supabase');
const { verifyJWT }       = require('../_lib/auth');

function extractToken(req) {
  const auth = (req.headers['authorization'] || '').trim();
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'GET uniquement' });

  const rawToken = extractToken(req);
  if (!rawToken) return res.status(401).json({ error: 'Non authentifié' });

  const jwtPayload = verifyJWT(rawToken);
  if (!jwtPayload) return res.status(401).json({ error: 'Session expirée' });

  const userId = jwtPayload.userId;
  const limit  = Math.min(parseInt(req.query?.limit || '100', 10), 200);
  const type   = req.query?.type || null;

  try {
    let query = `/transactions?user_id=eq.${encodeURIComponent(userId)}&select=id,type,amount,operator,project_id,statut,status,label,note,created_at&order=created_at.desc&limit=${limit}`;
    if (type) query += `&type=eq.${encodeURIComponent(type)}`;

    let transactions = [];
    try {
      transactions = await supabaseRequest('GET', query);
      if (!Array.isArray(transactions)) transactions = [];
    } catch (e) {
      console.warn('[transactions/list] fetch error:', e.message);
    }

    // Enrichir avec les noms de projets si project_id présent
    const projectIds = [...new Set(transactions.filter(t => t.project_id).map(t => t.project_id))];
    let projectMap = {};
    if (projectIds.length > 0) {
      try {
        const projects = await supabaseRequest('GET',
          `/projects?id=in.(${projectIds.map(id => `"${id}"`).join(',')})&select=id,name`);
        if (Array.isArray(projects)) {
          projects.forEach(p => { projectMap[p.id] = p.name; });
        }
      } catch (e) {}
    }

    // Normaliser le format pour le front
    const normalized = transactions.map(t => ({
      id:          t.id,
      type:        t.type === 'depot' ? 'deposit' : t.type === 'retrait' ? 'withdrawal' : t.type,
      amount:      t.amount || 0,
      operator:    t.operator || '',
      projectId:   t.project_id || null,
      projectName: t.project_id ? (projectMap[t.project_id] || null) : null,
      status:      t.statut === 'completed' ? 'success' : t.statut === 'failed' ? 'failed' : 'pending',
      label:       t.label || (t.type === 'depot' ? 'Dépôt' : 'Retrait'),
      date:        t.created_at,
      reference:   t.id,
      phone:       '',
    }));

    return res.status(200).json({ success: true, data: normalized });
  } catch (err) {
    console.error('[transactions/list] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
