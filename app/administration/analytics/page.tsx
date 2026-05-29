'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, TrendingUp, Users, Wallet, Target } from 'lucide-react'
import { administrationApi, AdminData } from '@/lib/administration-api'

function MiniBar({ value, max, color = '#0B1668' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right shrink-0">{Math.round(pct)}%</span>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const d = await administrationApi.getData()
      setData(d)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const fmt = (n: number) => (n ?? 0).toLocaleString('fr-FR')

  const kycRate = data?.stats.total ? Math.round((data.stats.kycVerified / data.stats.total) * 100) : 0
  const projectsCompleted = data?.allProjects.filter(p => p.status === 'COMPLETED').length ?? 0
  const projectsTotal = data?.allProjects.length ?? 0
  const avgEpargne = data?.stats.total && data.stats.total > 0
    ? Math.round(data.stats.epargneTotal / data.stats.total) : 0

  const topProjects = [...(data?.allProjects ?? [])].sort((a, b) => b.actuel - a.actuel).slice(0, 5)
  const topUsers = [...(data?.users ?? [])].sort((a, b) => b.epargne - a.epargne).slice(0, 5)

  const operatorMap: Record<string, number> = {}
  data?.users.forEach(u => {
    if (u.operator) operatorMap[u.operator] = (operatorMap[u.operator] ?? 0) + 1
  })
  const operatorEntries = Object.entries(operatorMap).sort((a, b) => b[1] - a[1])
  const maxOperator = operatorEntries[0]?.[1] ?? 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Analytiques</h1>
          <p className="text-gray-400 text-sm mt-0.5">Métriques en temps réel de la plateforme</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-4 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse h-48" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Taux KYC vérifié', value: `${kycRate}%`, sub: `${fmt(data?.stats.kycVerified ?? 0)} / ${fmt(data?.stats.total ?? 0)} users`, bg: 'bg-green-50', icon: '✅' },
              { label: 'Épargne moyenne', value: `${fmt(avgEpargne)} GNF`, sub: 'Par utilisateur', bg: 'bg-blue-50', icon: '📊' },
              { label: 'Projets complétés', value: `${projectsCompleted}`, sub: `sur ${projectsTotal} projets`, bg: 'bg-purple-50', icon: '🎯' },
              { label: 'Dépôts en attente', value: fmt(data?.stats.pendingCount ?? 0), sub: 'À valider', bg: 'bg-yellow-50', icon: '⏳' },
            ].map((k, i) => (
              <div key={i} className={`${k.bg} rounded-2xl p-4 border border-gray-100`}>
                <div className="text-2xl mb-1">{k.icon}</div>
                <p className="text-xl font-black text-[#0B1668]">{k.value}</p>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">{k.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Répartition géographique */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Users size={16} className="text-[#0B1668]" />
                <h3 className="font-bold text-[#0B1668] text-sm">Répartition géographique</h3>
              </div>
              <div className="space-y-4">
                {[
                  { country: '🇬🇳 Guinée', count: data?.stats.byCountry?.gn ?? 0 },
                  { country: '🇧🇯 Bénin', count: data?.stats.byCountry?.bj ?? 0 },
                  { country: '🇨🇮 Côte d\'Ivoire', count: data?.stats.byCountry?.ci ?? 0 },
                  { country: '🌍 Autres', count: data?.stats.byCountry?.other ?? 0 },
                ].map(({ country, count }) => (
                  <div key={country}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{country}</span>
                      <span className="text-gray-400">{fmt(count)} utilisateurs</span>
                    </div>
                    <MiniBar value={count} max={data?.stats.total ?? 1} color="#0B1668" />
                  </div>
                ))}
              </div>
            </div>

            {/* Statut KYC */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp size={16} className="text-[#0B1668]" />
                <h3 className="font-bold text-[#0B1668] text-sm">Statut KYC</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Vérifiés', count: data?.stats.kycVerified ?? 0, color: '#22c55e' },
                  { label: 'En attente', count: data?.stats.kycPending ?? 0, color: '#eab308' },
                  { label: 'Rejetés', count: data?.users.filter(u => u.kyc_status === 'rejected').length ?? 0, color: '#ef4444' },
                  { label: 'Sans KYC', count: data?.users.filter(u => u.kyc_status === 'none').length ?? 0, color: '#9ca3af' },
                ].map(({ label, count, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{label}</span>
                      <span className="text-gray-400">{fmt(count)}</span>
                    </div>
                    <MiniBar value={count} max={data?.stats.total ?? 1} color={color} />
                  </div>
                ))}
              </div>
            </div>

            {/* Top épargnants */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Wallet size={16} className="text-[#0B1668]" />
                <h3 className="font-bold text-[#0B1668] text-sm">Top 5 épargnants</h3>
              </div>
              {topUsers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Aucune donnée</p>
              ) : (
                <div className="space-y-3">
                  {topUsers.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <span className="text-xs font-black text-gray-300 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0B1668] truncate">
                          {[u.prenom, u.nom].filter(Boolean).join(' ') || u.phone}
                        </p>
                        <MiniBar value={u.epargne} max={topUsers[0]?.epargne || 1} color="#C9E000" />
                      </div>
                      <span className="text-xs font-bold text-[#0B1668] shrink-0">{fmt(u.epargne)} GNF</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top projets */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Target size={16} className="text-[#0B1668]" />
                <h3 className="font-bold text-[#0B1668] text-sm">Top 5 projets</h3>
              </div>
              {topProjects.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Aucun projet</p>
              ) : (
                <div className="space-y-3">
                  {topProjects.map((p, i) => {
                    const pct = p.goal > 0 ? Math.min(100, Math.round((p.actuel / p.goal) * 100)) : 0
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="text-xs font-black text-gray-300 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#0B1668] truncate">{p.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-[#C9E000]" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{pct}%</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#0B1668] shrink-0">{fmt(p.actuel)} GNF</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Opérateurs mobiles */}
          {operatorEntries.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-[#0B1668] text-sm mb-5">Opérateurs mobiles</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {operatorEntries.map(([op, count]) => (
                  <div key={op} className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-xl font-black text-[#0B1668]">{count}</p>
                    <p className="text-xs font-medium text-gray-500 mt-1 uppercase">{op}</p>
                    <div className="mt-2">
                      <MiniBar value={count} max={maxOperator} color="#0B1668" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
