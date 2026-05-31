/**
 * Cron Job: Notifie le créateur quand un membre accepte l'invitation
 * GET /api/cron/notify-members?secret=CRON_SECRET
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
    console.error('[notify-members] sendEmailViaAPI failed:', e.message);
    return false;
  }
}

async function handleMemberJoined() {
  try {
    // Récupérer les invitations acceptées dernière heure
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const invitations = await supabaseRequest('GET',
      `/project_invitations?status=eq.accepted&responded_at=gte.${encodeURIComponent(oneHourAgo)}&select=id,project_id,inviter_id,invitee_user_id`);

    if (!Array.isArray(invitations)) return 0;

    let sent = 0;
    for (const inv of invitations) {
      // Vérifier qu'on a pas déjà notifié l'inviteur
      const logs = await supabaseRequest('GET',
        `/email_logs?user_id=eq.${encodeURIComponent(inv.inviter_id)}&template_type=eq.member_joined&variables->>'invitation_id'=eq.${encodeURIComponent(inv.id)}&limit=1`);

      if (Array.isArray(logs) && logs.length > 0) continue; // Déjà notifié

      // Récupérer le nouveau membre
      const members = await supabaseRequest('GET',
        `/users?id=eq.${encodeURIComponent(inv.invitee_user_id)}&select=id,prenom`);
      const member = Array.isArray(members) ? members[0] : null;
      if (!member) continue;

      // Récupérer le projet
      const projects = await supabaseRequest('GET',
        `/projects?id=eq.${encodeURIComponent(inv.project_id)}&select=id,name,members_count`);
      const project = Array.isArray(projects) ? projects[0] : null;
      if (!project) continue;

      if (await sendEmailViaAPI(inv.inviter_id, 'member_joined', {
        new_member_name: member.prenom || 'Un membre',
        projet_nom: project.name,
        nb_membres: project.members_count || 2,
        invitation_id: inv.id,
      })) {
        sent++;
      }
    }
    return sent;
  } catch (e) {
    console.error('[notify-members] handleMemberJoined:', e.message);
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
    const sent = await handleMemberJoined();

    return res.status(200).json({
      ok: true,
      sent: sent,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[notify-members] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
