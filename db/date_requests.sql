-- ═══════════════════════════════════════════════════════════════
-- Epargn+ — Demandes de modification de date de fin de projet
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.project_date_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL,
  user_id         uuid        NOT NULL,
  current_date    text        NOT NULL,   -- date actuelle (ISO ou durée ex: "2026-12")
  requested_date  text        NOT NULL,   -- nouvelle date demandée
  reason          text        NOT NULL,   -- justificatif obligatoire
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected')),
  admin_note      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_date_requests_project ON public.project_date_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_date_requests_user    ON public.project_date_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_date_requests_status  ON public.project_date_requests(status, created_at DESC);

ALTER TABLE public.project_date_requests ENABLE ROW LEVEL SECURITY;

SELECT 'project_date_requests OK' AS status;
