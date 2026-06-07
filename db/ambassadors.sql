-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Programme Ambassadeur
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Table principale des ambassadeurs ──
CREATE TABLE IF NOT EXISTS public.ambassadors (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL UNIQUE,
  status                text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','active','suspended','rejected')),
  tier                  text        NOT NULL DEFAULT 'silver'
                                    CHECK (tier IN ('silver','gold','platinum')),

  -- Candidature
  motivation            text,                        -- pourquoi l'utilisateur veut devenir ambassadeur
  whatsapp              text,                        -- numéro WhatsApp de contact
  experience            text,                        -- expérience en vente/recrutement

  -- Suivi (mis à jour par l'admin ou via cron)
  total_recruits        int         NOT NULL DEFAULT 0,   -- nb total de filleuls recrutés
  active_recruits       int         NOT NULL DEFAULT 0,   -- filleuls ayant fait >= 1 dépôt
  total_commission_paid bigint      NOT NULL DEFAULT 0,   -- commissions versées (en devise locale)

  -- Admin
  admin_note            text,
  approved_by           text,                        -- identifiant admin

  -- Dates
  applied_at            timestamptz NOT NULL DEFAULT now(),
  approved_at           timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON public.ambassadors(status, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_ambassadors_user   ON public.ambassadors(user_id);
CREATE INDEX IF NOT EXISTS idx_ambassadors_tier   ON public.ambassadors(tier, active_recruits DESC);

-- RLS deny-by-default (service_role bypass)
ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;

-- ── Colonne optionnelle sur users : réduction frais retrait pour Platine ──
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ambassador_tier text DEFAULT NULL;
-- (optionnel — la logique est gérée côté API en lisant la table ambassadors)

SELECT 'ambassadors OK' AS status;
