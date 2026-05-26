'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Smartphone, ArrowRight, RefreshCw } from 'lucide-react'
import { clientApi, setClientToken } from '@/lib/client-api'

type Step = 'phone' | 'otp'

export default function ClientLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)

  function startResendTimer() {
    setResendCountdown(60)
    const id = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) { clearInterval(id); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const normalized = phone.replace(/\s/g, '').replace(/^00/, '+')
      await clientApi.sendOtp(normalized)
      setPhone(normalized)
      setStep('otp')
      startResendTimer()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await clientApi.verifyOtp(phone, otp)
      setClientToken(token)
      router.push('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendCountdown > 0) return
    setError('')
    try {
      await clientApi.sendOtp(phone)
      startResendTimer()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-lime rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-navy font-black text-2xl">E+</span>
        </div>
        <h1 className="text-white font-black text-2xl tracking-tight">Epargn+</h1>
        <p className="text-white/40 text-sm mt-1">Votre épargne mobile en Guinée</p>
      </div>

      <div className="w-full max-w-sm">
        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h2 className="font-black text-navy text-lg">Connexion</h2>
              <p className="text-gray-500 text-sm mt-0.5">Entrez votre numéro pour recevoir un code</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Numéro de téléphone</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Smartphone size={16} className="text-gray-400" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  placeholder="+224 620 00 00 00"
                  autoComplete="tel"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Format : +224XXXXXXXXX ou 00224XXXXXXXXX</p>
            </div>

            <button
              type="submit"
              disabled={loading || !phone.trim()}
              className="w-full bg-navy text-white font-bold py-3 rounded-xl hover:bg-navy-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Envoi...' : <>Recevoir le code <ArrowRight size={16} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="bg-white rounded-2xl p-6 space-y-4 shadow-xl">
            <div>
              <h2 className="font-black text-navy text-lg">Code de vérification</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Code envoyé au <span className="font-medium text-navy">{phone}</span>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Code à 6 chiffres</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                placeholder="——————"
                autoFocus
                autoComplete="one-time-code"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-lime text-navy font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Vérification...' : 'Confirmer'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                ← Changer de numéro
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0}
                className="text-navy font-medium disabled:text-gray-300 flex items-center gap-1"
              >
                <RefreshCw size={13} />
                {resendCountdown > 0 ? `Renvoyer (${resendCountdown}s)` : 'Renvoyer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
