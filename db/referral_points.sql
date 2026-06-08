-- Epargn+ — Prime de parrainage en POINTS (réservée aux ambassadeurs)
-- Colonne anti-double-crédit : total de points déjà générés par les dépôts d'un filleul.
-- À exécuter dans Supabase (SQL editor).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_points_generated int NOT NULL DEFAULT 0;

SELECT 'referral_points OK' AS status;
