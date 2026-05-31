/**
 * Cron Job: Envoie les emails en attente toutes les heures
 * GET /api/cron/send-pending-emails?secret=CRON_SECRET
 *
 * Gère :
 * - deposit_approved : dépôts approuvés
 * - withdrawal_approved : retraits approuvés
 * - goal_reached : objectifs atteints 100%
 * - milestone_reached : milestones (25%, 50%, 75%)
 * - inactivity_reminder : inactivité 7j et 14j
 * - member_joined : nouveau membre accepté invitation
 */

const { supabaseRequest } = require('../_lib/supabase');

async function sendEmailViaAPI(userId, templateType, variables) {
  try {
    const response = await fetch(process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/email/send`
      : 'http://localhost:3000/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        template_type: templateType,
        variables: variables,
      }),
    });
    return response.ok;
  } catch (e) {
    console.error('[send-pending-emails] sendEmailViaAPI failed:', e.message);
    return false;
  }
}

async function handleDepositApproved() {
  try {
    // Récupérer les transactions qui viennent d'être approuvées (dernière heure)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const txns = await supabaseRequest('GET',
      `/transactions?statut=eq.completed&updated_at=gte.${encodeURIComponent(oneHourAgo)}&select=id,user_id,amount,project_id,is_credit`);

    if (!Array.isArray(txns)) return 0;

    let sent = 0;
    for (const txn of txns) {
      if (!txn.is_credit) continue; // Only deposits

      // Récupérer le projet
      const projs = await supabaseRequest('GET',
        `/projects?id=eq.${encodeURIComponent(txn.project_id)}&select=id,name,goal,actuel`);
      const proj = Array.isArray(projs) ? projs[0] : null;
      if (!proj) continue;

      // Récupérer l'utilisateur
      const users = await supabaseRequest('GET',
        `/users?id=eq.${encodeURIComponent(txn.user_id)}&select=id,currency`);
      const user = Array.isArray(users) ? users[0] : null;
      const currency = user?.currency || 'GNF';

      const progression = Math.round((proj.actuel / proj.goal) * 100);

      if (await sendEmailViaAPI(txn.user_id, 'deposit_approved', {
        montant: txn.amount,
        devise: currency,
        projet_nom: proj.name,
        progression: progression,
      })) {
        sent++;
      }
    }
    return sent;
  } catch (e) {
    console.error('[send-pending-emails] handleDepositApproved:', e.message);
    return 0;
  }
}

async function handleGoalReached() {
  try {
    // Récupérer les projets qui viennent d'atteindre 100% (dernière heure)
    const projects = await supabaseRequest('GET',
      `/projects?status=eq.active&select=id,user_id,name,goal,actuel,duree&limit=500`);

    if (!Array.isArray(projects)) return 0;

    let sent = 0;
    for (const proj of projects) {
      if ((proj.actuel || 0) >= (proj.goal || 0)) {
        // Vérifier qu'on a pas déjà envoyé un email pour ce projet
        const logs = await supabaseRequest('GET',
          `/email_logs?user_id=eq.${encodeURIComponent(proj.user_id)}&template_type=eq.goal_reached&project_id=eq.${encodeURIComponent(proj.id)}&limit=1`);

        if (Array.isArray(logs) && logs.length > 0) continue; // Déjà envoyé

        // Calculer la deadline
        let deadline = '—';
        if (proj.duree) {
          try {
            if (proj.duree.startsWith('m')) {
              const months = parseInt(proj.duree.slice(1), 10);
              const d = new Date();
              d.setMonth(d.getMonth() + months);
              deadline = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            }
          } catch {}
        }

        // Récupérer l'utilisateur pour la devise
        const users = await supabaseRequest('GET',
          `/users?id=eq.${encodeURIComponent(proj.user_id)}&select=id,currency`);
        const user = Array.isArray(users) ? users[0] : null;
        const currency = user?.currency || 'GNF';

        if (await sendEmailViaAPI(proj.user_id, 'goal_reached', {
          projet_nom: proj.name,
          montant: proj.goal,
          devise: currency,
          deadline: deadline,
        })) {
          sent++;
        }
      }
    }
    return sent;
  } catch (e) {
    console.error('[send-pending-emails] handleGoalReached:', e.message);
    return 0;
  }
}

async function handleMilestoneReached() {
  try {
    // Récupérer les projets avec milestones (25%, 50%, 75%)
    const projects = await supabaseRequest('GET',
      `/projects?status=eq.active&select=id,user_id,name,goal,actuel&limit=500`);

    if (!Array.isArray(projects)) return 0;

    let sent = 0;
    const milestones = [25, 50, 75];

    for (const proj of projects) {
      const progression = Math.round(((proj.actuel || 0) / (proj.goal || 1)) * 100);

      for (const ms of milestones) {
        if (progression >= ms) {
          // Vérifier qu'on a pas déjà envoyé un email pour ce milestone
          const logs = await supabaseRequest('GET',
            `/email_logs?user_id=eq.${encodeURIComponent(proj.user_id)}&template_type=eq.milestone_reached&variables->>'pourcentage'=eq.${ms}&limit=1`);

          if (Array.isArray(logs) && logs.length > 0) continue;

          const users = await supabaseRequest('GET',
            `/users?id=eq.${encodeURIComponent(proj.user_id)}&select=id,currency`);
          const user = Array.isArray(users) ? users[0] : null;
          const currency = user?.currency || 'GNF';

          if (await sendEmailViaAPI(proj.user_id, 'milestone_reached', {
            projet_nom: proj.name,
            pourcentage: ms,
            montant: Math.round((proj.goal * ms) / 100),
            objectif: proj.goal,
            devise: currency,
          })) {
            sent++;
          }
        }
      }
    }
    return sent;
  } catch (e) {
    console.error('[send-pending-emails] handleMilestoneReached:', e.message);
    return 0;
  }
}

async function handleInactivityReminder() {
  try {
    // Utilisateurs sans dépôt depuis 7 et 14 jours
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

    // 7 jours
    const users7 = await supabaseRequest('GET',
      `/users?select=id,prenom&limit=500`);

    let sent = 0;
    if (Array.isArray(users7)) {
      for (const user of users7) {
        const txns = await supabaseRequest('GET',
          `/transactions?user_id=eq.${encodeURIComponent(user.id)}&is_credit=eq.true&created_at=gte.${encodeURIComponent(oneWeekAgo)}&limit=1`);

        if (!Array.isArray(txns) || txns.length === 0) {
          // Pas de dépôt depuis 7 jours - envoyer reminder
          const logs = await supabaseRequest('GET',
            `/email_logs?user_id=eq.${encodeURIComponent(user.id)}&template_type=eq.inactivity_reminder&created_at=gte.${encodeURIComponent(oneWeekAgo)}&limit=1`);

          if (!Array.isArray(logs) || logs.length === 0) {
            if (await sendEmailViaAPI(user.id, 'inactivity_reminder', {
              jours: 7,
              projets: 'Vos projets en attente',
            })) {
              sent++;
            }
          }
        }
      }
    }

    return sent;
  } catch (e) {
    console.error('[send-pending-emails] handleInactivityReminder:', e.message);
    return 0;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Vérifier le secret cron
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stats = {
      deposit_approved: await handleDepositApproved(),
      goal_reached: await handleGoalReached(),
      milestone_reached: await handleMilestoneReached(),
      inactivity_reminder: await handleInactivityReminder(),
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json({
      ok: true,
      sent: stats.deposit_approved + stats.goal_reached + stats.milestone_reached + stats.inactivity_reminder,
      stats: stats,
    });
  } catch (e) {
    console.error('[send-pending-emails] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
