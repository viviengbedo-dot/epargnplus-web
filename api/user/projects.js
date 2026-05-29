/**
 * GET  /api/user/projects — liste les projets de l'utilisateur
 * POST /api/user/projects — crée un nouveau projet
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawToken = extractToken(req);
  if (!rawToken) return res.status(401).json({ error: 'Non authentifié' });
  const jwtPayload = verifyJWT(rawToken);
  if (!jwtPayload) return res.status(401).json({ error: 'Session expirée' });

  const userId = jwtPayload.userId;

  /* ── GET : liste des projets ── */
  if (req.method === 'GET') {
    try {
      const projects = await supabaseRequest('GET',
        `/projects?user_id=eq.${encodeURIComponent(userId)}&select=id,name,goal,actuel,status,color,duree,created_at&order=created_at.desc`
      );

      if (!Array.isArray(projects)) return res.status(200).json({ success: true, data: [] });

      const normalized = projects.map(p => ({
        id:            p.id,
        name:          p.name,
        icon:          p.color || '🎯',
        currentAmount: p.actuel || 0,       // alias front
        goalAmount:    p.goal   || 0,       // alias front
        status:        p.status || 'ACTIVE',
        deadline:      null,
        createdAt:     p.created_at,
      }));

      return res.status(200).json({ success: true, data: normalized });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /* ── POST : créer un projet ── */
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const name = (body.name || '').trim();
    const goal = parseInt(body.goal || body.goal_amount || body.goalAmount, 10);

    if (!name) return res.status(400).json({ error: 'Nom du projet requis' });
    if (!goal || goal < 1000) return res.status(400).json({ error: 'Objectif minimum : 1 000 GNF' });

    try {
      const rows = await supabaseRequest('POST', '/projects', {
        user_id:    userId,
        name,
        goal,
        actuel:     0,
        status:     'ACTIVE',
        color:      body.icon || '🎯',
        created_at: new Date().toISOString(),
      });
      const created = Array.isArray(rows) ? rows[0] : rows;
      return res.status(201).json({
        success: true,
        data: {
          id:            created.id,
          name:          created.name,
          icon:          created.color || '🎯',
          currentAmount: 0,
          goalAmount:    created.goal,
          status:        'ACTIVE',
          deadline:      null,
          createdAt:     created.created_at,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Méthode non supportée' });
};
