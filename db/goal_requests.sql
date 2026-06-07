-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Demandes de modification d'objectif de projet (hausse uniquement)
-- Version robuste — idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Table (sans contrainte CHECK en ligne pour éviter les conflits) ──
CREATE TABLE IF NOT EXISTS public.project_goal_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL,
  user_id         uuid        NOT NULL,
  current_goal    bigint      NOT NULL,
  requested_goal  bigint      NOT NULL,
  reason          text,
  status          text        NOT NULL DEFAULT 'pending',
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Contrainte statut (idempotente) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'project_goal_requests'
      AND constraint_name = 'project_goal_requests_status_check'
  ) THEN
    ALTER TABLE public.project_goal_requests
      ADD CONSTRAINT project_goal_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ── 3. Contrainte hausse uniquement (idempotente) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'project_goal_requests'
      AND constraint_name = 'goal_must_increase'
  ) THEN
    ALTER TABLE public.project_goal_requests
      ADD CONSTRAINT goal_must_increase
      CHECK (requested_goal > current_goal);
  END IF;
END $$;

-- ── 4. Index ──
CREATE INDEX IF NOT EXISTS idx_goal_requests_project
  ON public.project_goal_requests(project_id, status);

CREATE INDEX IF NOT EXISTS idx_goal_requests_user
  ON public.project_goal_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goal_requests_status
  ON public.project_goal_requests(status, created_at DESC);

-- ── 5. RLS ──
ALTER TABLE public.project_goal_requests ENABLE ROW LEVEL SECURITY;

-- ── Vérification finale ──
SELECT
  tablename,
  rowsecurity AS rls_active
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename  = 'project_goal_requests';
