'use client'
import { useRouter } from 'next/navigation'
import { Users, TrendingUp, Shield, ArrowRight, Sparkles, Clock, Star } from 'lucide-react'

const FEATURES = [
  {
    icon: Users,
    title: 'Epargne collective',
    desc: 'Rejoignez un cercle de confiance. Chaque membre cotise regulierement et recoit a tour de role la totalite de la cagnotte.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: TrendingUp,
    title: 'Bonus de fidelite',
    desc: 'Plus vous participez regulierement, plus vous gagnez des points de fidelite et des bonus speciaux sur votre epargne.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: Shield,
    title: 'Securite garantie',
    desc: 'Chaque tontine est supervisee par l\'equipe Epargn+. Les fonds sont securises et les paiements sont garantis.',
    color: 'bg-purple-50 text-purple-600',
  },
]

const OPPORTUNITIES = [
  {
    name: 'Tontine Immobiliere Dubai',
    members: '12/20',
    monthly: '500 000',
    total: '10 000 000',
    badge: 'Elite',
    badgeColor: 'bg-yellow-50 text-yellow-700',
    desc: 'Rejoignez ce cercle de 12 investisseurs',
  },
  {
    name: 'Strategie — Optimisation Fiscale 2025',
    members: '8/15',
    monthly: '200 000',
    total: '3 000 000',
    badge: 'Nouveau',
    badgeColor: 'bg-blue-50 text-blue-600',
    desc: 'Preparez vos projets de fin d\'annee',
  },
]

export default function TontinePage() {
  const router = useRouter()

  return (
    <>
      {/* Hero */}
      <div className="bg-navy rounded-2xl p-6 text-white mb-4 shadow-lg relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-28 h-28 bg-lime/10 rounded-full" />
        <div className="absolute top-8 -right-2 w-16 h-16 bg-white/5 rounded-full" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-lime" />
            </div>
            <span className="bg-lime/20 text-lime text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles size={10} /> Bientot disponible
            </span>
          </div>
          <h1 className="text-2xl font-black mb-1">Tontine Epargn+</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            L&apos;epargne collective intelligente. Formez ou rejoignez un cercle de confiance, cotisez ensemble, recuperez plus.
          </p>
        </div>
      </div>

      {/* Notification waitlist */}
      <div className="bg-lime rounded-2xl p-4 flex items-center gap-4 mb-4 shadow-sm">
        <div className="w-10 h-10 bg-navy/10 rounded-xl flex items-center justify-center flex-shrink-0">
          <Clock size={18} className="text-navy" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-navy text-sm">Lancement dans quelques semaines</p>
          <p className="text-navy/60 text-xs mt-0.5">Completez votre profil pour etre prioritaire a l&apos;ouverture.</p>
        </div>
        <button onClick={() => router.push('/dashboard/profile')}
          className="bg-navy text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 flex-shrink-0 hover:opacity-90">
          Profil <ArrowRight size={12} />
        </button>
      </div>

      {/* How it works */}
      <div className="space-y-3 mb-4">
        {FEATURES.map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="font-bold text-navy text-sm">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Opportunities Elite (preview) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-yellow-500" />
            <p className="font-bold text-navy text-sm">Opportunites Elite</p>
          </div>
          <span className="text-xs text-gray-400">Apercu</span>
        </div>
        <div className="divide-y divide-gray-50">
          {OPPORTUNITIES.map((o) => (
            <div key={o.name} className="px-4 py-3 opacity-60">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-navy">{o.name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${o.badgeColor}`}>{o.badge}</span>
              </div>
              <p className="text-xs text-gray-400 mb-2">{o.desc}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span><strong className="text-navy">{o.members}</strong> membres</span>
                <span><strong className="text-navy">{o.monthly}</strong> GNF/mois</span>
                <span>Total: <strong className="text-navy">{o.total}</strong> GNF</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 text-center">
            Disponible apres verification KYC
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center">
        <p className="font-bold text-navy mb-1">Pret pour la tontine ?</p>
        <p className="text-gray-400 text-sm mb-4">
          Verifiez votre identite (KYC) maintenant pour etre parmi les premiers a acceder a la Tontine Epargn+.
        </p>
        <button onClick={() => router.push('/dashboard/profile')}
          className="w-full bg-navy text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          Completer mon profil <ArrowRight size={16} />
        </button>
      </div>
    </>
  )
}
