-- ═══════════════════════════════════════════════════════════════════════════
-- Epargn+ — Migration Pilote v6
-- À exécuter dans Supabase SQL Editor (idempotent)
-- Ajoute : support_tickets, ticket_replies, promo_codes, promo_uses, broadcasts
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Support tickets ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      VARCHAR(200) NOT NULL,
  message      TEXT        NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','in_progress','resolved','closed')),
  priority     VARCHAR(10) NOT NULL DEFAULT 'normal'
                           CHECK (priority IN ('low','normal','high','urgent')),
  category     VARCHAR(50) NOT NULL DEFAULT 'general',
  admin_reply  TEXT,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id  UUID,                        -- NULL = admin
  message    TEXT        NOT NULL,
  is_admin   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Promo codes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promo_codes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(50) UNIQUE NOT NULL,
  description    TEXT,
  type           VARCHAR(20) NOT NULL
                             CHECK (type IN ('bonus_deposit','fee_free','cashback')),
  value          NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency       VARCHAR(10)   NOT NULL DEFAULT 'GNF',
  max_uses       INTEGER       DEFAULT NULL,   -- NULL = illimité
  uses_count     INTEGER       NOT NULL DEFAULT 0,
  target_country VARCHAR(5)    DEFAULT NULL,   -- NULL = tous les pays
  active         BOOLEAN       NOT NULL DEFAULT TRUE,
  expires_at     TIMESTAMPTZ   DEFAULT NULL,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_uses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id   UUID        NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_id, user_id)
);

-- ── 3. Broadcasts (notifications admin → segment utilisateurs) ──────────────

CREATE TABLE IF NOT EXISTS broadcasts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(200) NOT NULL,
  message      TEXT         NOT NULL,
  target       VARCHAR(20)  NOT NULL DEFAULT 'all',  -- 'all','gn','bj','ci','cn'
  sent_count   INTEGER      NOT NULL DEFAULT 0,
  created_by   VARCHAR(100) NOT NULL DEFAULT 'admin',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 4. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_tickets_user   ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket  ON ticket_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_user        ON promo_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_uses_promo       ON promo_uses(promo_id);

-- ── 5. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_replies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_uses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='support_tickets' AND policyname='block anon support_tickets') THEN
    CREATE POLICY "block anon support_tickets" ON support_tickets FOR ALL TO anon USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ticket_replies' AND policyname='block anon ticket_replies') THEN
    CREATE POLICY "block anon ticket_replies" ON ticket_replies FOR ALL TO anon USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_codes' AND policyname='block anon promo_codes') THEN
    CREATE POLICY "block anon promo_codes" ON promo_codes FOR ALL TO anon USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_uses' AND policyname='block anon promo_uses') THEN
    CREATE POLICY "block anon promo_uses" ON promo_uses FOR ALL TO anon USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='broadcasts' AND policyname='block anon broadcasts') THEN
    CREATE POLICY "block anon broadcasts" ON broadcasts FOR ALL TO anon USING (false);
  END IF;
END $$;

-- ── 6. Promo de lancement pilote (exemple) ───────────────────────────────────

INSERT INTO promo_codes (code, description, type, value, currency, max_uses, target_country)
SELECT 'PILOTE2026', 'Bonus lancement — 5 000 GNF offerts sur 1er dépôt', 'bonus_deposit', 5000, 'GNF', 50, 'gn'
WHERE NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'PILOTE2026');

INSERT INTO promo_codes (code, description, type, value, currency, max_uses, target_country)
SELECT 'BENINSTART', 'Lancement Bénin — 2 000 FCFA offerts', 'bonus_deposit', 2000, 'FCFA', 30, 'bj'
WHERE NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'BENINSTART');
