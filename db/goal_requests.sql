-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Demandes de modification d'objectif de projet (hausse uniquement)
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.project_goal_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL,
  user_id         uuid        NOT NULL,
  current_goal    bigint      NOT NULL,          -- objectif avant modification
  requested_goal  bigint      NOT NULL,          -- nouvel objectif demandé (> current_goal)
  reason          text,                          -- raison fournie par l'utilisateur (optionnel)
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected')),
  admin_note      text,                          -- note de l'admin lors de l'approbation/refus
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Contrainte : le nouvel objectif doit être supérieur à l'actuel
  CONSTRAINT goal_must_increase CHECK (requested_goal > current_goal)
);

-- Index pour chercher rapidement les demandes pending d'un projet / d'un user
CREATE INDEX IF NOT EXISTS idx_goal_requests_project  ON public.project_goal_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_goal_requests_user     ON public.project_goal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_requests_status   ON public.project_goal_requests(status, created_at DESC);

-- RLS activée — seul service_role (API) accède
ALTER TABLE public.project_goal_requests ENABLE ROW LEVEL SECURITY;

-- Vérification
SELECT 'project_goal_requests OK' AS status;
