'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { adminApi } from '@/lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await adminApi.login(email, password)
      document.cookie = `admin_token=${token}; path=/; max-age=${60 * 60 * 8}; SameSite=Strict`
      router.push('/admin/dashboard')
    } catch (err) {
      setError((err as Error).message || 'Identifiants incorrects.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-lime rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-navy" />
          </div>
          <h1 className="text-white font-black text-2xl">Espace Admin</h1>
          <p className="text-white/40 text-sm mt-1">Epargn+ — Tableau de bord</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              placeholder="admin@epargnplus.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Mot de passe</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy text-white font-bold py-3 rounded-xl hover:bg-navy-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
