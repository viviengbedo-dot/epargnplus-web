-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Migration Invitations v9
-- Ajout colonnes pour suivi des invitations (viewed_at, rejection_reason)
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ajouter colonnes manquantes à project_invitations ────────────────────

ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ── 2. Ajouter colonne invite_active à projects ─────────────────────────────

ALTER TABLE projects ADD COLUMN IF NOT EXISTS invite_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ── 3. Index pour les recherches rapides ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invitations_inviter_project
  ON project_invitations(inviter_id, project_id)
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_invitations_status_created
  ON project_invitations(status, created_at DESC);

-- ── 4. Fonction pour marquer une invitation comme "vue" ─────────────────────

CREATE OR REPLACE FUNCTION mark_invitation_viewed(invitation_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE project_invitations
  SET viewed_at = NOW()
  WHERE id = invitation_id AND viewed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ── 5. RLS Policy pour invitations_sent (inviteur voit ses propres envois) ───

CREATE POLICY "Users can view invitations they sent" ON project_invitations
  FOR SELECT
  TO authenticated
  USING (inviter_id = auth.uid());

CREATE POLICY "Users can update own sent invitations (resend/revoke)" ON project_invitations
  FOR UPDATE
  TO authenticated
  USING (inviter_id = auth.uid())
  WITH CHECK (inviter_id = auth.uid());

DO $$ BEGIN
  RAISE NOTICE '✅ Migration v9 terminée — colonnes et index ajoutés';
END $$;
