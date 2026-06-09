-- ═══════════════════════════════════════════════════════════════
-- Epargn+ — Abonnements Push Notifications (Web Push API)
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  endpoint    text        NOT NULL UNIQUE,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  device_hint text,                          -- 'iOS', 'Android', 'Desktop'
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

SELECT 'push_subscriptions OK' AS status;
