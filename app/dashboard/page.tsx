'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft, ArrowUpRight, ChevronRight,
  TrendingUp, Plus, Zap, Users,
} from 'lucide-react'
import { clientApi, UserProfile, Transaction, Project } from '@/lib/client-api'

/* ─── Helpers ─────────────────────────────────────────── */
function fmtGNF(v: number) { return v.toLocaleString('fr-FR') }

function txIcon(type: Transaction['type']) {
  if (type === 'deposit' || type === 'bonus') return <ArrowDownLeft size={15} className="text-green-500" />
  return <ArrowUpRight size={15} className="text-orange-400" />
}
function txColor(type: Transaction['type']) {
  if (type === 'deposit' || type === 'bonus') return 'text-green-500'
  return 'text-orange-400'
}
function txSign(type: Transaction['type']) {
  return type === 'deposit' || type === 'bonus' ? '+' : '-'
}

/* ─── Circular Gauge ──────────────────────────────────── */
function CircularGauge({ pct, saved, goal }: { pct: number; saved: number; goal: number }) {
  const r = 64, cx = 80, cy = 80, strokeW = 13
  const circumference = 2 * Math.PI * r
  const filled = Math.min(pct / 100, 1) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 160 160" className="w-48 h-48">
          <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="#F0F4FF" strokeWidth={1.5} strokeDasharray="4 3" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8EDFF" strokeWidth={strokeW} />
          {pct > 0 && (
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke="#C9E000" strokeWidth={strokeW} strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          )}
          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="30" fontWeight="900" fill="#0B1668" fontFamily="system-ui">
            {Math.round(pct)}%
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="system-ui">Progression</text>
          <text x={cx} y={cy + 24} textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="system-ui">Annuelle</text>
        </svg>
        <p className="text-center text-[11px] text-gray-400 mt-0.5 leading-snug px-4">
          En route vers la liberté financière
        </p>
      </div>

      <div className="flex items-center justify-between w-full mt-4 pt-4 border-t border-gray-100">
        {[
          { label: 'Épargné', val: fmtGNF(saved), color: 'text-navy' },
          { label: 'Objectif', val: fmtGNF(goal), color: 'text-navy' },
          { label: 'Restant', val: fmtGNF(Math.max(0, goal - saved)), color: 'text-lime' },
        ].map((s, i, arr) => (
          <div key={s.label} className="flex items-center flex-1">
            <div className="text-center flex-1">
              <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">{s.label}</p>
              <p className={`text-sm font-black mt-0.5 ${s.color}`}>{s.val}</p>
              <p className="text-[9px] text-gray-400">GNF</p>
            </div>
            {i < arr.length - 1 && <div className="w-px h-8 bg-gray-100" />}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────── */
export default function DashboardHome() {
  const router = useRouter()
  const [profile, setProfile]         = useState<UserProfile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects]         = useState<Project[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.all([clientApi.profile(), clientApi.transactions(), clientApi.projects()])
      .then(([p, tx, pr]) => {
        setProfile(p)
        setTransactions(tx.slice(0, 4))
        setProjects(pr.filter((p) => p.status === 'ACTIVE').slice(0, 3))
      })
      .catch(() => router.push('/dashboard/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-lime/20 rounded-2xl flex items-center justify-center animate-pulse">
            <span className="text-navy font-black text-sm">E+</span>
          </div>
          <p className="text-gray-400 text-sm">Chargement…</p>
        </div>
      </div>
    )
  }

  const totalGoal  = projects.reduce((s, p) => s + p.goalAmount, 0)
  const totalSaved = projects.reduce((s, p) => s + p.currentAmount, 0)
  const globalPct  = totalGoal > 0 ? (totalSaved / totalGoal) * 100 : 0

  return (
    <div className="space-y-3 pb-2">

      {/* ── Balance card ─────────────────────────────── */}
      <div className="bg-navy rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-lime/10 rounded-full" />
        <div className="absolute top-10 -right-4 w-16 h-16 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1">
                Solde total global
              </p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-black tracking-tight leading-none">
                  {fmtGNF(profile?.balance ?? 0)}
                </p>
                <p className="text-lime font-bold text-lg mb-0.5">GNF</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-2.5 py-1.5">
              <TrendingUp size={11} className="text-lime" />
              <span className="text-white/50 text-[10px]">Depuis {profile?.memberSince}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/dashboard/deposit')}
              className="bg-lime text-navy rounded-2xl py-3.5 flex items-center justify-center gap-2 font-black text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-lime/20"
            >
              <ArrowDownLeft size={17} /> Déposer
            </button>
            <button
              onClick={() => router.push('/dashboard/withdraw')}
              className="bg-white/10 text-white rounded-2xl py-3.5 flex items-center justify-center gap-2 font-bold text-sm hover:bg-white/20 active:scale-95 transition-all border border-white/10"
            >
              <ArrowUpRight size={17} /> Retirer
            </button>
          </div>
        </div>
      </div>

      {/* ── Gauge card ───────────────────────────────── */}
      {projects.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <CircularGauge pct={globalPct} saved={totalSaved} goal={totalGoal} />
        </div>
      )}

      {/* ── Objectifs Actifs ─────────────────────────── */}
      {projects.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-navy rounded-lg flex items-center justify-center">
                <Zap size={12} className="text-lime" />
              </div>
              <p className="font-bold text-navy text-sm">Objectifs Actifs</p>
            </div>
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="flex items-center gap-0.5 text-navy/50 hover:text-navy text-xs font-medium transition-colors"
            >
              Voir tout <ChevronRight size={13} />
            </button>
          </div>

          <div className="divide-y divide-gray-50 px-4">
            {projects.map((p) => {
              const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))
              return (
                <div key={p.id} className="py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{p.icon || '🎯'}</span>
                      <div>
                        <p className="text-sm font-bold text-navy leading-tight">{p.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {fmtGNF(p.currentAmount)} / {fmtGNF(p.goalAmount)} GNF
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                      pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-lime/15 text-navy'
                    }`}>{pct}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 100 ? '#22c55e' : 'linear-gradient(90deg,#C9E000,#a8c200)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => router.push('/dashboard/projects')}
            className="w-full flex items-center justify-center gap-2 py-3 text-navy/40 hover:text-navy/70 text-xs font-medium border-t border-gray-50 transition-colors"
          >
            <Plus size={13} /> Nouveau projet d&apos;épargne
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
          <div className="w-14 h-14 bg-lime/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Zap size={24} className="text-navy" />
          </div>
          <p className="font-black text-navy mb-1">Aucun objectif actif</p>
          <p className="text-gray-400 text-sm mb-4">Créez votre premier projet d&apos;épargne</p>
          <button
            onClick={() => router.push('/dashboard/projects')}
            className="bg-lime text-navy font-bold px-6 py-2.5 rounded-xl text-sm hover:opacity-90"
          >
            Créer un projet
          </button>
        </div>
      )}

      {/* ── Tontine CTA ──────────────────────────────── */}
      <div
        onClick={() => router.push('/dashboard/tontine')}
        className="bg-navy rounded-3xl p-5 cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden shadow-xl"
      >
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-lime/15 rounded-full" />
        <div className="absolute bottom-0 right-8 w-14 h-14 bg-white/5 rounded-full" />

        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 bg-lime/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Users size={22} className="text-lime" />
          </div>
          <div className="flex-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wide mb-0.5">Épargne collective</p>
            <p className="text-white font-black text-[17px] leading-tight">Prêt pour une Tontine ?</p>
            <p className="text-white/40 text-xs mt-0.5">Bonus fidélité +5% pour les membres assidus</p>
          </div>
          <span className="bg-lime text-navy text-xs font-black px-3 py-2 rounded-xl flex items-center gap-1 flex-shrink-0">
            Lancer <ChevronRight size={12} />
          </span>
        </div>
      </div>

      {/* ── Dernières activités ───────────────────────── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <p className="font-bold text-navy text-sm">Dernières Activités</p>
          <button
            onClick={() => router.push('/dashboard/transactions')}
            className="text-xs text-navy/50 hover:text-navy flex items-center gap-0.5 font-medium transition-colors"
          >
            Voir tout <ChevronRight size={13} />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
              <ArrowDownLeft size={20} className="text-gray-200" />
            </div>
            <p className="text-gray-400 text-sm font-medium">Aucune activité</p>
            <p className="text-gray-300 text-xs mt-0.5">Faites votre premier dépôt !</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'deposit' || tx.type === 'bonus'
                    ? 'bg-green-50' : 'bg-orange-50'
                }`}>
                  {txIcon(tx.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{tx.label}</p>
                  <p className="text-[11px] text-gray-400">
                    {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${txColor(tx.type)}`}>
                    {txSign(tx.type)}{fmtGNF(tx.amount)} F
                  </p>
                  <p className={`text-[10px] ${
                    tx.status === 'success' ? 'text-green-400'
                    : tx.status === 'pending' ? 'text-yellow-500' : 'text-red-400'
                  }`}>
                    {tx.status === 'success' ? '✓ Réussi'
                      : tx.status === 'pending' ? '⏳ En cours' : '✗ Échoué'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
