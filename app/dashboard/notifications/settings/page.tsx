'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, ArrowLeft, ArrowDownLeft, ArrowUpRight,
  Target, Users, Gift, Megaphone, Shield, Info,
} from 'lucide-react'

/* ─── Types ──────────────────────────────────────────── */
interface NotifPref {
  id: string
  label: string
  description: string
  icon: React.ElementType
  iconBg: string
  enabled: boolean
}

const DEFAULT_PREFS: NotifPref[] = [
  {
    id: 'deposits',
    label: 'Dépôts confirmés',
    description: 'Recevoir une notification à chaque dépôt réussi sur votre compte.',
    icon: ArrowDownLeft,
    iconBg: 'bg-green-50 text-green-600',
    enabled: true,
  },
  {
    id: 'withdrawals',
    label: 'Retraits traités',
    description: 'Être notifié dès que votre retrait Mobile Money est traité.',
    icon: ArrowUpRight,
    iconBg: 'bg-orange-50 text-orange-500',
    enabled: true,
  },
  {
    id: 'projects',
    label: 'Objectifs d\'épargne',
    description: 'Rappels de progression et alertes quand un objectif est atteint.',
    icon: Target,
    iconBg: 'bg-blue-50 text-blue-600',
    enabled: true,
  },
  {
    id: 'tontine',
    label: 'Tontine & collectifs',
    description: 'Alertes sur les tours de cotisation, nouveaux membres et versements.',
    icon: Users,
    iconBg: 'bg-purple-50 text-purple-600',
    enabled: true,
  },
  {
    id: 'referral',
    label: 'Parrainage & bonus',
    description: 'Notification lorsqu\'un filleul s\'inscrit et vous rapporte un bonus.',
    icon: Gift,
    iconBg: 'bg-lime/10 text-navy',
    enabled: true,
  },
  {
    id: 'promotions',
    label: 'Offres & promotions',
    description: 'Actualités, nouvelles fonctionnalités et offres spéciales Epargn+.',
    icon: Megaphone,
    iconBg: 'bg-yellow-50 text-yellow-600',
    enabled: false,
  },
  {
    id: 'security',
    label: 'Sécurité & connexion',
    description: 'Alertes de connexion suspecte, changement de PIN et vérification.',
    icon: Shield,
    iconBg: 'bg-red-50 text-red-500',
    enabled: true,
  },
]

/* ─── Toggle component ───────────────────────────────── */
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
        enabled ? 'bg-lime' : 'bg-gray-200'
      }`}
      aria-label={enabled ? 'Désactiver' : 'Activer'}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/* ─── Page ───────────────────────────────────────────── */
export default function NotificationSettingsPage() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<NotifPref[]>(DEFAULT_PREFS)
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [saved, setSaved] = useState(false)

  /* Load saved prefs from localStorage */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('notif_prefs')
      if (raw) {
        const stored: Record<string, boolean> = JSON.parse(raw)
        setPrefs((p) => p.map((x) => ({ ...x, enabled: stored[x.id] ?? x.enabled })))
      }
      const globalRaw = localStorage.getItem('notif_global')
      if (globalRaw !== null) setGlobalEnabled(JSON.parse(globalRaw))
    } catch { /* ignore */ }
  }, [])

  function toggle(id: string, value: boolean) {
    setPrefs((p) => p.map((x) => x.id === id ? { ...x, enabled: value } : x))
  }

  function savePrefs() {
    const map: Record<string, boolean> = {}
    prefs.forEach((p) => { map[p.id] = p.enabled })
    localStorage.setItem('notif_prefs', JSON.stringify(map))
    localStorage.setItem('notif_global', JSON.stringify(globalEnabled))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleAll(val: boolean) {
    setGlobalEnabled(val)
    if (!val) setPrefs((p) => p.map((x) => ({ ...x, enabled: false })))
    else setPrefs(DEFAULT_PREFS)
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={18} className="text-navy" />
        </button>
        <div>
          <h1 className="text-xl font-black text-navy leading-tight">Notifications</h1>
          <p className="text-xs text-gray-400">Personnalisez vos alertes</p>
        </div>
      </div>

      {/* Global toggle */}
      <div className="bg-navy rounded-2xl p-5 mb-5 flex items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-lime" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Toutes les notifications</p>
            <p className="text-white/50 text-xs mt-0.5">
              {globalEnabled ? 'Notifications activées' : 'Notifications désactivées'}
            </p>
          </div>
        </div>
        <Toggle enabled={globalEnabled} onChange={toggleAll} />
      </div>

      {/* Info banner */}
      {!globalEnabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <Info size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-yellow-700 text-xs leading-relaxed">
            Toutes les notifications sont désactivées. Activez le bouton ci-dessus pour
            personnaliser vos préférences.
          </p>
        </div>
      )}

      {/* Per-category prefs */}
      <div className={`space-y-2 transition-opacity ${globalEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-3">
          Par catégorie
        </p>
        {prefs.map(({ id, label, description, icon: Icon, iconBg, enabled }) => (
          <div
            key={id}
            className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-navy">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
            </div>
            <Toggle enabled={enabled} onChange={(v) => toggle(id, v)} />
          </div>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={savePrefs}
        className={`w-full mt-6 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-sm ${
          saved
            ? 'bg-green-500 text-white'
            : 'bg-navy text-white hover:opacity-90'
        }`}
      >
        {saved ? '✓ Préférences enregistrées' : 'Enregistrer mes préférences'}
      </button>

      {/* Push permission note */}
      <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed px-4">
        Les notifications push dépendent des paramètres de votre navigateur. Assurez-vous
        d&apos;avoir autorisé les notifications pour ce site.
      </p>
    </>
  )
}
