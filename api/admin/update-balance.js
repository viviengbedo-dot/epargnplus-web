/**
 * POST /api/admin/update-balance — Epargn+
 * Valide ou rejette un dépôt.
 *
 * L'admin met à jour :
 *   - users.epargne  (incrémente du montant déposé)
 *   - transactions.statut → completed
 *   - users.pending_deposit → null
 *
 * La mise à jour de projects.actuel est gérée côté CLIENT
 * via /api/user/me?resource=projects (token utilisateur).
 */

const { supabaseRequest } = require('../_lib/supabase');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const auth  = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== ADMIN_SECRET) return res.status(401).json({ error: 'Non autorisé' });

  const body = await parseBody(req);
  const { userId, action, txnId } = body;

  /* ════════════ UPDATE-PROJECT (approbation/rejet suppression tontine) ════════════ */
  if (action === 'update-project') {
    const { projectId, status } = body;
    if (!projectId || !status) return res.status(400).json({ error: 'projectId et status requis' });
    const allowed = ['active','delete_rejected','closed'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'status invalide' });
    try {
      await supabaseRequest('PATCH',
        '/projects?id=eq.' + encodeURIComponent(projectId),
        { status });
      console.log('[ub] update-project projectId=' + projectId + ' status=' + status);
      return res.status(200).json({ ok: true, action: 'update-project', projectId, status });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur mise à jour projet : ' + err.message });
    }
  }

  /* ════════════ DELETE-ACCOUNT ════════════ */
  if (action === 'delete-account') {
    const { targetUserId, reason } = body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId requis' });
    try {
      /* Supprimer dans cet ordre : transactions → projets → utilisateur */
      try { await supabaseRequest('DELETE', '/transactions?user_id=eq.' + encodeURIComponent(targetUserId)); } catch(e) { console.warn('[delete-account] txns:', e.message); }
      try { await supabaseRequest('DELETE', '/projects?user_id=eq.'     + encodeURIComponent(targetUserId)); } catch(e) { console.warn('[delete-account] projects:', e.message); }
      await supabaseRequest('DELETE', '/users?id=eq.' + encodeURIComponent(targetUserId));
      console.log('[delete-account] user=' + targetUserId + ' reason=' + (reason || '—') + ' by admin');
      return res.status(200).json({ ok: true, action: 'delete-account', targetUserId });
    } catch (err) {
      return res.status(500).json({ error: 'Erreur suppression compte : ' + err.message });
    }
  }

  if (!userId || !action) return res.status(400).json({ error: 'userId et action requis' });

  try {
    const userRows = await supabaseRequest('GET',
      '/users?id=eq.' + encodeURIComponent(userId) +
      '&select=id,epargne,pending_deposit,operator');
    if (!Array.isArray(userRows) || userRows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    const user = userRows[0];

    /* ════════════ APPROVE ════════════ */
    if (action === 'approve') {
      /* Récupérer le montant */
      let depositAmount = parseInt(body.amount, 10) || 0;
      let projectId     = body.projectId || null;

      if (txnId) {
        try {
          const txRows = await supabaseRequest('GET',
            '/transactions?id=eq.' + encodeURIComponent(txnId) +
            '&select=amount,project_id');
          if (Array.isArray(txRows) && txRows[0]) {
            if (!depositAmount) depositAmount = Number(txRows[0].amount) || 0;
            if (!projectId)     projectId     = txRows[0].project_id   || null;
          }
        } catch (e) { console.warn('[ub] txn read:', e.message); }
      }

      if (user.pending_deposit) {
        try {
          const pd = JSON.parse(user.pending_deposit);
          if (!depositAmount) depositAmount = Number(pd.amount) || 0;
          if (!projectId && pd.projectId) projectId = pd.projectId;
        } catch {}
      }

      if (!depositAmount || depositAmount < 1) {
        return res.status(400).json({ error: 'Montant invalide' });
      }

      const now = new Date().toISOString();

      /* Marquer la transaction */
      if (txnId) {
        try {
          await supabaseRequest('PATCH',
            '/transactions?id=eq.' + encodeURIComponent(txnId),
            { statut: 'completed', status: 'success' });
        } catch (e) { console.warn('[ub] txn PATCH:', e.message); }
      } else {
        try {
          const ref = 'DEP-' + now.slice(0, 10).replace(/-/g, '') + '-' +
            Math.random().toString(36).substr(2, 6).toUpperCase();
          await supabaseRequest('POST', '/transactions', {
            user_id:    userId,
            type:       'deposit',
            amount:     depositAmount,
            is_credit:  true,
            statut:     'completed',
            status:     'success',
            label:      ref + ' · Dépôt validé admin',
            project_id: projectId,
            operator:   user.operator || 'Mobile Money',
          });
        } catch (e) { console.warn('[ub] legacy txn insert:', e.message); }
      }

      /* Incrémenter users.epargne (net après 2% frais service — silencieux) */
      const netForServer = Math.floor(depositAmount * 0.98);   /* 2% retenus côté plateforme */
      const newEpargne   = (Number(user.epargne) || 0) + netForServer;
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { epargne: newEpargne, pending_deposit: null });

      console.log('[ub] approved user=' + userId +
        ' deposit=' + depositAmount + ' epargne=' + newEpargne +
        (projectId ? ' projectId=' + projectId : ''));

      /* Retourner projectId et montant pour que le CLIENT mette à jour le projet */
      return res.status(200).json({
        ok:           true,
        action:       'approved',
        epargne:      newEpargne,
        depositAmount,
        projectId:    projectId || null,
      });

    /* ════════════ REJECT ════════════ */
    } else if (action === 'reject') {
      if (txnId) {
        try {
          await supabaseRequest('PATCH',
            '/transactions?id=eq.' + encodeURIComponent(txnId),
            { statut: 'failed', status: 'failed' });
        } catch (e) { console.warn('[ub] reject txn:', e.message); }
      }
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { pending_deposit: null });
      return res.status(200).json({ ok: true, action: 'rejected' });

    /* ════════════ SET ════════════ */
    } else if (action === 'set') {
      const setAmount = parseInt(body.amount, 10);
      if (isNaN(setAmount) || setAmount < 0) return res.status(400).json({ error: 'Montant invalide' });
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { epargne: setAmount, pending_deposit: null });
      return res.status(200).json({ ok: true, action: 'set', epargne: setAmount });

    } else {
      return res.status(400).json({ error: "action doit être 'approve', 'reject' ou 'set'" });
    }

  } catch (err) {
    console.error('[ub] Erreur:', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
