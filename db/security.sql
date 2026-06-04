-- ════════════════════════════════════════════════════════════════
-- Epargn+ — Renforcement sécurité (à exécuter dans Supabase → SQL)
-- Idempotent : ré-exécutable sans danger.
--   1. Tables auth_throttle + audit_log
--   2. RLS activé (deny-by-default) sur TOUTES les tables applicatives
-- Note : l'API serverless utilise la clé service_role qui CONTOURNE la RLS.
--        Activer la RLS = défense en profondeur : bloque tout accès direct
--        anon/authenticated (clé publique) tant qu'aucune policy ne l'ouvre.
-- ════════════════════════════════════════════════════════════════

-- ── 1a. Anti brute-force : compteur de tentatives ──
CREATE TABLE IF NOT EXISTS public.auth_throttle (
  key           text PRIMARY KEY,              -- ex: 'login:+224620000000' | 'otp_send:+224...'
  attempts      int  NOT NULL DEFAULT 0,
  window_start  timestamptz NOT NULL DEFAULT now(),
  locked_until  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 1b. Journal d'audit (auth, retraits, solde, suppression…) ──
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,
  action      text NOT NULL,                   -- login_success | login_fail | withdrawal_request | ...
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log (action, created_at DESC);

-- ── 1c. Registre des appareils connus (alerte nouvel appareil) ──
CREATE TABLE IF NOT EXISTS public.user_devices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  device_id   text NOT NULL,
  label       text,
  last_seen   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

-- ── 2. RLS deny-by-default sur toutes les tables applicatives ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','projects','transactions','notifications','project_invitations',
    'project_members','communities','community_members','community_activity',
    'challenges','challenge_participants','settings','support_tickets',
    'ticket_replies','broadcasts','email_campaigns','email_logs','promo_codes',
    'promo_uses','surplus_log','auth_throttle','audit_log','user_devices'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name=t) THEN
      -- ENABLE suffit : service_role (clé API) a BYPASSRLS et continue de fonctionner ;
      -- anon/authenticated (clé publique) sont bloqués faute de policy.
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END IF;
  END LOOP;
END $$;

-- ── 2b. Bucket PRIVÉ pour les pièces KYC (PII jamais en clair en DB) ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc', 'kyc', false)
ON CONFLICT (id) DO UPDATE SET public = false;
-- Aucune policy publique → seul service_role (API) lit/écrit ; l'admin obtient
-- des URLs signées temporaires (10 min) générées côté serveur.

-- ── 3. Vérification : tables publiques SANS RLS (doit renvoyer 0 ligne) ──
-- SELECT tablename FROM pg_tables t
--   JOIN pg_class c ON c.relname = t.tablename
--  WHERE t.schemaname='public' AND c.relrowsecurity = false;
