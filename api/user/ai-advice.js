/**
 * GET /api/user/ai-advice?projectId=xxx — Epargn+
 * Génère des conseils IA basés sur les données réelles du projet.
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

  const userId    = jwtPayload.userId;
  const projectId = req.query?.projectId;

  if (!projectId) return res.status(400).json({ error: 'projectId requis' });

  try {
    // Charger le projet
    const projects = await supabaseRequest('GET',
      `/projects?id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,name,goal,actuel,status,duree,created_at`
    ).catch(() => []);

    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    const project = projects[0];
    const goal    = project.goal   || 0;
    const current = project.actuel || 0;
    const remaining = Math.max(0, goal - current);

    if (goal === 0) {
      return res.status(200).json({
        success: true,
        data: {
          completed: false,
          projectName: project.name,
          remaining: 0,
          goalAmount: 0,
          currentAmount: 0,
          scenarios: [],
          needsIncome: false,
        },
      });
    }

    if (current >= goal) {
      return res.status(200).json({
        success: true,
        data: {
          completed: true,
          projectName: project.name,
          goalAmount: goal,
          currentAmount: current,
        },
      });
    }

    // Calculer les scénarios (sans deadline)
    const scenarios = [
      { months: 3  },
      { months: 6  },
      { months: 12 },
      { months: 24 },
    ].map(({ months }) => {
      const monthlyDeposit = Math.ceil(remaining / months);
      const weeklyDeposit  = Math.ceil(remaining / (months * 4.33));
      return {
        months,
        monthlyDeposit,
        weeklyDeposit,
        affordabilityPct:  null,
        feasibilityLabel:  months <= 3 ? 'Ambitieux' : months <= 6 ? 'Réaliste' : 'Confortable',
        feasibilityColor:  months <= 3 ? '#ef4444'  : months <= 6 ? '#eab308'  : '#22c55e',
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        completed:    false,
        hasDeadline:  false,
        projectName:  project.name,
        remaining,
        goalAmount:   goal,
        currentAmount: current,
        scenarios,
        needsIncome:  false,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
