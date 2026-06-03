-- ════════════════════════════════════════════════════════════════════
-- Epargn+ — Communautés / Cercles d'épargne (Phase 1)
-- À exécuter dans Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.communities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text NOT NULL DEFAULT 'autre',  -- famille|entreprise|quartier|mosquee|etudiants|femmes|chauffeurs|cooperative|autre
  goal          bigint NOT NULL DEFAULT 0,
  total_saved   bigint NOT NULL DEFAULT 0,
  members_count int NOT NULL DEFAULT 1,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id  uuid NOT NULL,
  user_id       uuid NOT NULL,
  role          text NOT NULL DEFAULT 'member',  -- creator|member
  points        int  NOT NULL DEFAULT 0,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_members_community ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user      ON public.community_members(user_id);

-- RLS : activée, aucune policy → seul le service_role (backend) accède (cohérent avec le reste)
ALTER TABLE public.communities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Vérification (doit renvoyer les 2 tables avec rowsecurity = true)
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename IN ('communities','community_members');
