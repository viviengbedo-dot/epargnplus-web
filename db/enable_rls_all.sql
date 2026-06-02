-- ════════════════════════════════════════════════════════════════════
-- Epargn+ — Correctif sécurité : activer Row-Level Security (RLS)
-- ════════════════════════════════════════════════════════════════════
-- Contexte : l'advisor Supabase signale rls_disabled_in_public et
-- sensitive_columns_exposed → n'importe qui avec la clé anon peut lire/
-- écrire/supprimer toutes les tables (users.pin, phone, email, etc.).
--
-- POURQUOI C'EST SANS RISQUE POUR L'APP :
--   - Le backend (api/_lib/supabase.js) utilise SUPABASE_SERVICE_KEY
--     (rôle service_role) qui CONTOURNE la RLS → continue de fonctionner.
--   - Le frontend ne parle jamais directement à Supabase : tout passe par
--     /api/* (vérifié, aucune clé anon dans le code).
--   - Activer RLS SANS policy = blocage total pour anon/authenticated,
--     accès normal pour service_role. C'est exactement le but.
--
-- À EXÉCUTER dans Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

-- 1. Activer RLS sur TOUTES les tables du schéma public (boucle = rien d'oublié)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- 2. Vérification : lister les tables encore SANS RLS (doit renvoyer 0 ligne)
SELECT tablename
FROM   pg_tables
WHERE  schemaname = 'public'
  AND  rowsecurity = false
ORDER  BY tablename;
