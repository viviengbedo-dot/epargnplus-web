-- ═══════════════════════════════════════════════════════════════
-- Epargn+ — Offres de réalisation anticipée Koutouki (à 60%)
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.koutouki_offers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid        NOT NULL,
  user_id         uuid        NOT NULL,
  service_type    text        NOT NULL
                              CHECK (service_type IN ('immo','travel','express')),
  instructions    text,                          -- instructions laissées par le client
  budget_at_offer bigint      NOT NULL DEFAULT 0, -- montant épargné au moment de l'offre
  goal            bigint      NOT NULL DEFAULT 0, -- objectif total
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','reviewing','confirmed','in_progress','completed','cancelled')),
  admin_note      text,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_koutouki_offers_project ON public.koutouki_offers(project_id);
CREATE INDEX IF NOT EXISTS idx_koutouki_offers_user    ON public.koutouki_offers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_koutouki_offers_status  ON public.koutouki_offers(status, created_at DESC);

ALTER TABLE public.koutouki_offers ENABLE ROW LEVEL SECURITY;

-- Colonne sur projects pour savoir si une offre a déjà été déclenchée (évite le spam)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS koutouki_offer_triggered boolean DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS koutouki_offer_id uuid DEFAULT NULL;

SELECT 'koutouki_offers OK' AS status;
