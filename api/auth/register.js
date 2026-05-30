/**
 * POST /api/auth/register — Epargn+
 * Crée un nouveau compte après vérification OTP.
 * Supporte : Guinée (+224), Bénin (+229), Côte d'Ivoire (+225)
 *
 * Corps JSON attendu :
 *   { phone, country, prenom, nom, pin, otp_token, otp_code }
 *   operator est optionnel — défaut : premier opérateur du pays
 *
 * Retourne :
 *   201 { token, user }   — succès
 *   400                   — validation / OTP invalide
 *   409                   — numéro déjà enregistré
 *   500                   — erreur serveur
 */

const crypto = require('crypto');
const { supabaseRequest } = require('../_lib/supabase');
const { hashPin, createJWT } = require('../_lib/auth');
const { sendEmail, welcomeEmailHtml } = require('../_lib/email');

const OTP_SECRET = process.env.OTP_SECRET || 'epargn-otp-dev-secret-change-me';
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

/* ── Configuration multi-pays ── */
const COUNTRY_CONFIG = {
  gn: {
    name: 'Guinée',
    prefix: '+224',
    phoneMinLen: 8,
    phoneMaxLen: 9,
    operators: ['orange', 'mtn', 'wave'],
  },
  bj: {
    name: 'Bénin',
    prefix: '+229',
    phoneMinLen: 8,   // anciens numéros (8 chiffres)
    phoneMaxLen: 10,  // nouveaux numéros béninois (10 chiffres depuis 2023)
    operators: ['mtn', 'moov', 'wave', 'celtiis'],
  },
  ci: {
    name: "Côte d'Ivoire",
    prefix: '+225',
    phoneMinLen: 10,
    phoneMaxLen: 10,
    operators: ['orange', 'mtn', 'moov', 'wave', 'coris'],
  },
};

/* ── Parse body ── */
function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

/* ── Génération du code de parrainage unique ── */
function generateReferralCode(prenom) {
  const prefix = (prenom || 'USR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return prefix + random;
}

/* ── Vérification du token OTP (stateless HMAC) ── */
function verifyOTPToken(otp_code, phone, token) {
  if (!token || !otp_code || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const ts  = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (Date.now() - parseInt(ts, 10) > OTP_TTL_MS) return false;
  const expected = crypto
    .createHmac('sha256', OTP_SECRET)
    .update(otp_code + ':' + phone + ':' + ts)
    .digest('hex');
  return sig === expected;
}

/* ── Handler principal ── */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  const { phone, country = 'gn', prenom, nom, operator, pin, otp_token, otp_code, email, parraine_par } = await parseBody(req);

  /* ── Validation du pays ── */
  const countryCfg = COUNTRY_CONFIG[country];
  if (!countryCfg) {
    return res.status(400).json({ error: 'Pays invalide. Choisissez : gn (Guinée), bj (Bénin) ou ci (Côte d\'Ivoire).' });
  }

  /* ── Validation des champs ── */
  if (!phone || !prenom || !nom || !pin) {
    return res.status(400).json({ error: 'Champs requis manquants (phone, prenom, nom, pin)' });
  }
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'Le PIN doit contenir exactement 4 chiffres' });
  }

  /* ── Opérateur : utiliser celui fourni ou le premier du pays ── */
  const resolvedOperator = (operator && countryCfg.operators.includes(operator))
    ? operator
    : countryCfg.operators[0];

  /* ── Validation du numéro local ── */
  const localPhone = phone.replace(/[\s\-\.]/g, '');
  if (!/^\d+$/.test(localPhone) || localPhone.length < countryCfg.phoneMinLen || localPhone.length > countryCfg.phoneMaxLen) {
    return res.status(400).json({ error: `Numéro de téléphone invalide pour ${countryCfg.name}` });
  }

  /* ── Numéro international complet ── */
  const fullPhone = countryCfg.prefix + localPhone;

  /* ── Vérification OTP ── */
  if (!verifyOTPToken(otp_code, fullPhone, otp_token)) {
    return res.status(400).json({ error: 'Code OTP invalide ou expiré. Demandez un nouveau code.' });
  }

  const cleanEmail   = (email || '').trim().toLowerCase() || null;
  const cleanParrain = (parraine_par || '').trim().toUpperCase() || null;

  try {
    /* ── Vérifier unicité du numéro ── */
    const existing = await supabaseRequest(
      'GET',
      '/users?phone=eq.' + encodeURIComponent(fullPhone) + '&select=id'
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ error: 'Ce numéro est déjà enregistré. Connectez-vous.' });
    }

    /* ── Vérifier unicité de l'email ── */
    if (cleanEmail) {
      try {
        const emailCheck = await supabaseRequest(
          'GET',
          '/users?email=eq.' + encodeURIComponent(cleanEmail) + '&select=id'
        );
        if (Array.isArray(emailCheck) && emailCheck.length > 0) {
          return res.status(409).json({ error: 'Cet email est déjà utilisé par un autre compte. Connectez-vous.' });
        }
      } catch (_) { /* colonne email absente — ignoré */ }
    }

    /* ── Créer l'utilisateur ── */
    const pin_hash = hashPin(pin);
    const code_parrain  = generateReferralCode(prenom);
    const payloadFull = {
      phone:      fullPhone,
      country,
      prenom:     prenom.trim(),
      nom:        nom.trim(),
      operator:   resolvedOperator,
      pin_hash,
      epargne:    0,
      kyc_status: 'none',
      role:       'user',
      code_parrain,
      ...(cleanEmail   ? { email:        cleanEmail  } : {}),
      ...(cleanParrain ? { parraine_par: cleanParrain } : {}),
    };

    let result;
    try {
      result = await supabaseRequest('POST', '/users', payloadFull);
    } catch (insertErr) {
      const msg = insertErr.message || '';
      if (msg.includes('email') && !msg.includes('code_parrain') && !msg.includes('parraine_par')) {
        /* Colonne email absente → retry sans email */
        const { email: _e, ...payloadNoEmail } = payloadFull;
        result = await supabaseRequest('POST', '/users', payloadNoEmail);
      } else if (msg.includes("Could not find") || msg.includes("column")) {
        /* Colonnes v2 absentes → fallback minimal */
        const payloadMin = {
          phone: fullPhone, prenom: prenom.trim(), nom: nom.trim(),
          pin_hash, epargne: 0, kyc_status: 'none', role: 'user',
        };
        result = await supabaseRequest('POST', '/users', payloadMin);
      } else {
        throw insertErr;
      }
    }

    const user = Array.isArray(result) ? result[0] : result;
    if (!user || !user.id) throw new Error('Utilisateur non créé en base');

    const token = createJWT({ userId: user.id, phone: user.phone, role: user.role });
    const { pin_hash: _ph, ...safeUser } = user;
    if (!safeUser.country) safeUser.country = country;

    /* ── Email de bienvenue (asynchrone, ne bloque pas) ── */
    if (cleanEmail && process.env.RESEND_API_KEY) {
      sendEmail({
        to:      cleanEmail,
        subject: `Bienvenue sur Epargn+, ${prenom.trim()} !`,
        html:    welcomeEmailHtml(prenom.trim(), fullPhone),
      }).then(r => console.log(`[register] welcome email to=${cleanEmail} ok=${r.ok}`))
        .catch(err => console.error('[register] welcome email error:', err.message));
    }

    return res.status(201).json({ token, user: safeUser });

  } catch (err) {
    console.error('[register] Erreur :', err.message);
    return res.status(500).json({ error: 'Erreur serveur. Réessayez dans quelques instants.' });
  }
};
