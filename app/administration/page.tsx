'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function AdministrationLoginPage() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/administration/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Clé invalide — accès refusé.')
        return
      }
      router.push('/administration/dashboard')
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1668] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 bg-[#C9E000] rounded-2xl flex items-center justify-center mb-5 shadow-lg">
          <span className="text-[#0B1668] font-black text-2xl">E+</span>
        </div>
        <h1 className="text-white font-black text-3xl tracking-tight">Espace Administration</h1>
        <p className="text-white/40 text-sm mt-2">Accès réservé aux administrateurs Epargn+</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-2xl mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-3">
              Clé d&apos;administration
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-4 text-white text-base font-mono tracking-wider placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-[#C9E000]/40 focus:border-[#C9E000]/60 pr-12"
                placeholder="••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !key}
            className="w-full bg-[#C9E000] text-[#0B1668] font-black py-4 rounded-2xl text-base hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Vérification...' : 'Accéder au tableau de bord →'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-white/25 text-xs mt-8 flex items-center gap-2">
        <span>🔒</span>
        <span>Connexion chiffrée · Accès protégé</span>
      </p>
    </div>
  )
}
