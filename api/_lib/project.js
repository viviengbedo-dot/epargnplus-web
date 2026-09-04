/**
 * Epargn+ — Logique partagée des projets
 *
 * SOURCE DE VÉRITÉ UNIQUE pour déterminer si un projet est collectif.
 * Utilisée par TOUS les endpoints + le frontend (copie identique).
 *
 * Un projet est COLLECTIF si l'un de ces signaux est vrai :
 *   - il possède un invite_code (généré uniquement à la création collective)
 *   - il possède un invite_token
 *   - son nom commence par 🤝 (convention historique)
 *   - il a plus d'un membre (members_count > 1)
 */

/* Préfixe emoji utilisé pour les projets collectifs */
const COLLECTIVE_PREFIX = '🤝';

/**
 * @param {object} p - ligne projet (doit contenir name, invite_code, invite_token, members_count)
 * @returns {boolean}
 */
function isProjectCollective(p) {
  if (!p) return false;
  return !!(
    p.invite_code ||
    p.invite_token ||
    String(p.name || '').startsWith(COLLECTIVE_PREFIX) ||
    (Number(p.members_count) > 1)
  );
}

/**
 * Un projet collectif a-t-il des membres ayant rejoint (au-delà du créateur) ?
 * @param {object} p
 * @returns {boolean}
 */
function hasJoinedMembers(p) {
  return Number(p && p.members_count) > 1;
}

/* ── SOURCE DE VÉRITÉ UNIQUE DES SOLDES ──────────────────────────────────
   L'épargné d'un projet = Σ des DÉPÔTS VALIDÉS de ce projet.
   Un projet clôturé (retiré) = 0. Client ET admin calculent AINSI, à partir
   du grand livre des transactions → plus de dérive, plus de « cohérence soldes ».
   (Le retrait vide le projet puis le passe à status=closed.) */
function _txCompleted(t) {
  const a = t && (t.statut || t.status || '');
  return a === 'completed' || a === 'success';
}
function _isDeposit(t) {
  const ty = t && t.type;
  return ty === 'deposit' || ty === 'depot';
}
function _isWithdrawal(t) {
  const ty = t && t.type;
  return ty === 'withdrawal' || ty === 'retrait' || ty === 'retrait_projet_collectif';
}
/**
 * Épargné réel d'UN projet, dérivé du grand livre = Σ dépôts validés − retraits.
 * On NE se base PAS sur project.status (peu fiable : un projet peut être 'closed'
 * sans retrait — ex. clôture collective dont les refunds ont échoué). Un retrait
 * COMPLÉTÉ vide le projet ; un retrait en attente diminue le solde disponible.
 * @param {object} project  ligne projet (id)
 * @param {Array}  txns     transactions {project_id,type,amount,statut,status}
 * @returns {number}
 */
function computeProjectSaved(project, txns) {
  if (!project) return 0;
  const pid = String(project.id);
  let dep = 0, wdDone = 0, wdPending = 0;
  for (const t of (txns || [])) {
    if (String(t.project_id) !== pid) continue;
    const amt = Number(t.amount) || 0;
    if (_isDeposit(t) && _txCompleted(t)) { dep += amt; continue; }
    if (_isWithdrawal(t)) {
      const st = (t.statut || t.status || '');
      if (st === 'failed' || st === 'cancelled') continue;
      if (st === 'pending') wdPending += amt; else wdDone += amt;
    }
  }
  if (wdDone > 0) return 0;                 /* projet encaissé → vidé */
  return Math.max(0, dep - wdPending);
}

module.exports = { isProjectCollective, hasJoinedMembers, COLLECTIVE_PREFIX, computeProjectSaved };
