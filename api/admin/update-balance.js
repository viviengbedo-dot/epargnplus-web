/**
 * POST /api/admin/update-balance — Epargn+
 * Valide ou rejette un dépôt en attente et met à jour le solde.
 * Seul l'admin peut appeler cet endpoint.
 *
 * Headers : Authorization: Bearer <ADMIN_SECRET>
 * Corps   : { userId, amount?, txnId?, action: 'approve' | 'reject' | 'set' }
 *
 * Logique approve :
 *   1. Met à jour transactions.statut = 'completed' (si txnId fourni)
 *   2. Incrémente users.epargne
 *   3. Efface pending_deposit sur l'utilisateur
 *   4. Met à jour projects.current si project_id lié à la transaction
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

  const body   = await parseBody(req);
  const { userId, action, txnId } = body;

  if (!userId || !action) {
    return res.status(400).json({ error: 'userId et action requis' });
  }

  try {
    const rows = await supabaseRequest('GET',
      '/users?id=eq.' + encodeURIComponent(userId) + '&select=id,epargne,pending_deposit');
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    const user = rows[0];

    /* ── APPROVE ── */
    if (action === 'approve') {
      let depositAmount = parseInt(body.amount, 10);
      let projectId = null;

      /* Lire le montant et project_id depuis la table transactions si txnId fourni */
      if (txnId) {
        try {
          const txnRows = await supabaseRequest('GET',
            '/transactions?id=eq.' + encodeURIComponent(txnId) + '&select=amount,project_id');
          if (Array.isArray(txnRows) && txnRows[0]) {
            if (!depositAmount) depositAmount = txnRows[0].amount;
            projectId = txnRows[0].project_id || null;
          }
        } catch (e) {
          console.warn('[update-balance] lecture txn :', e.message);
        }
      }

      /* Fallback sur pending_deposit si montant toujours inconnu */
      if (!depositAmount && user.pending_deposit) {
        try {
          const pd = JSON.parse(user.pending_deposit);
          depositAmount = pd.amount || 0;
        } catch {}
      }

      if (!depositAmount || depositAmount < 1) {
        return res.status(400).json({ error: 'Montant invalide' });
      }

      const now        = new Date().toISOString();
      const newEpargne = (user.epargne || 0) + depositAmount;

      /* 1. Mettre à jour la transaction si txnId connu */
      if (txnId) {
        try {
          await supabaseRequest('PATCH',
            '/transactions?id=eq.' + encodeURIComponent(txnId),
            { statut: 'completed', status: 'success', validated_at: now });
        } catch (e) {
          console.warn('[update-balance] transactions PATCH :', e.message);
        }
      }

      /* 2. Mettre à jour le solde utilisateur + effacer pending */
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { epargne: newEpargne, pending_deposit: null, updated_at: now }
      );

      /* 3. Mettre à jour le projet lié si présent */
      if (projectId) {
        try {
          const projRows = await supabaseRequest('GET',
            '/projects?id=eq.' + encodeURIComponent(projectId) + '&select=id,actuel');
          if (Array.isArray(projRows) && projRows[0]) {
            const newCurrent = (projRows[0].actuel || 0) + depositAmount;
            await supabaseRequest('PATCH',
              '/projects?id=eq.' + encodeURIComponent(projectId),
              { actuel: newCurrent, updated_at: now });
          }
        } catch (e) {
          console.warn('[update-balance] project update :', e.message);
        }
      }

      console.log('[update-balance] approved userId=' + userId + ' +' + depositAmount + ' → ' + newEpargne + (projectId ? ' proj=' + projectId : ''));
      return res.status(200).json({ ok: true, action: 'approved', epargne: newEpargne });

    /* ── REJECT ── */
    } else if (action === 'reject') {
      const now = new Date().toISOString();

      if (txnId) {
        try {
          await supabaseRequest('PATCH',
            '/transactions?id=eq.' + encodeURIComponent(txnId),
            { statut: 'failed', validated_at: now });
        } catch (e) {
          console.warn('[update-balance] reject txn :', e.message);
        }
      }

      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { pending_deposit: null, updated_at: now }
      );
      console.log('[update-balance] rejected userId=' + userId);
      return res.status(200).json({ ok: true, action: 'rejected' });

    /* ── SET (correction manuelle) ── */
    } else if (action === 'set') {
      const setAmount = parseInt(body.amount, 10);
      if (isNaN(setAmount) || setAmount < 0) {
        return res.status(400).json({ error: 'Montant invalide' });
      }
      await supabaseRequest('PATCH',
        '/users?id=eq.' + encodeURIComponent(userId),
        { epargne: setAmount, pending_deposit: null, updated_at: new Date().toISOString() }
      );
      console.log('[update-balance] set userId=' + userId + ' → ' + setAmount);
      return res.status(200).json({ ok: true, action: 'set', epargne: setAmount });

    } else {
      return res.status(400).json({ error: "action doit être 'approve', 'reject' ou 'set'" });
    }

  } catch (err) {
    console.error('[update-balance] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur : ' + err.message });
  }
};
