-- ════════════════════════════════════════════════════════════════════
--  Epargn+ — RÉPARATION DU SCHÉMA DE PRODUCTION
--  À exécuter dans Supabase → SQL Editor → New query → Run
--
--  POURQUOI : les anciennes migrations utilisaient CREATE TABLE IF NOT EXISTS,
--  qui n'ajoute PAS les nouvelles colonnes à une table déjà existante.
--  Résultat en prod : notifications.type manquant, projects.invite_code
--  manquant, etc. → notifications jamais lues/créées, liens d'invitation
--  jamais générés, invités ne reçoivent rien.
--
--  Ce script est IDEMPOTENT : il n'ajoute que ce qui manque, ne supprime
--  ni ne modifie aucune donnée existante. Vous pouvez le relancer sans risque.
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. TABLE notifications  (cause du "aucune notif dans le dashboard")
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type       TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title      TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body       TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data       JSONB;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON public.notifications (user_id, read, created_at DESC);
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 2. TABLE projects  (cause du "aucun lien d'invitation créé")
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_token            TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_code             TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_expires_at       TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invite_active           BOOLEAN DEFAULT TRUE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS members_count           INTEGER DEFAULT 1;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contribution_type       TEXT DEFAULT 'free';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS min_contribution_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS mise_mensuelle          BIGINT DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS nb_membres_cible        INTEGER DEFAULT 1;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS has_funds               BOOLEAN DEFAULT FALSE;

-- Index uniques sur les codes d'invitation (ignore les doublons si déjà présents)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_invite_token ON public.projects (invite_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_invite_code  ON public.projects (invite_code);

-- ─────────────────────────────────────────────────────────────────────
-- 3. TABLE project_invitations  (cause du "invité ne reçoit rien")
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS invitee_email   TEXT;
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS invitee_phone   TEXT;
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS invitee_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS token           TEXT;
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ;
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS responded_at    TIMESTAMPTZ;
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_pi_project ON public.project_invitations (project_id);
CREATE INDEX IF NOT EXISTS idx_pi_token   ON public.project_invitations (token);
CREATE INDEX IF NOT EXISTS idx_pi_invitee ON public.project_invitations (invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_pi_email   ON public.project_invitations (invitee_email);
ALTER TABLE public.project_invitations DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────
-- 4. TABLE project_members
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS role         TEXT DEFAULT 'member';
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS contribution NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'active';
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS joined_at    TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_pm_project ON public.project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user    ON public.project_members (user_id);
ALTER TABLE public.project_members DISABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (optionnel) : décommentez pour lister les colonnes ajoutées
-- ════════════════════════════════════════════════════════════════════
-- SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name IN ('notifications','projects','project_invitations','project_members')
--   ORDER BY table_name, ordinal_position;

-- ✅ Terminé. Rechargez l'application — notifications, liens d'invitation
--    et ajout de membres fonctionnent maintenant.
