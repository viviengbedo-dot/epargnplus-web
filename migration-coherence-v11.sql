-- ============================================================================
-- Migration COHÉRENCE v11 (2026-09-14)
-- Grand livre = source de vérité unique du solde. Fin des dérives.
--
--   1. Schéma anti-perte silencieuse : type varchar(32) + CHECK complété
--      (avant : varchar(20) rejetait 'retrait_projet_collectif' (24 car.) et la
--       CHECK n'autorisait pas 'bonus'/'reattribution' → INSERT perdus en silence)
--   2. Trigger : users.epargne = Σ crédits validés − Σ débits engagés, recalculé
--      automatiquement à chaque écriture sur transactions. La colonne devient un
--      miroir fiable du grand livre ; le code n'écrit plus jamais epargne à la main.
--
-- Types d'ARGENT (identiques au helper JS computeUserBalance) :
--   Crédits : deposit, depot, depot_alipay, bonus       (comptés si completed/success)
--   Débits  : withdrawal, retrait, retrait_projet_collectif, frais
--             (comptés si NON failed/cancelled — pending inclus : le retrait réserve)
-- Non comptés (pas de l'argent client) : tontine, prime, parrainage (points),
--   reattribution (mouvement interne), invitation (= notifications, autre table).
-- ============================================================================

-- 1. Élargir la colonne type (24 car. ne rentrait pas dans varchar(20))
ALTER TABLE public.transactions ALTER COLUMN type TYPE varchar(32);

-- 2. CHECK complète (superset de tous les types réellement insérés par le code)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (
  'depot','retrait','tontine','prime','parrainage',
  'deposit','withdrawal','retrait_projet_collectif','depot_alipay',
  'bonus','reattribution','frais'
));

-- 3. Fonction de recalcul + trigger
CREATE OR REPLACE FUNCTION public._recompute_epargne(p_user text) RETURNS void AS $$
BEGIN
  UPDATE public.users u
  SET epargne = GREATEST(0, COALESCE((
        SELECT SUM(CASE
          WHEN t.type IN ('deposit','depot','depot_alipay','bonus')
               AND COALESCE(t.statut, t.status) IN ('completed','success') THEN t.amount
          WHEN t.type IN ('withdrawal','retrait','retrait_projet_collectif','frais')
               AND COALESCE(t.statut, t.status) NOT IN ('failed','cancelled') THEN -t.amount
          ELSE 0 END)
        FROM public.transactions t
        WHERE t.user_id::text = p_user), 0)),
      updated_at = now()
  WHERE u.id::text = p_user;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.trg_recompute_epargne() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public._recompute_epargne(OLD.user_id::text);
    RETURN OLD;
  END IF;
  PERFORM public._recompute_epargne(NEW.user_id::text);
  IF (TG_OP = 'UPDATE' AND NEW.user_id::text IS DISTINCT FROM OLD.user_id::text) THEN
    PERFORM public._recompute_epargne(OLD.user_id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_epargne_sync ON public.transactions;
CREATE TRIGGER transactions_epargne_sync
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_epargne();

-- 4. Recalage initial de TOUS les soldes (une fois) pour partir propre
UPDATE public.users u
SET epargne = GREATEST(0, COALESCE((
      SELECT SUM(CASE
        WHEN t.type IN ('deposit','depot','depot_alipay','bonus')
             AND COALESCE(t.statut, t.status) IN ('completed','success') THEN t.amount
        WHEN t.type IN ('withdrawal','retrait','retrait_projet_collectif','frais')
             AND COALESCE(t.statut, t.status) NOT IN ('failed','cancelled') THEN -t.amount
        ELSE 0 END)
      FROM public.transactions t
      WHERE t.user_id = u.id), 0)),
    updated_at = now();

-- Vérif : doit renvoyer 0 ligne (aucun écart entre solde stocké et grand livre)
-- SELECT u.id, u.epargne FROM public.users u WHERE u.epargne <> GREATEST(0, COALESCE((
--   SELECT SUM(CASE
--     WHEN t.type IN ('deposit','depot','depot_alipay','bonus') AND COALESCE(t.statut,t.status) IN ('completed','success') THEN t.amount
--     WHEN t.type IN ('withdrawal','retrait','retrait_projet_collectif','frais') AND COALESCE(t.statut,t.status) NOT IN ('failed','cancelled') THEN -t.amount
--     ELSE 0 END) FROM public.transactions t WHERE t.user_id = u.id),0));
