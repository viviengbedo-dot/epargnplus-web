-- ══════════════════════════════════════════════════════════════
--  Epargn+ — Migration v3
--  Modules : Collectif, Invitations, Chine (+86), Alipay
--
--  Instructions :
--  1. Aller sur https://supabase.com → votre projet
--  2. SQL Editor → New Query → coller → Run
--  3. Exécuter en une seule fois (tout est idempotent)
-- ══════════════════════════════════════════════════════════════

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  1. TABLE USERS — nouvelles colonnes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Colonnes supplémentaires (si absentes)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pending_deposit TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alipay_id      TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS currency       TEXT DEFAULT 'GNF';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS code_parrain   TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS parraine_par   TEXT;

-- Élargir country pour inclure la Chine (cn)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_country_check;
ALTER TABLE public.users ADD CONSTRAINT users_country_check
  CHECK (country IN ('gn','bj','ci','cn'));

-- Élargir operator pour Alipay / WeChat Pay
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_operator_check;
ALTER TABLE public.users ADD CONSTRAINT users_operator_check
  CHECK (operator IN (
    'orange','mtn','wave','moov','celtiis','coris',
    'alipay','wechatpay'
  ));

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  2. TABLE TRANSACTIONS — nouvelles colonnes + types
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Colonnes supplémentaires
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount        BIGINT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS label         TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS note          TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sender_phone  TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status        TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency      TEXT DEFAULT 'GNF';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference     TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS proof_url     TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS validated_by  TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS validated_at  TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Élargir type
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'depot','retrait','tontine','prime','parrainage',
    'deposit','withdrawal',
    'retrait_projet_collectif','depot_alipay'
  ));

-- Élargir operator (NULL autorisé)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_operator_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_operator_check
  CHECK (operator IS NULL OR operator IN (
    'orange','mtn','wave','moov','celtiis','coris',
    'alipay','wechatpay','Mobile Money'
  ));

-- Élargir statut
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_statut_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_statut_check
  CHECK (statut IN ('pending','completed','failed'));

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_txn_type    ON public.transactions (type);
CREATE INDEX IF NOT EXISTS idx_txn_statut  ON public.transactions (statut);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  3. TABLE PROJECTS — colonnes invitation + membres
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS actuel            BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS color             TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS duree             TEXT DEFAULT 'm12';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_token      TEXT UNIQUE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_code       TEXT UNIQUE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_active     BOOLEAN DEFAULT true;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS members_count     INT DEFAULT 1;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS mise_mensuelle    BIGINT DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS freq              TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS nb_membres_cible  INT DEFAULT 1;

-- Élargir status
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'active','completed','paused',
    'closed','delete_rejected','pending_close'
  ));

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  4. TABLE project_members (nouvelle)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.project_members (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member'
               CHECK (role IN ('creator','member')),
  contribution BIGINT NOT NULL DEFAULT 0,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','inactive','pending','left')),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pm_project ON public.project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user    ON public.project_members (user_id);
ALTER TABLE public.project_members DISABLE ROW LEVEL SECURITY;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  5. TABLE project_invitations (nouvelle)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.project_invitations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inviter_id      UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  invitee_email   TEXT,
  invitee_phone   TEXT,
  invitee_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  token           TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected','expired','revoked')),
  expires_at      TIMESTAMPTZ NOT NULL,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pi_project ON public.project_invitations (project_id);
CREATE INDEX IF NOT EXISTS idx_pi_token   ON public.project_invitations (token);
CREATE INDEX IF NOT EXISTS idx_pi_invitee ON public.project_invitations (invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_pi_email   ON public.project_invitations (invitee_email);
ALTER TABLE public.project_invitations DISABLE ROW LEVEL SECURITY;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  6. TABLE notifications (nouvelle)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,        -- 'invitation','withdrawal','deposit','system'
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB,                -- données extra (project_id, invitation_id, etc.)
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON public.notifications (user_id, read, created_at DESC);
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  7. Vérification finale
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT 'users columns' AS tbl,
  column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='users'
ORDER BY ordinal_position;
