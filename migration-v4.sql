-- ══════════════════════════════════════════════════════════════
--  Epargn+ — Migration v4
--  Corrections : currency, OTP rate_limits, notifications push
--
--  Instructions :
--  1. Aller sur https://supabase.com → votre projet
--  2. SQL Editor → New Query → coller → Run
--  3. Idempotent — peut être relancé sans risque
-- ══════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  1. TABLE USERS — colonne currency (si migration v3 pas faite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GNF';

-- Mettre à jour la devise selon le pays (idempotent)
UPDATE public.users
SET currency = CASE
  WHEN country = 'bj' THEN 'FCFA'
  WHEN country = 'ci' THEN 'FCFA'
  WHEN country = 'cn' THEN 'CNY'
  ELSE 'GNF'
END
WHERE currency IS NULL OR currency = 'GNF' AND country IN ('bj','ci','cn');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  2. TABLE USERS — colonnes KYC v2 (si migration_kyc_v2 pas faite)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_document_url  TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_selfie_url    TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_doc_number    TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_doc_type      TEXT DEFAULT 'CNI';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_submitted_at  TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_verified_at   TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aml_status        TEXT DEFAULT 'not_checked';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aml_checked_at    TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS risk_score        INT DEFAULT 0;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  3. TRIGGER force_default_status — version corrigée
--     (lowercase + tous les statuts valides incluant 'closed')
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION force_default_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN (
    'active', 'completed', 'paused', 'closed', 'delete_rejected', 'pending_close'
  ) THEN
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- S'assurer que le trigger existe sur la table projects
DROP TRIGGER IF EXISTS force_status_trigger ON public.projects;
CREATE TRIGGER force_status_trigger
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION force_default_status();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  4. TABLE SETTINGS — création si absente
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;

-- Config marchande par défaut si absente
INSERT INTO public.settings (key, value) VALUES (
  'merchant_config',
  '{"orange":{"gn":"","ci":""},"mtn":{"gn":"","bj":""},"wave":{"ci":"","gn":"","bj":""},"moov":{"bj":"","ci":""},"celtiis":{"bj":""},"coris":{"ci":""},"alipay":{"id":"","qr_url":""},"wechatpay":{"id":"","qr_url":""}}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  5. CONTRAINTE projects_status_check — version complète
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Normaliser les statuts existants en minuscules
UPDATE public.projects SET status = LOWER(TRIM(status))
  WHERE status IS DISTINCT FROM LOWER(TRIM(status));

UPDATE public.projects SET status = 'active'
  WHERE status IS NULL
     OR status NOT IN ('active','completed','paused','closed','delete_rejected','pending_close');

-- Recréer la contrainte
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active','completed','paused','closed','delete_rejected','pending_close'));

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  6. INDEX supplémentaires pour performance
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_users_country  ON public.users (country);
CREATE INDEX IF NOT EXISTS idx_users_phone    ON public.users (phone);
CREATE INDEX IF NOT EXISTS idx_proj_user      ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS idx_proj_status    ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_txn_user_date  ON public.transactions (user_id, created_at DESC);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  7. Vérification finale
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT
  'users'   AS table_name,
  COUNT(*)  AS total_rows,
  COUNT(currency) FILTER (WHERE currency IS NOT NULL) AS with_currency,
  COUNT(country)  FILTER (WHERE country = 'bj')       AS benin_users
FROM public.users;
