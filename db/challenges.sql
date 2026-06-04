-- ════════════════════════════════════════════════════════════════════
-- Epargn+ — Défis & Arène (Phase 3)
-- À exécuter dans Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  uuid,                              -- null = défi privé / duel
  kind          text NOT NULL DEFAULT 'community', -- community|private|duel
  name          text NOT NULL,
  goal          bigint NOT NULL DEFAULT 0,
  reward_points int NOT NULL DEFAULT 50,
  created_by    uuid,
  ends_at       timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenges_community ON public.challenges(community_id);

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id      uuid NOT NULL,
  progress     bigint NOT NULL DEFAULT 0,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chal_part_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_chal_part_user      ON public.challenge_participants(user_id);

ALTER TABLE public.challenges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

SELECT 'ok' AS status;
