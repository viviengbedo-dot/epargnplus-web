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

module.exports = { isProjectCollective, hasJoinedMembers, COLLECTIVE_PREFIX };
