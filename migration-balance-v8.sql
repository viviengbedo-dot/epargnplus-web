-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Migration Balance v8
-- Cohérence soldes, protection projets, gestion excédents
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Contrainte goal >= actuel sur projects ────────────────────────────────
-- (protège la DB contre les incohérences via UPDATE direct)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_actuel_le_goal' AND conrelid = 'projects'::regclass
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_actuel_le_goal
      CHECK (actuel <= goal);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Contrainte projects_actuel_le_goal non ajoutée (données existantes invalides ou contrainte déjà présente) : %', SQLERRM;
END $$;

-- ── 2. Colonne has_funds : indique si un projet a reçu des dépôts ────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_funds BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 3. Mettre à jour has_funds pour les projets existants ───────────────────

UPDATE projects p
SET has_funds = TRUE
WHERE actuel > 0
  AND NOT has_funds;

-- Également marquer si des transactions approved existent pour ce projet
UPDATE projects p
SET has_funds = TRUE
WHERE EXISTS (
  SELECT 1 FROM transactions t
  WHERE t.project_id = p.id
    AND t.statut IN ('completed', 'success', 'approved')
    AND t.is_credit = TRUE
)
AND NOT has_funds;

-- ── 4. Table surplus_log : traçabilité des réattributions ──────────────────

CREATE TABLE IF NOT EXISTS surplus_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  surplus_amount  NUMERIC(15,2) NOT NULL,
  injected_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  remaining       NUMERIC(15,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'auto'
                  CHECK (status IN ('auto','manual','pending','skipped')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surplus_log_user ON surplus_log(user_id);
CREATE INDEX IF NOT EXISTS idx_surplus_log_project ON surplus_log(project_id);

-- ── 5. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE surplus_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='surplus_log' AND policyname='block anon surplus_log'
  ) THEN
    CREATE POLICY "block anon surplus_log" ON surplus_log FOR ALL TO anon USING (false);
  END IF;
END $$;

-- ── 6. Index performance ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_project_credit
  ON transactions(project_id, is_credit, statut);

CREATE INDEX IF NOT EXISTS idx_projects_user_active
  ON projects(user_id, status);

-- ── 7. Vue cohérence : utilisateurs avec excédent ─────────────────────────

CREATE OR REPLACE VIEW v_balance_coherence AS
SELECT
  u.id                                   AS user_id,
  u.phone,
  u.prenom,
  u.epargne                              AS solde_actuel,
  COALESCE(SUM(p.goal - p.actuel), 0)   AS capacite_restante,
  u.epargne - COALESCE(SUM(p.goal - p.actuel), 0) AS excedent,
  COUNT(p.id)                            AS nb_projets_actifs
FROM users u
LEFT JOIN projects p ON p.user_id = u.id AND p.status = 'active'
GROUP BY u.id, u.phone, u.prenom, u.epargne
HAVING u.epargne > COALESCE(SUM(p.goal - p.actuel), 0);

-- ── 8. Script de recalcul pour comptes existants ──────────────────────────
-- À exécuter manuellement après validation métier

-- Prévisualisation des comptes concernés :
-- SELECT * FROM v_balance_coherence ORDER BY excedent DESC LIMIT 50;

-- Recalcul actuel des projets depuis les transactions :
UPDATE projects p
SET actuel = COALESCE((
  SELECT SUM(t.amount)
  FROM transactions t
  WHERE t.project_id = p.id
    AND t.statut IN ('completed', 'success')
    AND t.is_credit = TRUE
), 0)
WHERE status = 'active';

-- Mettre à jour has_funds après recalcul :
UPDATE projects SET has_funds = (actuel > 0);

RAISE NOTICE '✅ Migration v8 terminée — projets recalculés, contraintes ajoutées';
