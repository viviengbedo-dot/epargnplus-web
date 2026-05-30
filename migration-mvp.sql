-- ══════════════════════════════════════════════════════════════════════════
--  Epargn+ — Migration MVP (v5)
--  Schéma complet + RLS + Policies + Indexes
--
--  Instructions :
--    1. Supabase → SQL Editor → New Query → Coller → Run
--    2. Idempotent : peut être relancé sans risque sur une base existante
--    3. Le backend utilise la clé service_role (bypass RLS automatique)
--       Les policies protègent contre tout accès direct via clé anon
-- ══════════════════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  1. TABLE USERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'gn',
  prenom          TEXT NOT NULL,
  nom             TEXT NOT NULL,
  email           TEXT,
  operator        TEXT,
  pin_hash        TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  epargne         NUMERIC NOT NULL DEFAULT 0 CHECK (epargne >= 0),
  pending_deposit TEXT,
  currency        TEXT NOT NULL DEFAULT 'GNF',
  -- KYC
  kyc_status           TEXT NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none','pending','verified','rejected')),
  kyc_document_url     TEXT,
  kyc_selfie_url       TEXT,
  kyc_doc_number       TEXT,
  kyc_doc_type         TEXT DEFAULT 'CNI',
  kyc_submitted_at     TIMESTAMPTZ,
  kyc_verified_at      TIMESTAMPTZ,
  kyc_rejection_reason TEXT,
  -- AML
  aml_status      TEXT DEFAULT 'not_checked',
  aml_checked_at  TIMESTAMPTZ,
  risk_score      INTEGER DEFAULT 0,
  -- Parrainage
  code_parrain    TEXT,
  parraine_par    TEXT,
  -- Chine
  alipay_id       TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Contraintes uniques (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_key') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_phone_key UNIQUE (phone);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_code_parrain_key') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_code_parrain_key UNIQUE (code_parrain);
  END IF;
END $$;

-- Colonnes manquantes si la table existait déjà
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS currency        TEXT NOT NULL DEFAULT 'GNF';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_document_url     TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_selfie_url       TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_doc_number       TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_doc_type         TEXT DEFAULT 'CNI';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_submitted_at     TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_verified_at      TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aml_status           TEXT DEFAULT 'not_checked';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aml_checked_at       TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS risk_score           INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alipay_id            TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS code_parrain         TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS parraine_par         TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email                TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- Correction devise Bénin/CI pour les comptes existants
UPDATE public.users
  SET currency = CASE
    WHEN country = 'bj' THEN 'FCFA'
    WHEN country = 'ci' THEN 'FCFA'
    WHEN country = 'cn' THEN 'CNY'
    ELSE 'GNF'
  END
WHERE currency IS NULL
   OR (currency = 'GNF' AND country IN ('bj','ci','cn'));

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  2. TABLE PROJECTS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  goal              NUMERIC NOT NULL DEFAULT 0 CHECK (goal >= 0),
  actuel            NUMERIC NOT NULL DEFAULT 0 CHECK (actuel >= 0),
  status            TEXT NOT NULL DEFAULT 'active',
  color             TEXT DEFAULT '#0B1566',
  duree             TEXT DEFAULT 'm12',
  mise_mensuelle    INTEGER,
  freq              TEXT,
  nb_membres_cible  INTEGER DEFAULT 1,
  -- Épargne collective
  invite_token      TEXT,
  invite_code       TEXT,
  invite_expires_at TIMESTAMPTZ,
  invite_active     BOOLEAN DEFAULT FALSE,
  members_count     INTEGER DEFAULT 1,
  -- Timestamps
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Normaliser les statuts existants
UPDATE public.projects SET status = LOWER(TRIM(status))
  WHERE status IS DISTINCT FROM LOWER(TRIM(status));

UPDATE public.projects SET status = 'active'
  WHERE status IS NULL
     OR status NOT IN ('active','completed','paused','closed','delete_rejected','pending_close');

-- Contrainte statuts (recréation idempotente)
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active','completed','paused','closed','delete_rejected','pending_close'));

-- Colonnes manquantes
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS mise_mensuelle    INTEGER;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS freq              TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS nb_membres_cible  INTEGER DEFAULT 1;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_token      TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_code       TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_active     BOOLEAN DEFAULT FALSE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS members_count     INTEGER DEFAULT 1;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

-- Indexes uniques sur invite_token / invite_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_invite_token
  ON public.projects (invite_token) WHERE invite_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_invite_code
  ON public.projects (invite_code) WHERE invite_code IS NOT NULL;

-- Trigger status
CREATE OR REPLACE FUNCTION force_default_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN (
    'active','completed','paused','closed','delete_rejected','pending_close'
  ) THEN
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS force_status_trigger ON public.projects;
CREATE TRIGGER force_status_trigger
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION force_default_status();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  3. TABLE TRANSACTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  amount           NUMERIC NOT NULL DEFAULT 0,
  operator         TEXT,
  is_credit        BOOLEAN DEFAULT TRUE,
  label            TEXT,
  note             TEXT,
  sender_phone     TEXT,
  project_id       UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  statut           TEXT NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending','completed','failed')),
  status           TEXT DEFAULT 'pending',
  currency         TEXT DEFAULT 'GNF',
  reference        TEXT,
  proof_url        TEXT,
  validated_by     TEXT,
  validated_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Colonnes manquantes
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sender_phone     TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency         TEXT DEFAULT 'GNF';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference        TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS proof_url        TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS validated_by     TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS validated_at     TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'pending';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  4. TABLE PROJECT_MEMBERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.project_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('creator','member')),
  contribution NUMERIC DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','left','removed')),
  joined_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte UNIQUE : un utilisateur ne peut être membre qu'une fois par projet
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_user_key'
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_project_user_key UNIQUE (project_id, user_id);
  END IF;
END $$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  5. TABLE PROJECT_INVITATIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.project_invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inviter_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_email    TEXT,
  invitee_phone    TEXT,
  invitee_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  token            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  expires_at       TIMESTAMPTZ NOT NULL,
  responded_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token
  ON public.project_invitations (token);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  6. TABLE NOTIFICATIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT,
  title      TEXT,
  body       TEXT,
  data       JSONB,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  7. TABLE SETTINGS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Config marchande par défaut (si absente)
INSERT INTO public.settings (key, value) VALUES (
  'merchant_config',
  '{
    "orange": {"gn":"","ci":""},
    "mtn":    {"gn":"","bj":""},
    "wave":   {"ci":"","gn":"","bj":""},
    "moov":   {"bj":"","ci":""},
    "celtiis":{"bj":""},
    "coris":  {"ci":""},
    "alipay": {"id":"","qr_url":"https://qr.alipay.com/fkx19533jx18kzt4qyfrt72"},
    "wechatpay":{"id":"","qr_url":""}
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  8. INDEXES DE PERFORMANCE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_users_phone         ON public.users        (phone);
CREATE INDEX IF NOT EXISTS idx_users_country       ON public.users        (country);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status    ON public.users        (kyc_status);
CREATE INDEX IF NOT EXISTS idx_proj_user_id        ON public.projects     (user_id);
CREATE INDEX IF NOT EXISTS idx_proj_status         ON public.projects     (status);
CREATE INDEX IF NOT EXISTS idx_txn_user_id         ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_txn_user_date       ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_statut          ON public.transactions (statut);
CREATE INDEX IF NOT EXISTS idx_txn_project_id      ON public.transactions (project_id);
CREATE INDEX IF NOT EXISTS idx_members_project     ON public.project_members     (project_id);
CREATE INDEX IF NOT EXISTS idx_members_user        ON public.project_members     (user_id);
CREATE INDEX IF NOT EXISTS idx_invit_project       ON public.project_invitations (project_id);
CREATE INDEX IF NOT EXISTS idx_invit_invitee_user  ON public.project_invitations (invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread   ON public.notifications       (user_id, read) WHERE read = FALSE;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  9. ROW LEVEL SECURITY
--
--  Principe :
--    • Le backend utilise SUPABASE_SERVICE_KEY (service_role) → bypass RLS
--    • RLS protège contre tout accès direct via la clé anon (API publique)
--    • Aucune policy n'autorise le rôle anon → toutes les tables sont
--      inaccessibles directement depuis le navigateur
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Activer RLS sur toutes les tables
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings             ENABLE ROW LEVEL SECURITY;

-- ── Supprimer les anciennes policies (idempotent) ──────────────────────

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users','projects','transactions','project_members',
        'project_invitations','notifications','settings'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── USERS ──────────────────────────────────────────────────────────────
-- Le rôle anon ne peut rien faire.
-- Le rôle authenticated (Supabase Auth — non utilisé actuellement) ne peut rien faire.
-- Le service_role bypass RLS.

CREATE POLICY "deny_anon_users"
  ON public.users FOR ALL TO anon USING (FALSE);

-- ── PROJECTS ───────────────────────────────────────────────────────────
CREATE POLICY "deny_anon_projects"
  ON public.projects FOR ALL TO anon USING (FALSE);

-- ── TRANSACTIONS ───────────────────────────────────────────────────────
CREATE POLICY "deny_anon_transactions"
  ON public.transactions FOR ALL TO anon USING (FALSE);

-- ── PROJECT_MEMBERS ────────────────────────────────────────────────────
CREATE POLICY "deny_anon_project_members"
  ON public.project_members FOR ALL TO anon USING (FALSE);

-- ── PROJECT_INVITATIONS ────────────────────────────────────────────────
CREATE POLICY "deny_anon_project_invitations"
  ON public.project_invitations FOR ALL TO anon USING (FALSE);

-- ── NOTIFICATIONS ──────────────────────────────────────────────────────
CREATE POLICY "deny_anon_notifications"
  ON public.notifications FOR ALL TO anon USING (FALSE);

-- ── SETTINGS ───────────────────────────────────────────────────────────
-- Settings : lecture publique autorisée (noms opérateurs, config marchande)
-- Écriture réservée au service_role (backend admin uniquement)
CREATE POLICY "allow_read_settings"
  ON public.settings FOR SELECT TO anon USING (TRUE);

CREATE POLICY "deny_write_settings"
  ON public.settings FOR ALL TO anon USING (FALSE);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  10. VÉRIFICATION FINALE
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT
  t.tablename,
  t.rowsecurity AS rls_active,
  COUNT(p.policyname) AS nb_policies
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'users','projects','transactions','project_members',
    'project_invitations','notifications','settings'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
