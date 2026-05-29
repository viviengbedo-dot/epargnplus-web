'use client'
import { useState } from 'react'
import { Settings, Save, Eye, EyeOff } from 'lucide-react'

export default function SettingsPage() {
  const [showKey, setShowKey] = useState(false)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0B1668]">Paramètres</h1>
        <p className="text-gray-400 text-sm mt-0.5">Configuration de la plateforme Epargn+</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Admin access */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#0B1668]/10 rounded-xl flex items-center justify-center">
              <Settings size={18} className="text-[#0B1668]" />
            </div>
            <div>
              <h3 className="font-bold text-[#0B1668] text-sm">Accès administrateur</h3>
              <p className="text-xs text-gray-400">Clé d&apos;administration et identifiants</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Clé d&apos;administration</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  defaultValue="EPARGN2026"
                  readOnly
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono text-gray-600 pr-10 focus:outline-none"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Modifiable via la variable d&apos;environnement <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">ADMIN_KEY</code> sur Vercel.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Email admin (backend)</label>
              <input
                type="email"
                defaultValue="admin@epargnplus.com"
                readOnly
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* API Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-[#C9E000]/20 rounded-xl flex items-center justify-center">
              <span className="text-[#0B1668] font-black text-sm">API</span>
            </div>
            <div>
              <h3 className="font-bold text-[#0B1668] text-sm">Configuration API</h3>
              <p className="text-xs text-gray-400">Endpoints et services externes</p>
            </div>
          </div>

          <div className="space-y-3">
            <InfoRow label="API Backend" value="https://epargnplus-api.onrender.com/v1" />
            <InfoRow label="Base de données" value="Supabase PostgreSQL" />
            <InfoRow label="SMS OTP" value="Africa's Talking" />
            <InfoRow label="Déploiement web" value="Vercel (epargnplus-web.vercel.app)" />
            <InfoRow label="Hébergement API" value="Render (srv-d8asm8jbc2fs739ah0vg)" />
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-[#0B1668] text-sm mb-4">Mode maintenance</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-700">Maintenance globale</p>
              <p className="text-xs text-gray-400 mt-0.5">Désactive l&apos;accès à l&apos;app client</p>
            </div>
            <div className="w-11 h-6 bg-gray-200 rounded-full relative cursor-not-allowed opacity-60">
              <div className="w-4 h-4 bg-white rounded-full shadow absolute top-1 left-1" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Fonctionnalité disponible prochainement.</p>
        </div>

        {/* Version */}
        <div className="bg-[#0B1668] rounded-2xl p-6 text-white">
          <div className="w-10 h-10 bg-[#C9E000] rounded-xl flex items-center justify-center mb-4">
            <span className="text-[#0B1668] font-black text-sm">E+</span>
          </div>
          <h3 className="font-bold text-lg">Epargn+</h3>
          <p className="text-white/50 text-xs mt-1">Plateforme d&apos;épargne mobile — Guinée</p>
          <div className="mt-4 space-y-1">
            <p className="text-xs text-white/30">Version <span className="text-white/70">1.0.0</span></p>
            <p className="text-xs text-white/30">Panneau admin <span className="text-white/70">v2.0 — Next.js 14</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-600 text-right break-all">{value}</span>
    </div>
  )
}
