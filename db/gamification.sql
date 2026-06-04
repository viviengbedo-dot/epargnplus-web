-- ════════════════════════════════════════════════════════════════════
-- Epargn+ — Gamification (Phase 2) : points, fil d'activité
-- À exécuter dans Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- Points globaux de l'utilisateur (ligues)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS points int NOT NULL DEFAULT 0;

-- Fil d'activité des communautés
CREATE TABLE IF NOT EXISTS public.community_activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL,
  user_id      uuid,
  type         text NOT NULL DEFAULT 'deposit',  -- deposit|goal|join
  text         text NOT NULL,
  points       int  NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_activity_community ON public.community_activity(community_id, created_at DESC);

ALTER TABLE public.community_activity ENABLE ROW LEVEL SECURITY;

SELECT 'ok' AS status;
