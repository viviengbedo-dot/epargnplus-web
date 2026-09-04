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
/**
 * Épargné réel d'UN projet, dérivé des transactions.
 * @param {object} project  ligne projet (id, status)
 * @param {Array}  txns     transactions (au moins {project_id,type,amount,statut,status})
 * @returns {number}
 */
function computeProjectSaved(project, txns) {
  if (!project) return 0;
  if (project.status === 'closed') return 0;   /* projet retiré → vidé */
  const pid = String(project.id);
  let sum = 0;
  for (const t of (txns || [])) {
    if (String(t.project_id) !== pid) continue;
    if (_isDeposit(t) && _txCompleted(t)) sum += Number(t.amount) || 0;
  }
  return sum;
}

module.exports = { isProjectCollective, hasJoinedMembers, COLLECTIVE_PREFIX, computeProjectSaved };
