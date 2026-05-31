-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Migration Contributions v10
-- Système de contributions flexibles : libre / cap minimal / parts égales
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ajouter colonnes pour type de contribution ────────────────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS contribution_type VARCHAR(20)
  DEFAULT 'free'
  CHECK (contribution_type IN ('free', 'minimal_cap', 'equal_share'));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS min_contribution_amount NUMERIC(15,2) DEFAULT 0;

-- ── 2. Identifier les projets collectifs (members_count > 1) ──────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_tontine BOOLEAN GENERATED ALWAYS AS (members_count > 1) STORED;

-- ── 3. Index pour recherches rapides ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_contribution_type
  ON projects(contribution_type, user_id);

CREATE INDEX IF NOT EXISTS idx_projects_is_tontine_type
  ON projects(is_tontine, contribution_type);

-- ── 3. Fonction pour valider contribution selon type ─────────────────────────

CREATE OR REPLACE FUNCTION validate_contribution(
  p_project_id UUID,
  p_amount NUMERIC(15,2)
)
RETURNS JSON AS $$
DECLARE
  v_proj RECORD;
  v_share_per_person NUMERIC(15,2);
BEGIN
  SELECT
    contribution_type,
    goal,
    nb_membres_cible,
    min_contribution_amount
  INTO v_proj
  FROM projects
  WHERE id = p_project_id;

  IF v_proj IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Projet non trouvé');
  END IF;

  -- Mode libre : aucune restriction
  IF v_proj.contribution_type = 'free' THEN
    RETURN json_build_object('ok', true);
  END IF;

  -- Mode cap minimal
  IF v_proj.contribution_type = 'minimal_cap' THEN
    IF p_amount < v_proj.min_contribution_amount THEN
      RETURN json_build_object(
        'ok', false,
        'error', 'Contribution minimale requise: ' || v_proj.min_contribution_amount
      );
    END IF;
    RETURN json_build_object('ok', true);
  END IF;

  -- Mode parts égales
  IF v_proj.contribution_type = 'equal_share' THEN
    v_share_per_person := v_proj.goal / NULLIF(v_proj.nb_membres_cible, 0);
    IF p_amount != v_share_per_person THEN
      RETURN json_build_object(
        'ok', false,
        'error', 'Contribution obligatoire: ' || v_share_per_person,
        'required_amount', v_share_per_person
      );
    END IF;
    RETURN json_build_object('ok', true);
  END IF;

  RETURN json_build_object('ok', false, 'error', 'Type contribution inconnu');
END;
$$ LANGUAGE plpgsql;

-- ── 4. Vue : stats contributions par type ────────────────────────────────────

CREATE OR REPLACE VIEW v_contributions_stats AS
SELECT
  contribution_type,
  COUNT(*) AS nb_projets,
  COUNT(*) FILTER (WHERE status = 'active') AS actifs,
  COUNT(*) FILTER (WHERE is_tontine = TRUE) AS collectifs
FROM projects
GROUP BY contribution_type;

DO $$ BEGIN
  RAISE NOTICE '✅ Migration v10 terminée — système contributions flexible activé';
END $$;
