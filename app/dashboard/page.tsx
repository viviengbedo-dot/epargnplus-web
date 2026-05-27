'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft, ArrowUpRight, Target, ChevronRight,
  TrendingUp, Plus, Smartphone,
} from 'lucide-react'
import { clientApi, UserProfile, Transaction, Project } from '@/lib/client-api'

/* ─── Helpers ─────────────────────────────────────────── */
function fmtGNF(v: number) { return v.toLocaleString('fr-FR') + ' GNF' }

function txColor(type: Transaction['type']) {
  if (type === 'deposit' || type === 'bonus') return 'text-green-600'
  if (type === 'withdrawal') return 'text-orange-500'
  return 'text-blue-500'
}
function txSign(type: Transaction['type']) {
  return type === 'deposit' || type === 'bonus' ? '+' : '-'
}

/* ─── Semicircular Gauge ──────────────────────────────── */
function SemiGauge({ pct }: { pct: number }) {
  const r = 70
  const cx = 90
  const cy = 90
  const strokeW = 14
  // Arc from 180° to 0° (left to right) = half circle
  const circumference = Math.PI * r // semicircle arc length
  const filled = Math.min(pct / 100, 1) * circumference

  // SVG path for a semicircle arc
  function describeArc(startDeg: number, endDeg: number) {
    const toRad = (d: number) => (d * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startDeg))
    const y1 = cy + r * Math.sin(toRad(startDeg))
    const x2 = cx + r * Math.cos(toRad(endDeg))
    const y2 = cy + r * Math.sin(toRad(endDeg))
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  }

  const trackPath = describeArc(180, 0)
  const fillEnd = 180 - pct * 1.8   // 180° → 0° = 180 total degrees
  const fillPath = pct > 0 ? describeArc(180, Math.max(fillEnd, 180 - Math.min(pct, 100) * 1.8)) : ''

  return (
    <svg viewBox="0 0 180 100" className="w-full max-w-[200px] mx-auto">
      {/* Track */}
      <path d={trackPath} fill="none" stroke="#E8E8F8" strokeWidth={strokeW} strokeLinecap="round" />
      {/* Fill */}
      {pct > 0 && (
        <path d={fillPath} fill="none" stroke="#C9E000" strokeWidth={strokeW} strokeLinecap="round" />
      )}
      {/* Percentage text */}
      <text x={cx} y={cy - 4} textAnchor="middle" className="font-black" fontSize="22" fontWeight="900" fill="#0B1668">
        {Math.round(pct)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#6B7280">
        de votre objectif
      </text>
    </svg>
  )
}

/* ─── Page ────────────────────────────────────────────── */
export default function DashboardHome() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([clientApi.profile(), clientApi.transactions(), clientApi.projects()])
      .then(([p, tx, pr]) => {
        setProfile(p)
        setTransactions(tx.slice(0, 5))
        setProjects(pr.filter((p) => p.status === 'ACTIVE').slice(0, 3))
      })
      .catch(() => router.push('/dashboard/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm animate-pulse">
        Chargement…
      </div>
    )
  }

  /* Global savings progress */
  const totalGoal = projects.reduce((s, p) => s + p.goalAmount, 0)
  const totalSaved = projects.reduce((s, p) => s + p.currentAmount, 0)
  const globalPct = totalGoal > 0 ? (totalSaved / totalGoal) * 100 : 0

  return (
    <>
      {/* ── Balance card ── */}
      <div className="bg-navy rounded-2xl p-5 text-white mb-4 shadow-lg relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-lime/10 rounded-full" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide">Solde disponible</p>
            <div className="flex items-center gap-1 text-white/30 text-xs">
              <TrendingUp size={11} />
              <span>Membre depuis {profile?.memberSince}</span>
            </div>
          </div>
          <div className="flex items-end gap-2 mb-4">
            <p className="text-4xl font-black tracking-tight">
              {(profile?.balance ?? 0).toLocaleString('fr-FR')}
            </p>
            <p className="text-lime text-base font-bold mb-1">GNF</p>
          </div>
          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/dashboard/deposit')}
              className="bg-lime text-navy rounded-xl py-3 flex items-center justify-center gap-2 font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <ArrowDownLeft size={16} /> Déposer
            </button>
            <button
              onClick={() => router.push('/dashboard/withdraw')}
              className="bg-white/10 text-white rounded-xl py-3 flex items-center justify-center gap-2 font-medium text-sm hover:bg-white/20 transition-colors border border-white/10"
            >
              <ArrowUpRight size={16} /> Retirer
            </button>
          </div>
        </div>
      </div>

      {/* ── Savings Progress Gauge ── */}
      {projects.length > 0 && (
        <div className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
          <p className="font-bold text-navy text-sm mb-1">Progression globale</p>
          <p className="text-gray-400 text-xs mb-3">Total de vos objectifs d&apos;épargne actifs</p>

          <SemiGauge pct={globalPct} />

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Épargné</p>
              <p className="font-black text-navy text-sm mt-0.5">{totalSaved.toLocaleString('fr-FR')} GNF</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Objectif</p>
              <p className="font-black text-navy text-sm mt-0.5">{totalGoal.toLocaleString('fr-FR')} GNF</p>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Restant</p>
              <p className="font-black text-lime text-sm mt-0.5">{Math.max(0, totalGoal - totalSaved).toLocaleString('fr-FR')} GNF</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Active projects ── */}
      {projects.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-navy text-sm">Projets d&apos;épargne</h2>
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="text-xs text-navy/60 hover:text-navy flex items-center gap-0.5"
            >
              Voir tout <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {projects.map((p) => {
              const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{p.icon || '🎯'}</span>
                      <span className="text-sm font-medium text-navy">{p.name}</span>
                    </div>
                    <span className="text-xs font-bold text-navy">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#22c55e' : '#C9E000',
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-400">
                    <span>{p.currentAmount.toLocaleString('fr-FR')} GNF</span>
                    <span>{p.goalAmount.toLocaleString('fr-FR')} GNF</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Recent transactions ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-navy text-sm">Transactions récentes</h2>
          <button
            onClick={() => router.push('/dashboard/transactions')}
            className="text-xs text-navy/60 hover:text-navy flex items-center gap-0.5"
          >
            Voir tout <ChevronRight size={12} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                <ArrowDownLeft size={20} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm font-medium">Aucune transaction</p>
              <p className="text-gray-300 text-xs mt-1">Faites votre premier dépôt !</p>
            </div>
          )}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                tx.type === 'deposit' || tx.type === 'bonus' ? 'bg-green-50' :
                tx.type === 'withdrawal' ? 'bg-orange-50' : 'bg-blue-50'
              }`}>
                {tx.type === 'deposit' || tx.type === 'bonus'
                  ? <ArrowDownLeft size={16} className="text-green-600" />
                  : <ArrowUpRight size={16} className="text-orange-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy truncate">{tx.label}</p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${txColor(tx.type)}`}>
                  {txSign(tx.type)}{tx.amount.toLocaleString('fr-FR')} GNF
                </p>
                <p className={`text-xs ${
                  tx.status === 'success' ? 'text-green-500' :
                  tx.status === 'pending' ? 'text-yellow-500' : 'text-red-400'
                }`}>
                  {tx.status === 'success' ? 'Réussi' : tx.status === 'pending' ? 'En cours' : 'Échoué'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Create project shortcut ── */}
      <button
        onClick={() => router.push('/dashboard/projects')}
        className="w-full border-2 border-dashed border-navy/20 rounded-2xl p-4 flex items-center justify-center gap-2 text-navy/50 hover:border-navy/40 hover:text-navy/70 transition-colors mb-4"
      >
        <Plus size={16} />
        <span className="text-sm font-medium">Créer un projet d&apos;épargne</span>
      </button>

      {/* ── Tontine CTA ── */}
      <div
        onClick={() => router.push('/dashboard/tontine')}
        className="bg-navy rounded-2xl p-5 cursor-pointer hover:opacity-95 transition-opacity relative overflow-hidden"
      >
        <div className="absolute -top-3 -right-3 w-20 h-20 bg-lime/10 rounded-full" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-white/60 text-xs mb-1">Epargne collective</p>
            <p className="text-white font-black text-lg">Prêt pour une Tontine ?</p>
            <p className="text-white/50 text-xs mt-1">Épargne collaborative avec bonus de fidélité</p>
            <div className="mt-3">
              <span className="bg-lime text-navy text-xs font-black px-3 py-1.5 rounded-xl inline-flex items-center gap-1">
                Rejoindre <ChevronRight size={12} />
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 w-12 h-12 bg-lime/20 rounded-2xl flex items-center justify-center">
            <Smartphone size={20} className="text-lime" />
          </div>
        </div>
      </div>
    </>
  )
}
