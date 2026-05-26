'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Copy, Check, Edit2, X } from 'lucide-react'
import { clientApi, UserProfile } from '@/lib/client-api'

const KYC_LABELS: Record<string, string> = {
  none: 'Non vérifié',
  pending: 'En cours',
  verified: 'Vérifié',
}

const KYC_COLORS: Record<string, string> = {
  none: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-50 text-yellow-600',
  verified: 'bg-green-50 text-green-600',
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editName, setEditName] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    clientApi.profile()
      .then((p) => { setProfile(p); setName(p.name) })
      .catch(() => router.push('/dashboard/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await clientApi.updateProfile(name)
      setProfile((prev) => prev ? { ...prev, name } : prev)
      setEditName(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function copyReferral() {
    if (!profile?.referralCode) return
    navigator.clipboard.writeText(profile.referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm animate-pulse">
      Chargement...
    </div>
  )

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-black text-navy">Mon profil</h1>
      </div>

      {/* Avatar + name */}
      <div className="bg-navy rounded-2xl p-5 flex items-center gap-4 mb-4 shadow-lg">
        <div className="w-14 h-14 bg-lime rounded-2xl flex items-center justify-center flex-shrink-0">
          <User size={24} className="text-navy" />
        </div>
        <div className="flex-1 min-w-0">
          {editName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:bg-white/20 min-w-0"
                autoFocus
                maxLength={40}
              />
              <button type="submit" disabled={saving} className="text-lime hover:opacity-80">
                <Check size={16} />
              </button>
              <button type="button" onClick={() => { setEditName(false); setName(profile?.name ?? '') }} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-white font-bold truncate">
                {profile?.name || 'Sans nom'}
              </p>
              <button onClick={() => setEditName(true)} className="text-white/40 hover:text-white flex-shrink-0">
                <Edit2 size={13} />
              </button>
            </div>
          )}
          {error && <p className="text-red-300 text-xs mt-1">{error}</p>}
          <p className="text-white/50 text-sm">{profile?.phone}</p>
          <p className="text-white/30 text-xs mt-0.5">Membre depuis {profile?.memberSince}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="space-y-3">
        {/* KYC */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Vérification d&apos;identité (KYC)</p>
              <p className="text-sm font-bold text-navy mt-0.5">Niveau {profile?.kycTier ?? 0}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${KYC_COLORS[profile?.kycStatus ?? 'none']}`}>
              {KYC_LABELS[profile?.kycStatus ?? 'none']}
            </span>
          </div>
          {profile?.kycStatus !== 'verified' && (
            <p className="text-xs text-gray-400 mt-2">
              Vérifiez votre identité pour augmenter vos limites de transaction.
            </p>
          )}
        </div>

        {/* Balance */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Solde du compte</p>
          <p className="text-2xl font-black text-navy mt-1">
            {(profile?.balance ?? 0).toLocaleString('fr-FR')}
            <span className="text-base font-bold text-lime ml-1">GNF</span>
          </p>
        </div>

        {/* Referral */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium mb-2">Code de parrainage</p>
          <div className="flex items-center gap-2">
            <span className="flex-1 font-mono font-bold text-navy text-lg tracking-widest bg-gray-50 px-3 py-2 rounded-xl">
              {profile?.referralCode}
            </span>
            <button
              onClick={copyReferral}
              className={`p-2.5 rounded-xl transition-colors ${
                copied ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Partagez votre code et gagnez des bonus de parrainage.
          </p>
        </div>
      </div>
    </>
  )
}
