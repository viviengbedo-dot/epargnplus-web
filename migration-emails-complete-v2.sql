-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Système Email Complet v2 (Simplifié)
-- Tables: templates, logs, preferences, campaigns
-- Idempotent — Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Table: Email Templates ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type   VARCHAR(50) NOT NULL UNIQUE,
  subject         TEXT        NOT NULL,
  html_content    TEXT        NOT NULL,
  text_content    TEXT,
  enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);

-- ── 2. Table: Email Logs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES users(id) ON DELETE CASCADE,
  template_type   VARCHAR(50) NOT NULL,
  recipient_email TEXT        NOT NULL,
  subject         TEXT        NOT NULL,
  variables       JSONB,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider        VARCHAR(20),
  provider_id     TEXT,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(template_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);

-- ── 3. Table: Email Preferences ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_preferences (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  welcome         BOOLEAN     NOT NULL DEFAULT TRUE,
  deposit_updates BOOLEAN     NOT NULL DEFAULT TRUE,
  withdrawal      BOOLEAN     NOT NULL DEFAULT TRUE,
  goal_reached    BOOLEAN     NOT NULL DEFAULT TRUE,
  invitations     BOOLEAN     NOT NULL DEFAULT TRUE,
  milestones      BOOLEAN     NOT NULL DEFAULT TRUE,
  reminders       BOOLEAN     NOT NULL DEFAULT TRUE,
  marketing       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user ON email_preferences(user_id);

-- ── 4. Table: Email Campaigns ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_campaigns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  template_type   VARCHAR(50) NOT NULL,
  target_count    INTEGER,
  sent_count      INTEGER     DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  scheduled_at    TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_created_by ON email_campaigns(created_by);

-- ── 5. RLS Policies ────────────────────────────────────────────────────────

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_logs' AND policyname = 'Users view own email logs'
  ) THEN
    CREATE POLICY "Users view own email logs" ON email_logs
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'email_preferences' AND policyname = 'Users manage own email prefs'
  ) THEN
    CREATE POLICY "Users manage own email prefs" ON email_preferences
      FOR ALL TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ── 6. Pre-insert Email Templates ──────────────────────────────────────────

DELETE FROM email_templates WHERE template_type IN (
  'welcome', 'deposit_pending', 'deposit_approved', 'withdrawal_approved',
  'goal_reached', 'invitation_sent', 'member_joined', 'milestone_reached', 'inactivity_reminder'
);

INSERT INTO email_templates (template_type, subject, html_content, text_content) VALUES

-- BIENVENUE
('welcome',
  '🎉 Bienvenue sur Epargn+ !',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #0B1566; margin-bottom: 10px;">Bienvenue, {{prenom}} ! 🎉</h1><p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Votre compte Epargn+ est maintenant actif ! Commencez à épargner dès maintenant et atteignez vos objectifs financiers.</p><div style="background: #EEF2FF; border-left: 4px solid #0B1566; padding: 15px; margin-bottom: 20px;"><p style="color: #0B1566; font-weight: bold; margin: 0 0 10px 0;">🚀 Prochaines étapes :</p><ul style="color: #333; margin: 0; padding-left: 20px;"><li>Complétez votre KYC pour augmenter vos limites</li><li>Créez votre premier projet d''épargne</li><li>Effectuez votre premier dépôt</li></ul></div><a href="{{app_url}}/espace-client" style="display: inline-block; background: #C8E600; color: #0B1566; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Aller à mon espace</a><p style="color: #999; font-size: 12px; margin-top: 30px;">Questions ? Contactez notre support.</p></div></body></html>',
  'Bienvenue {{prenom}} ! Votre compte Epargn+ est actif. Allez à {{app_url}}/espace-client'
),

-- DÉPÔT EN ATTENTE
('deposit_pending',
  '⏳ Votre dépôt de {{montant}} {{devise}} est en attente',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #0B1566; margin-bottom: 10px;">⏳ Dépôt en attente</h1><p style="color: #666; font-size: 16px; line-height: 1.6;">Nous avons bien reçu votre demande de dépôt de <strong>{{montant}} {{devise}}</strong> pour le projet <strong>{{projet_nom}}</strong>.</p><div style="background: #FFF7ED; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;"><p style="color: #92400E; margin: 0;"><strong>⏱ Statut :</strong> En attente de validation (habituellement 2-4 heures)</p></div><p style="color: #666; font-size: 14px;">Référence: <code>{{reference}}</code></p><a href="{{app_url}}/espace-client" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">Suivre mon dépôt</a></div></body></html>',
  'Dépôt de {{montant}} {{devise}} reçu pour {{projet_nom}}. Référence: {{reference}}'
),

-- DÉPÔT APPROUVÉ
('deposit_approved',
  '✅ Votre dépôt de {{montant}} {{devise}} a été approuvé !',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #059669; margin-bottom: 10px;">✅ Dépôt approuvé !</h1><p style="color: #666; font-size: 16px; line-height: 1.6;">Félicitations ! Votre dépôt de <strong>{{montant}} {{devise}}</strong> a été approuvé et crédité sur votre compte.</p><div style="background: #F0FDF4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;"><p style="color: #166534; margin: 0 0 10px 0;"><strong>📊 Progression :</strong></p><p style="color: #166534; margin: 0;">{{projet_nom}} : {{progression}}% atteint</p></div><p style="color: #666; font-size: 14px; margin: 10px 0;"><strong>💰 Votre solde :</strong> {{solde}} {{devise}}</p><a href="{{app_url}}/espace-client" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">Voir mes projets</a></div></body></html>',
  'Dépôt de {{montant}} {{devise}} approuvé. {{projet_nom}} à {{progression}}%'
),

-- RETRAIT APPROUVÉ
('withdrawal_approved',
  '✅ Votre retrait de {{montant}} {{devise}} a été approuvé',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #059669; margin-bottom: 10px;">✅ Retrait approuvé !</h1><p style="color: #666; font-size: 16px; line-height: 1.6;">Votre demande de retrait de <strong>{{montant}} {{devise}}</strong> a été approuvée. Les fonds seront transférés vers votre compte dans 1-2 jours.</p><div style="background: #F0FDF4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;"><p style="color: #166534; margin: 0;"><strong>📞 Numéro de téléphone :</strong> {{phone}}</p></div><p style="color: #666; font-size: 14px;">Référence: <code>{{reference}}</code></p></div></body></html>',
  'Retrait de {{montant}} {{devise}} approuvé. Transfert en 1-2 jours.'
),

-- OBJECTIF ATTEINT
('goal_reached',
  '🏆 Vous avez atteint votre objectif {{projet_nom}} !',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #059669; margin-bottom: 10px;">🏆 Objectif atteint !</h1><p style="color: #666; font-size: 16px; line-height: 1.6;">Félicitations ! Vous avez atteint votre objectif de <strong>{{montant}} {{devise}}</strong> pour <strong>{{projet_nom}}</strong>.</p><div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;"><p style="color: #92400E; margin: 0;"><strong>⚠️ Important :</strong> Votre retrait sera disponible à la date d''échéance : <strong>{{deadline}}</strong></p></div><a href="{{app_url}}/espace-client" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">Accéder à mon compte</a></div></body></html>',
  'Objectif {{projet_nom}} atteint ! Retrait disponible le {{deadline}}'
),

-- INVITATION ÉPARGNE
('invitation_sent',
  '🤝 {{inviter_name}} vous invite à une épargne collective !',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #0B1566; margin-bottom: 10px;">🤝 Invitation épargne collective !</h1><p style="color: #666; font-size: 16px; line-height: 1.6;"><strong>{{inviter_name}}</strong> vous invite à rejoindre une épargne collective : <strong>{{projet_nom}}</strong></p><div style="background: #EEF2FF; border-left: 4px solid #0B1566; padding: 15px; margin: 20px 0;"><p style="color: #0B1566; margin: 0;"><strong>🎯 Objectif :</strong> {{montant}} {{devise}}</p><p style="color: #0B1566; margin: 5px 0 0 0;"><strong>👥 Membres :</strong> {{nb_membres}} personnes</p></div><a href="{{invite_url}}" style="display: inline-block; background: #C8E600; color: #0B1566; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">Accepter l''invitation</a><p style="color: #999; font-size: 12px; margin-top: 20px;">Lien valide pour 30 jours.</p></div></body></html>',
  '{{inviter_name}} vous invite à rejoindre {{projet_nom}}. Accepter: {{invite_url}}'
),

-- MEMBRE ACCEPTED
('member_joined',
  '👋 {{new_member_name}} a rejoint {{projet_nom}} !',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #0B1566; margin-bottom: 10px;">👋 Nouveau membre !</h1><p style="color: #666; font-size: 16px; line-height: 1.6;"><strong>{{new_member_name}}</strong> a accepté votre invitation et a rejoint l''épargne collective <strong>{{projet_nom}}</strong>.</p><div style="background: #F0FDF4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;"><p style="color: #166534; margin: 0;">👥 <strong>Vous êtes maintenant {{nb_membres}} membres</strong></p></div></div></body></html>',
  '{{new_member_name}} a rejoint {{projet_nom}}. Vous êtes {{nb_membres}} membres.'
),

-- MILESTONE REACHED
('milestone_reached',
  '🎉 {{projet_nom}} est à {{pourcentage}}% !',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #0B1566; margin-bottom: 10px;">🎉 {{pourcentage}}% atteint !</h1><p style="color: #666; font-size: 16px; line-height: 1.6;">Bravo ! Vous avez atteint {{pourcentage}}% de votre objectif pour <strong>{{projet_nom}}</strong>.</p><div style="background: #EEF2FF; border-left: 4px solid #0B1566; padding: 15px; margin: 20px 0;"><div style="height: 10px; background: #E5E7EB; border-radius: 5px; overflow: hidden;"><div style="width: {{pourcentage}}%; height: 100%; background: linear-gradient(90deg, #0B1566, #C8E600);"></div></div><p style="color: #0B1566; margin: 10px 0 0 0;"><strong>{{montant}} {{devise}} / {{objectif}} {{devise}}</strong></p></div><p style="color: #666; font-size: 14px;">Continuez vos efforts ! 💪</p></div></body></html>',
  '{{projet_nom}} à {{pourcentage}}% ! {{montant}}/{{objectif}} {{devise}}'
),

-- INACTIVITÉ
('inactivity_reminder',
  '💤 Vous n''avez rien fait depuis {{jours}} jours',
  '<html><body style="font-family: Arial; background: #f5f5f5; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;"><h1 style="color: #F59E0B; margin-bottom: 10px;">💤 Ça y est, vous vous endormez ? 😴</h1><p style="color: #666; font-size: 16px; line-height: 1.6;">Vous n''avez pas effectué de dépôt depuis <strong>{{jours}} jours</strong>. Ne laissez pas vos objectifs attendre !</p><div style="background: #FFF7ED; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;"><p style="color: #92400E; margin: 0 0 10px 0;"><strong>📊 Vos projets en attente :</strong></p><p style="color: #92400E; margin: 0;">{{projets}}</p></div><a href="{{app_url}}/espace-client" style="display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">Effectuer un dépôt</a></div></body></html>',
  'Ça y est, vous vous endormez ? Aucun dépôt depuis {{jours}} jours.'
);

DO $$ BEGIN
  RAISE NOTICE '✅ Migration emails v2 terminée — 8 templates créés';
END $$;
