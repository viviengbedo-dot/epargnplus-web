'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Copy, Check, Shield, Lock,
  Camera, FileText, AlertCircle, Eye, EyeOff,
} from 'lucide-react'
import { clientApi, UserProfile, KycDoc } from '@/lib/client-api'

// ─── helpers ──────────────────────────────────────────────────────────────────

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function compressImage(file: File, maxW = 900, q = 0.78): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        res(canvas.toDataURL('image/jpeg', q))
      }
      img.onerror = rej
      img.src = e.target?.result as string
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

const KYC_COLORS: Record<string, string> = {
  none:     'bg-gray-100 text-gray-500',
  pending:  'bg-yellow-50 text-yellow-600',
  verified: 'bg-green-50 text-green-600',
}
const KYC_LABELS: Record<string, string> = {
  none:     'Non verifie',
  pending:  'En cours de verification',
  verified: 'Identite verifiee',
}

type Tab = 'profil' | 'kyc' | 'securite'

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile]   = useState<UserProfile | null>(null)
  const [kycDocs, setKycDocs]   = useState<KycDoc[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<Tab>('profil')
  const [copied, setCopied]     = useState(false)

  useEffect(() => {
    Promise.all([clientApi.profile(), clientApi.kycDocs()])
      .then(([p, docs]) => { setProfile(p); setKycDocs(docs) })
      .catch(() => router.push('/dashboard/login'))
      .finally(() => setLoading(false))
  }, [router])

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
  if (!profile) return null

  return (
    <>
      {/* Header card */}
      <div className="bg-navy rounded-2xl p-5 flex items-center gap-4 mb-4 shadow-lg">
        <div className="w-14 h-14 bg-lime rounded-2xl flex items-center justify-center flex-shrink-0">
          <User size={24} className="text-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold truncate">{profile.name || 'Sans nom'}</p>
          <p className="text-white/50 text-sm">{profile.phone}</p>
          <p className="text-white/30 text-xs mt-0.5">Membre depuis {profile.memberSince}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${KYC_COLORS[profile.kycStatus]}`}>
          {profile.kycStatus === 'verified' ? 'Verifie' : profile.kycStatus === 'pending' ? 'En cours' : 'Non verifie'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
        {([
          { id: 'profil',   label: 'Mon profil',   icon: User   },
          { id: 'kyc',      label: 'Verification', icon: Shield },
          { id: 'securite', label: 'Securite',     icon: Lock   },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl transition-colors ${
              tab === id ? 'bg-white text-navy shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'profil'   && <TabProfil   profile={profile} setProfile={setProfile} />}
      {tab === 'kyc'      && <TabKYC      profile={profile} setProfile={setProfile} kycDocs={kycDocs} setKycDocs={setKycDocs} />}
      {tab === 'securite' && <TabSecurite phone={profile.phone} referralCode={profile.referralCode} copied={copied} onCopy={copyReferral} />}
    </>
  )
}

// ─── Tab Profil ───────────────────────────────────────────────────────────────

function TabProfil({
  profile, setProfile,
}: {
  profile: UserProfile
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>
}) {
  const [form, setForm] = useState({
    name:          profile.name || '',
    birthDate:     profile.birthDate || '',
    city:          profile.city || '',
    profession:    profile.profession || '',
    monthlyIncome: profile.monthlyIncome?.toString() || '',
  })
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  function set(field: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [field]: val }))
    setSuccess(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await clientApi.updateProfileFull({
        name:          form.name.trim(),
        birthDate:     form.birthDate || null,
        city:          form.city.trim(),
        profession:    form.profession.trim(),
        monthlyIncome: form.monthlyIncome ? parseFloat(form.monthlyIncome) : null,
      })
      setProfile((p) => p ? {
        ...p,
        name:          form.name.trim(),
        birthDate:     form.birthDate || null,
        city:          form.city.trim(),
        profession:    form.profession.trim(),
        monthlyIncome: form.monthlyIncome ? parseFloat(form.monthlyIncome) : null,
      } : p)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-100 text-green-600 text-sm px-3 py-2 rounded-xl flex items-center gap-2">
          <Check size={14} /> Profil mis a jour
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informations personnelles</p>

        <Field label="Prenom / Nom complet">
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
            maxLength={60} placeholder="Ex: Mamadou Diallo"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
        </Field>

        <Field label="Date de naissance">
          <input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
        </Field>

        <Field label="Ville de residence">
          <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)}
            maxLength={60} placeholder="Ex: Conakry"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
        </Field>

        <Field label="Profession / Activite">
          <input type="text" value={form.profession} onChange={(e) => set('profession', e.target.value)}
            maxLength={80} placeholder="Ex: Commercant, Fonctionnaire, Etudiant..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
        </Field>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenus</p>
        <Field label="Revenu mensuel estime (GNF)">
          <input type="number" min="0" step="10000" value={form.monthlyIncome}
            onChange={(e) => set('monthlyIncome', e.target.value)}
            placeholder="Ex: 2 000 000"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
        </Field>
        <p className="text-xs text-gray-400">
          Utilise uniquement par votre coach IA pour suggerer un rythme d&apos;epargne. Non partage.
        </p>
      </div>

      <button type="submit" disabled={saving}
        className="w-full bg-navy text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity">
        {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
      </button>
    </form>
  )
}

// ─── Tab KYC ──────────────────────────────────────────────────────────────────

const DOC_INFO = {
  id_card:       { label: "Carte d'identite nationale", hint: "Recto de votre CNI ou passeport" },
  selfie:        { label: "Selfie avec votre piece",    hint: "Tenez votre piece a cote de votre visage" },
  proof_address: { label: "Justificatif de domicile",   hint: "Facture eau/electricite ou attestation (optionnel)" },
} as const

function TabKYC({
  profile, setProfile, kycDocs, setKycDocs,
}: {
  profile: UserProfile
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>
  kycDocs: KycDoc[]
  setKycDocs: React.Dispatch<React.SetStateAction<KycDoc[]>>
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const idCardRef  = useRef<HTMLInputElement>(null)
  const selfieRef  = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const refs = { id_card: idCardRef, selfie: selfieRef, proof_address: addressRef }

  const docMap = Object.fromEntries(kycDocs.map((d) => [d.type, d]))

  async function handleFile(type: keyof typeof DOC_INFO, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Fichier image requis (jpg, png...)'); return }
    setError(''); setSuccess(''); setUploading(type)
    try {
      const compressed = await compressImage(file)
      if (compressed.length > 1_800_000) {
        setError('Image trop grande. Choisissez une photo plus legere.')
        return
      }
      await clientApi.submitKycDoc(type, compressed)
      const [updatedDocs, updatedProfile] = await Promise.all([clientApi.kycDocs(), clientApi.profile()])
      setKycDocs(updatedDocs)
      setProfile(updatedProfile)
      setSuccess('Document soumis avec succes !')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl p-4 flex items-start gap-3 ${KYC_COLORS[profile.kycStatus]}`}>
        <Shield size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm">{KYC_LABELS[profile.kycStatus]}</p>
          {profile.kycStatus === 'none' && (
            <p className="text-xs mt-0.5 opacity-80">
              Soumettez votre piece d&apos;identite et un selfie pour debloquer des limites plus elevees.
            </p>
          )}
          {profile.kycStatus === 'pending' && (
            <p className="text-xs mt-0.5 opacity-80">
              Documents en cours de verification (24-48h). Vous serez notifie.
            </p>
          )}
          {profile.kycStatus === 'verified' && (
            <p className="text-xs mt-0.5 opacity-80">Niveau {profile.kycTier} — limites augmentees.</p>
          )}
        </div>
      </div>

      {error   && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
      {success && <div className="bg-green-50 border border-green-100 text-green-600 text-sm px-3 py-2 rounded-xl flex items-center gap-2"><Check size={14} />{success}</div>}

      <div className="space-y-3">
        {(Object.keys(DOC_INFO) as (keyof typeof DOC_INFO)[]).map((type) => {
          const info      = DOC_INFO[type]
          const doc       = docMap[type]
          const isOpt     = type === 'proof_address'
          const isLoading = uploading === type

          return (
            <div key={type} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center ${
                    doc ? (doc.verified ? 'bg-green-50' : 'bg-yellow-50') : 'bg-gray-50'
                  }`}>
                    <FileText size={15} className={doc ? (doc.verified ? 'text-green-600' : 'text-yellow-600') : 'text-gray-400'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">
                      {info.label}
                      {isOpt && <span className="text-gray-400 font-normal text-xs ml-1">(optionnel)</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{info.hint}</p>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {doc ? (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                        doc.verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {doc.verified ? 'Verifie' : 'En attente'}
                      </span>
                      {!doc.verified && profile.kycStatus !== 'verified' && (
                        <button onClick={() => refs[type].current?.click()} disabled={!!uploading}
                          className="text-xs text-gray-400 hover:text-navy underline">
                          Remplacer
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => refs[type].current?.click()}
                      disabled={!!uploading || profile.kycStatus === 'verified'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {isLoading
                        ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                        : <Camera size={13} />}
                      {isLoading ? 'Envoi...' : 'Ajouter'}
                    </button>
                  )}
                </div>
              </div>

              <input ref={refs[type]} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={(e) => handleFile(type, e)} />
            </div>
          )
        })}
      </div>

      {(!docMap['id_card'] || !docMap['selfie']) && (
        <p className="text-xs text-gray-400 text-center px-4">
          La piece d&apos;identite et le selfie sont obligatoires pour soumettre le KYC.
        </p>
      )}
    </div>
  )
}

// ─── Tab Securite ─────────────────────────────────────────────────────────────

function TabSecurite({
  phone, referralCode, copied, onCopy,
}: {
  phone: string
  referralCode: string
  copied: boolean
  onCopy: () => void
}) {
  const [pin, setPin]           = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [showPin, setShowPin]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  async function handleChangePIN(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(pin)) { setError('Le code PIN doit contenir exactement 6 chiffres.'); return }
    if (pin !== pinConfirm)   { setError('Les deux codes ne correspondent pas.'); return }
    setSaving(true)
    try {
      const pinHash = await sha256Hex(pin)
      await clientApi.changePIN(pinHash)
      setSuccess(true); setPin(''); setPinConfirm('')
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-navy" />
          <p className="font-bold text-navy">Code PIN de l&apos;application</p>
        </div>

        {error   && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl flex items-center gap-2 mb-3"><AlertCircle size={14} />{error}</div>}
        {success && <div className="bg-green-50 border border-green-100 text-green-600 text-sm px-3 py-2 rounded-xl flex items-center gap-2 mb-3"><Check size={14} />Code PIN mis a jour !</div>}

        <form onSubmit={handleChangePIN} className="space-y-3">
          <Field label="Nouveau code PIN (6 chiffres)">
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
              <button type="button" onClick={() => setShowPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Field label="Confirmer le code PIN">
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
              value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
            />
          </Field>

          <button type="submit" disabled={saving || pin.length !== 6 || pinConfirm.length !== 6}
            className="w-full bg-navy text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity">
            {saving ? 'Mise a jour...' : 'Changer le PIN'}
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">
          Utilise dans l&apos;application mobile. Chiffre avant envoi — jamais stocke en clair.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Connexion</p>
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
            <User size={14} className="text-navy" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Numero de telephone</p>
            <p className="font-bold text-navy text-sm">{phone}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Compte protege par code OTP SMS a chaque connexion.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400 font-medium mb-2">Code de parrainage</p>
        <div className="flex items-center gap-2">
          <span className="flex-1 font-mono font-bold text-navy text-lg tracking-widest bg-gray-50 px-3 py-2 rounded-xl">
            {referralCode}
          </span>
          <button onClick={onCopy}
            className={`p-2.5 rounded-xl transition-colors ${copied ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Partagez et gagnez des bonus de parrainage.</p>
      </div>
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-navy mb-1.5">{label}</label>
      {children}
    </div>
  )
}
