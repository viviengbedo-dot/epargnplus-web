'use client'
import { useEffect, useState } from 'react'
import { Users, Wallet, ArrowLeftRight, Target, TrendingUp, UserCheck } from 'lucide-react'
import StatsCard from '@/components/admin/StatsCard'
import { adminApi, AdminStats, AdminTransaction } from '@/lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']

function fmtGNF(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentTx, setRecentTx] = useState<AdminTransaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.transactions(1)])
      .then(([s, tx]) => {
        setStats(s)
        setRecentTx(tx.items.slice(0, 8))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const chartData = MONTHS.slice(0, new Date().getMonth() + 1).map((m, i) => ({
    month: m,
    volume: Math.round(Math.random() * 50_000_000 + 10_000_000),
  }))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Chargement...</div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-navy">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Vue d&apos;ensemble de la plateforme</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Utilisateurs"
          value={stats?.totalUsers?.toLocaleString() ?? '—'}
          sub={`+${stats?.newUsersThisMonth ?? 0} ce mois`}
          icon={Users}
          trend={12}
          color="lime"
        />
        <StatsCard
          title="Solde total"
          value={`${fmtGNF(stats?.totalBalance ?? 0)} GNF`}
          icon={Wallet}
          trend={8}
          color="blue"
        />
        <StatsCard
          title="Transactions"
          value={stats?.totalTransactions?.toLocaleString() ?? '—'}
          sub={`Vol. ${fmtGNF(stats?.transactionsVolume ?? 0)} GNF`}
          icon={ArrowLeftRight}
          trend={5}
          color="purple"
        />
        <StatsCard
          title="Projets actifs"
          value={stats?.activeProjects?.toLocaleString() ?? '—'}
          icon={Target}
          color="orange"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Volume chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-navy">Volume mensuel (GNF)</h2>
            <span className="text-xs text-gray-400">2025</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => fmtGNF(v)} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} GNF`, 'Volume']} />
              <Bar dataKey="volume" fill="#C9E000" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-navy mb-4">Ce mois</h2>
          <div className="space-y-3">
            {[
              { label: 'Nouveaux utilisateurs', value: stats?.newUsersThisMonth ?? 0, icon: Users },
              { label: 'Utilisateurs actifs', value: stats?.activeUsers ?? 0, icon: UserCheck },
              { label: 'Volume transactions', value: `${fmtGNF(stats?.volumeThisMonth ?? 0)} GNF`, icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 bg-[#F5F5F7] rounded-lg flex items-center justify-center">
                  <Icon size={14} className="text-navy" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-bold text-navy text-sm">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-navy">Transactions récentes</h2>
          <a href="/admin/transactions" className="text-xs text-navy font-medium hover:underline">Voir tout</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Référence</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Utilisateur</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Type</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium text-xs">Montant</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{tx.reference}</td>
                  <td className="px-5 py-3 text-navy font-medium">{tx.userPhone}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.type === 'deposit' ? 'bg-green-50 text-green-600' :
                      tx.type === 'withdrawal' ? 'bg-orange-50 text-orange-500' :
                      'bg-blue-50 text-blue-500'
                    }`}>
                      {tx.type === 'deposit' ? 'Dépôt' : tx.type === 'withdrawal' ? 'Retrait' : tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-navy">
                    {tx.amount.toLocaleString()} GNF
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === 'success' ? 'bg-green-50 text-green-600' :
                      tx.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {tx.status === 'success' ? 'Réussi' : tx.status === 'pending' ? 'En cours' : 'Échec'}
                    </span>
                  </td>
                </tr>
              ))}
              {recentTx.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">Aucune transaction</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
