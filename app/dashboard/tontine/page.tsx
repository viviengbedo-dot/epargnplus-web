'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, TrendingUp, Shield, ArrowRight, Sparkles, Clock,
  Star, ChevronDown, ChevronUp, Calendar, Coins, CheckCircle2,
  AlertCircle, UserCheck, Lock,
} from 'lucide-react'

/* ─── Data ────────────────────────────────────────────── */
const HOW_IT_WORKS = [
  {
    num: '01',
    title: 'Formation du cercle',
    desc: '5 à 20 membres se regroupent. Chacun cotise un montant fixe chaque mois pendant toute la durée de la tontine.',
  },
  {
    num: '02',
    title: 'Tirage au sort équitable',
    desc: 'Chaque mois, un membre reçoit la cagnotte entière (montant × nombre de membres). Le tour passe jusqu\'au dernier.',
  },
  {
    num: '03',
    title: 'Bonus de fidélité',
    desc: 'Les membres qui cotisent sans faute reçoivent des points de fidélité et des bonus Epargn+ à la fin du cycle.',
  },
]

const FEATURES = [
  {
    icon: Shield,
    title: 'Fonds sécurisés',
    desc: 'Les cotisations sont conservées sur le compte Epargn+ de chaque membre. Aucun détournement possible.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: TrendingUp,
    title: 'Bonus de fidélité',
    desc: 'Participez régulièrement et débloquez des bonus sur votre épargne. Jusqu\'à +5% pour les membres assidus.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: UserCheck,
    title: 'Membres vérifiés',
    desc: 'Toutes les tontines requièrent une vérification KYC complète. Uniquement des membres de confiance.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Calendar,
    title: 'Calendrier garanti',
    desc: 'Les dates de versement sont automatiques et transparentes. Notifications avant chaque échéance.',
    color: 'bg-orange-50 text-orange-500',
  },
]

const TONTINES_PREVIEW = [
  {
    name: 'Tontine Famille Diallo',
    category: 'Familiale',
    members: '8/10',
    monthly: '50 000',
    totalPerTurn: '400 000',
    duration: '10 mois',
    nextTurn: '15 juil.',
    badge: 'Populaire',
    badgeColor: 'bg-lime/10 text-navy',
    filled: 80,
  },
  {
    name: 'Cercle Entrepreneurs Conakry',
    category: 'Professionnelle',
    members: '12/15',
    monthly: '200 000',
    totalPerTurn: '2 400 000',
    duration: '15 mois',
    nextTurn: '1er juil.',
    badge: 'Elite',
    badgeColor: 'bg-yellow-50 text-yellow-700',
    filled: 80,
  },
  {
    name: 'Épargne Hajj 2026',
    category: 'Religieuse',
    members: '6/20',
    monthly: '100 000',
    totalPerTurn: '2 000 000',
    duration: '20 mois',
    nextTurn: '1er août',
    badge: 'Nouveau',
    badgeColor: 'bg-blue-50 text-blue-600',
    filled: 30,
  },
]

const RULES = [
  'La cotisation mensuelle doit être déposée avant le 5 du mois.',
  'Un retard de plus de 3 jours entraîne la suspension temporaire.',
  'Le tirage du bénéficiaire est effectué le 1er du mois suivant.',
  'Les bonus de fidélité sont versés à la fin du cycle complet.',
  'Les litiges sont arbitrés par l\'équipe Epargn+ dans les 48h.',
]

/* ─── FAQ accordion item ──────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors">
        <span className="font-semibold text-navy text-sm pr-4">{q}</span>
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-gray-500 text-xs leading-relaxed border-t border-gray-50">{a}</div>
      )}
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────── */
export default function TontinePage() {
  const router = useRouter()

  return (
    <>
      {/* ── Hero ── */}
      <div className="bg-navy rounded-2xl p-6 text-white mb-4 shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-28 h-28 bg-lime/10 rounded-full" />
        <div className="absolute top-8 -right-2 w-16 h-16 bg-white/5 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-lime" />
            </div>
            <span className="bg-lime/20 text-lime text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={10} /> Bientôt disponible
            </span>
          </div>
          <h1 className="text-2xl font-black mb-2">Tontine Epargn+</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            L&apos;épargne collective intelligente. Formez ou rejoignez un cercle de confiance —
            cotisez ensemble, recevez à tour de rôle, grandissez plus vite.
          </p>
          <div className="flex gap-4 mt-4">
            <div className="text-center">
              <p className="text-lime font-black text-xl">5–20</p>
              <p className="text-white/40 text-xs">membres</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-lime font-black text-xl">+5%</p>
              <p className="text-white/40 text-xs">bonus fidélité</p>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <p className="text-lime font-black text-xl">100%</p>
              <p className="text-white/40 text-xs">sécurisé</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Waitlist banner ── */}
      <div className="bg-lime rounded-2xl p-4 flex items-center gap-3 mb-5 shadow-sm">
        <div className="w-10 h-10 bg-navy/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Clock size={18} className="text-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-navy text-sm">Lancement prévu T3 2026</p>
          <p className="text-navy/60 text-xs mt-0.5">Complétez votre profil pour être prioritaire à l&apos;ouverture.</p>
        </div>
        <button onClick={() => router.push('/dashboard/profile')}
          className="bg-navy text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 flex-shrink-0 hover:opacity-90 whitespace-nowrap">
          Mon profil <ArrowRight size={12} />
        </button>
      </div>

      {/* ── Comment ça marche ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-bold text-navy text-sm">Comment ça marche ?</p>
        </div>
        <div className="p-4 space-y-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.num} className="flex gap-3">
              <div className="w-8 h-8 bg-lime rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-navy font-black text-xs">{s.num}</span>
              </div>
              <div>
                <p className="font-bold text-navy text-sm">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Avantages ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {FEATURES.map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${color}`}>
              <Icon size={15} />
            </div>
            <p className="font-bold text-navy text-xs mb-1">{title}</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Tontines en aperçu ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-yellow-500" />
            <p className="font-bold text-navy text-sm">Tontines disponibles</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Lock size={11} />
            <span>Aperçu</span>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {TONTINES_PREVIEW.map((t) => (
            <div key={t.name} className="p-4 opacity-70 hover:opacity-80 transition-opacity">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-bold text-navy text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.category} · {t.duration}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${t.badgeColor}`}>{t.badge}</span>
              </div>
              {/* Progress */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>{t.members} membres</span>
                  <span>{t.filled}% remplie</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-lime rounded-full" style={{ width: `${t.filled}%` }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1 text-gray-500">
                  <Coins size={11} className="text-navy" />
                  <span><strong className="text-navy">{t.monthly}</strong> GNF/mois</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <TrendingUp size={11} className="text-green-600" />
                  <span>Cagnotte <strong className="text-navy">{t.totalPerTurn}</strong> GNF</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Calendar size={11} className="text-blue-500" />
                  <span>Prochain: <strong className="text-navy">{t.nextTurn}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-[#F5F5F7] border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Accès après vérification KYC complète</p>
        </div>
      </div>

      {/* ── Règles ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <AlertCircle size={14} className="text-orange-500" />
          <p className="font-bold text-navy text-sm">Règles de la tontine</p>
        </div>
        <div className="p-4 space-y-2.5">
          {RULES.map((rule, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle2 size={14} className="text-lime flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">{rule}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-3">Questions fréquentes</p>
        <FaqItem
          q="Que se passe-t-il si un membre ne cotise pas ?"
          a="Le membre défaillant est temporairement suspendu. Sa part est réservée et il doit régulariser sous 5 jours pour maintenir sa place dans la tontine."
        />
        <FaqItem
          q="Puis-je quitter une tontine en cours ?"
          a="Non. La tontine est un engagement solidaire. Vous pouvez toutefois demander un transfert de place à un autre membre vérifié sous condition d'approbation du cercle."
        />
        <FaqItem
          q="Comment est choisi l'ordre des bénéficiaires ?"
          a="L'ordre est tiré au sort au lancement du cycle, de façon transparente et aléatoire. Tous les membres voient le calendrier complet dès le départ."
        />
        <FaqItem
          q="Les fonds sont-ils bloqués ?"
          a="Non. Vos cotisations restent sur votre compte Epargn+ jusqu'au versement. Seul le montant de la cotisation mensuelle est prélevé à chaque échéance."
        />
      </div>

      {/* ── CTA final ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
        <div className="w-12 h-12 bg-lime/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Users size={22} className="text-navy" />
        </div>
        <p className="font-black text-navy text-base mb-1">Prêt à rejoindre une tontine ?</p>
        <p className="text-gray-400 text-sm mb-4 leading-relaxed">
          Vérifiez votre identité (KYC) dès maintenant pour être parmi les premiers à accéder
          à la Tontine Epargn+ à son lancement.
        </p>
        <button onClick={() => router.push('/dashboard/profile')}
          className="w-full bg-navy text-white font-bold py-3.5 rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          Compléter mon profil KYC <ArrowRight size={16} />
        </button>
        <button onClick={() => router.push('/dashboard/referral')}
          className="w-full mt-3 bg-lime/10 text-navy font-bold py-3 rounded-2xl hover:bg-lime/20 transition-colors flex items-center justify-center gap-2 text-sm">
          Inviter des amis pour ma tontine
        </button>
      </div>
    </>
  )
}
