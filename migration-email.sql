-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Migration Email v7
-- Tables : email_templates, email_logs, email_campaigns, email_prefs
-- Exécuter dans Supabase SQL Editor (idempotent)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Templates ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger     VARCHAR(60) NOT NULL,   -- welcome, deposit_confirmed, deposit_approved, …
  name        VARCHAR(120) NOT NULL,
  subject     VARCHAR(200) NOT NULL,  -- supports {{variables}}
  body_html   TEXT        NOT NULL,
  body_text   TEXT,
  language    VARCHAR(5)  NOT NULL DEFAULT 'fr',
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trigger, language)
);

-- ── 2. Logs ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  template_id  UUID        REFERENCES email_templates(id) ON DELETE SET NULL,
  trigger      VARCHAR(60),
  to_email     VARCHAR(200) NOT NULL,
  subject      VARCHAR(200),
  provider_id  VARCHAR(100),          -- ID retourné par Resend/Brevo
  status       VARCHAR(20) NOT NULL DEFAULT 'sent'
               CHECK (status IN ('sent','delivered','opened','clicked','failed','bounced')),
  opened_at    TIMESTAMPTZ,
  clicked_at   TIMESTAMPTZ,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Campagnes ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaigns (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  template_id   UUID        REFERENCES email_templates(id) ON DELETE SET NULL,
  segment       VARCHAR(30) NOT NULL DEFAULT 'all',
               -- all, gn, bj, ci, cn, kyc_verified, kyc_pending, no_deposit_7d
  status        VARCHAR(20) NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','scheduled','running','done','cancelled')),
  scheduled_at  TIMESTAMPTZ,
  sent_count    INTEGER     NOT NULL DEFAULT 0,
  open_count    INTEGER     NOT NULL DEFAULT 0,
  click_count   INTEGER     NOT NULL DEFAULT 0,
  created_by    VARCHAR(60) NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Préférences utilisateur ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_prefs (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  welcome             BOOLEAN NOT NULL DEFAULT TRUE,
  deposit             BOOLEAN NOT NULL DEFAULT TRUE,
  withdrawal          BOOLEAN NOT NULL DEFAULT TRUE,
  kyc                 BOOLEAN NOT NULL DEFAULT TRUE,
  reminders           BOOLEAN NOT NULL DEFAULT TRUE,
  marketing           BOOLEAN NOT NULL DEFAULT FALSE,
  collective          BOOLEAN NOT NULL DEFAULT TRUE,
  unsubscribed_all    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_email_logs_user      ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_trigger   ON email_logs(trigger);
CREATE INDEX IF NOT EXISTS idx_email_logs_status    ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created   ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_templates_trig ON email_templates(trigger, active);

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_prefs     ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_templates' AND policyname='block anon email_templates') THEN
    CREATE POLICY "block anon email_templates" ON email_templates FOR ALL TO anon USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_logs' AND policyname='block anon email_logs') THEN
    CREATE POLICY "block anon email_logs" ON email_logs FOR ALL TO anon USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_campaigns' AND policyname='block anon email_campaigns') THEN
    CREATE POLICY "block anon email_campaigns" ON email_campaigns FOR ALL TO anon USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_prefs' AND policyname='block anon email_prefs') THEN
    CREATE POLICY "block anon email_prefs" ON email_prefs FOR ALL TO anon USING (false);
  END IF;
END $$;

-- ── 7. Templates par défaut ───────────────────────────────────────────────────
-- (le moteur JS les remplace par les versions DB si disponibles)

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'welcome','Bienvenue','Bienvenue sur Epargn+, {{prenom}} !','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='welcome' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'deposit_confirmed','Dépôt reçu','Votre dépôt de {{montant}} a été reçu','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='deposit_confirmed' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'deposit_approved','Dépôt confirmé ✅','Votre dépôt de {{montant}} est confirmé !','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='deposit_approved' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'deposit_rejected','Dépôt non traité','Information sur votre dépôt','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='deposit_rejected' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'withdrawal_requested','Retrait en cours','Votre retrait de {{montant}} est en cours','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='withdrawal_requested' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'withdrawal_confirmed','Retrait envoyé ✅','Votre retrait de {{montant}} a été envoyé','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='withdrawal_confirmed' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'kyc_received','KYC reçu','Votre dossier KYC a été reçu','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='kyc_received' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'kyc_approved','KYC validé ✅','Votre identité a été vérifiée','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='kyc_approved' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'kyc_rejected','Action requise — KYC rejeté','Nouveau dépôt de documents requis','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='kyc_rejected' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'goal_reached','Objectif atteint 🎉','Félicitations — vous avez atteint votre objectif !','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='goal_reached' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'reminder_7d','Rappel — 7 jours sans dépôt','Un petit dépôt vous rapproche de votre objectif','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='reminder_7d' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'collective_invite','Invitation épargne collective','Vous êtes invité(e) à rejoindre un groupe d\'épargne','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='collective_invite' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'collective_closed','Épargne collective clôturée','Votre groupe d\'épargne a été clôturé','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='collective_closed' AND language='fr');

INSERT INTO email_templates (trigger, name, subject, body_html, language)
SELECT 'ai_suggestion','Conseil personnalisé Epargn+','{{sujet_ia}}','<p>Template géré par le moteur JS</p>','fr'
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE trigger='ai_suggestion' AND language='fr');
