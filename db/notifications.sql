-- ═══════════════════════════════════════════════════════════════
-- Epargn+ — Notifications in-app + historique des broadcasts
-- Cause du bug : la table notifications n'existait pas en prod, donc
-- toutes les écritures (createNotification, dépôts validés, KYC,
-- invitations, broadcasts admin) échouaient silencieusement et la
-- lecture renvoyait toujours une liste vide.
-- Idempotent — à exécuter dans Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- ── Notifications in-app (cloche + section Notifications) ──
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  type        text,                              -- deposit | withdrawal | invitation | broadcast | kyc | ...
  title       text        NOT NULL,
  body        text,
  data        jsonb,
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Filet de sécurité si la table existait déjà avec un schéma incomplet
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type       text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title      text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body       text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data       jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read       boolean     DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notif_user
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread
  ON public.notifications (user_id) WHERE read = false;

-- L'API utilise la clé service_role (contourne RLS) : RLS activé,
-- sans policy publique, donc inaccessible côté client anon.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ── Historique des notifications groupées (broadcast admin) ──
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  message     text,
  target      text,                              -- all | segment...
  sent_count  integer     DEFAULT 0,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

SELECT 'notifications + broadcasts OK' AS status;
