/**
 * POST /api/auth/register — Epargn+ v5
 * Crée un nouveau compte après vérification OTP.
 * Supporte : Guinée (+224), Bénin (+229), Côte d'Ivoire (+225), Chine (+86)
 */

const crypto = require('crypto');
const { supabaseRequest } = require('../_lib/supabase');
const { hashPin, createJWT } = require('../_lib/auth');
const { sendEmail, welcomeEmailHtml } = require('../_lib/email');

const OTP_SECRET = process.env.OTP_SECRET || 'epargn-otp-dev-secret-change-me';
const OTP_TTL_MS = 10 * 60 * 1000;

/* ── Configuration multi-pays ── */
const COUNTRY_CONFIG = {
  gn: {
    name: 'Guinée',
    prefix: '+224',
    phoneMinLen: 8,
    phoneMaxLen: 9,
    operators: ['orange', 'mtn', 'wave'],
    currency: 'GNF',
  },
  bj: {
    name: 'Bénin',
    prefix: '+229',
    phoneMinLen: 8,
    phoneMaxLen: 10,
    operators: ['mtn', 'moov', 'wave', 'celtiis'],
    currency: 'FCFA',
  },
  ci: {
    name: "Côte d'Ivoire",
    prefix: '+225',
    phoneMinLen: 10,
    phoneMaxLen: 10,
    operators: ['orange', 'mtn', 'moov', 'wave', 'coris'],
    currency: 'XOF',
  },
  cn: {
    name: 'Chine',
    prefix: '+86',
    phoneMinLen: 11,
    phoneMaxLen: 11,
    operators: ['alipay', 'wechatpay'],
    currency: 'CNY',
  },
};

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function generateReferralCode(prenom) {
  const prefix = (prenom || 'USR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return prefix + random;
}

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Méthode non autorisée' });

  const body = await parseBody(req);
  const {
    phone, country = 'gn', prenom, nom, operator, pin,
    otp_token, otp_code, email, parraine_par, alipay_id,
  } = body;

  const countryCfg = COUNTRY_CONFIG[country];
  if (!countryCfg) {
    return res.status(400).json({ error: 'Pays invalide. Choisissez : gn, bj, ci ou cn.' });
  }

  if (!phone || !prenom || !nom || !pin) {
    return res.status(400).json({ error: 'Champs requis manquants (phone, prenom, nom, pin)' });
  }
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'Le PIN doit contenir exactement 4 chiffres' });
  }

  const resolvedOperator = (operator && countryCfg.operators.includes(operator))
    ? operator
    : countryCfg.operators[0];

  const localPhone = phone.replace(/[\s\-\.]/g, '');
  if (!/^\d+$/.test(localPhone) || localPhone.length < countryCfg.phoneMinLen || localPhone.length > countryCfg.phoneMaxLen) {
    return res.status(400).json({ error: `Numéro de téléphone invalide pour ${countryCfg.name}` });
  }

  /* Vérifier que l'utilisateur n'a pas inclus l'indicatif d'un autre pays */
  for (const [code, cfg] of Object.entries(COUNTRY_CONFIG)) {
    if (code !== country && localPhone.startsWith(cfg.prefix.slice(1))) {
      return res.status(400).json({
        error: `Ne pas inclure l'indicatif pays dans le numéro. Entrez uniquement les chiffres locaux sans le ${cfg.prefix}.`,
      });
    }
  }

  const fullPhone = countryCfg.prefix + localPhone;

  /* ── Vérification OTP ── */
  if (!verifyOTPToken(otp_code, fullPhone, otp_token)) {
    return res.status(400).json({ error: 'Code OTP invalide ou expiré. Demandez un nouveau code.' });
  }

  const cleanEmail   = (email      || '').trim().toLowerCase() || null;
  const cleanParrain = (parraine_par || '').trim().toUpperCase() || null;
  const cleanAlipay  = (alipay_id  || '').trim() || null;

  try {
    const existing = await supabaseRequest('GET',
      '/users?phone=eq.' + encodeURIComponent(fullPhone) + '&select=id');
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ error: 'Ce numéro est déjà enregistré. Connectez-vous.' });
    }

    if (cleanEmail) {
      try {
        const emailCheck = await supabaseRequest('GET',
          '/users?email=eq.' + encodeURIComponent(cleanEmail) + '&select=id');
        if (Array.isArray(emailCheck) && emailCheck.length > 0) {
          return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
        }
      } catch (_) {}
    }

    const pin_hash     = hashPin(pin);
    const code_parrain = generateReferralCode(prenom);
    const payloadFull  = {
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
      currency:   countryCfg.currency,
      ...(cleanEmail   ? { email:        cleanEmail  } : {}),
      ...(cleanParrain ? { parraine_par: cleanParrain } : {}),
      ...(cleanAlipay  ? { alipay_id:    cleanAlipay  } : {}),
    };

    /* Payload minimal compatible avec tout schéma (sans colonnes optionnelles) */
    const payloadMin = {
      phone: fullPhone, prenom: prenom.trim(), nom: nom.trim(),
      pin_hash, epargne: 0, role: 'user',
      ...(country ? { country } : {}),
    };

    let result;
    try {
      result = await supabaseRequest('POST', '/users', payloadFull);
    } catch (insertErr) {
      const msg = insertErr.message || '';
      console.warn('[register] insert full échoué :', msg, '| country:', country);

      if (msg.includes('duplicate') || msg.includes('unique')) {
        /* Collision code_parrain — regénérer et réessayer */
        try {
          const payloadRetry = {
            ...payloadFull,
            code_parrain: generateReferralCode(prenom) + Math.random().toString(36).slice(2,4).toUpperCase(),
          };
          result = await supabaseRequest('POST', '/users', payloadRetry);
        } catch {
          /* Même collision : tenter le payload minimal */
          result = await supabaseRequest('POST', '/users', payloadMin);
        }
      } else {
        /* Colonne manquante, contrainte check, type incompatible, etc. → minimal */
        console.warn('[register] tentative payload minimal pour:', country);
        result = await supabaseRequest('POST', '/users', payloadMin);
      }
    }

    const user = Array.isArray(result) ? result[0] : result;
    if (!user || !user.id) throw new Error('Utilisateur non créé en base');

    const token = createJWT({ userId: user.id, phone: user.phone, role: user.role });
    const { pin_hash: _ph, ...safeUser } = user;
    if (!safeUser.country) safeUser.country = country;
    if (!safeUser.currency) safeUser.currency = countryCfg.currency;

    /* Email de bienvenue via moteur v7 */
    if (cleanEmail) {
      const { trigger: emailTrigger } = require('../_lib/email');
      const countryLabels = { gn:'Guinée', bj:'Bénin', ci:"Côte d'Ivoire", cn:'Chine' };
      emailTrigger('welcome', user.id, {
        prenom:       prenom.trim(),
        phone:        fullPhone,
        country:      country,
        countryLabel: countryLabels[country] || '',
      }, cleanEmail).catch(() => {});
    }

    return res.status(201).json({ token, user: safeUser });

  } catch (err) {
    console.error('[register] Erreur :', err.message, '| country:', country, '| phone:', fullPhone ? fullPhone.slice(0, 5) + '***' : 'inconnu');
    return res.status(500).json({ error: 'Erreur serveur. Réessayez dans quelques instants.' });
  }
};
