'use client'
import { useEffect, useState } from 'react'
import { Users, Wallet, TrendingUp, Clock, AlertCircle, UserCheck, Flag, ArrowLeftRight } from 'lucide-react'
import { administrationApi, AdminData } from '@/lib/administration-api'

function StatCard({ icon: Icon, label, value, sub, iconBg = 'bg-[#0B1668]/10', iconColor = 'text-[#0B1668]', href }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string
  iconBg?: string; iconColor?: string; href?: string
}) {
  const inner = (
    <div className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm ${href ? 'hover:shadow-md transition-shadow' : ''}`}>
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center mb-3`}>
        <Icon size={18} className={iconColor} />
      </div>
      <p className="text-2xl font-black text-[#0B1668] leading-none">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
  return href ? <a href={href}>{inner}</a> : inner
}

export default function AdministrationDashboard() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    administrationApi.getData()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n: number) => n?.toLocaleString('fr-FR') ?? '—'
  const s = data?.stats

  // Dépôts en attente (transactions + pending_deposit sur users)
  const pendingFromUsers = (data?.users || []).filter(u => {
    if (!u.pending_deposit) return false
    try { const pd = JSON.parse(u.pending_deposit); return pd?.amount > 0 } catch { return false }
  }).length
  const pendingCount = Math.max(s?.pendingCount ?? 0, pendingFromUsers)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0B1668]">Tableau de bord</h1>
        <p className="text-gray-400 text-sm mt-0.5">Vue d&apos;ensemble — données en temps réel</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-5 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats principales — cliquables */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={Users} label="Comptes enregistrés" value={fmt(s?.total ?? 0)}
              iconBg="bg-blue-50" iconColor="text-blue-600"
              href="/administration/users"
            />
            <StatCard
              icon={Wallet} label="Épargne totale" value={`${fmt(s?.epargneTotal ?? 0)} GNF`}
              iconBg="bg-[#C9E000]/20" iconColor="text-[#0B1668]"
            />
            <StatCard
              icon={Clock} label="Dépôts en attente" value={fmt(pendingCount)}
              sub={pendingCount > 0 ? 'Cliquer pour valider' : 'Aucun en attente'}
              iconBg={pendingCount > 0 ? 'bg-yellow-50' : 'bg-gray-50'}
              iconColor={pendingCount > 0 ? 'text-yellow-600' : 'text-gray-400'}
              href="/administration/transactions"
            />
            <StatCard
              icon={UserCheck} label="KYC vérifiés" value={fmt(s?.kycVerified ?? 0)}
              sub={`${fmt(s?.kycPending ?? 0)} en attente`}
              iconBg="bg-green-50" iconColor="text-green-600"
              href="/administration/kyc"
            />
            <StatCard
              icon={TrendingUp} label="Projets actifs"
              value={fmt(data?.allProjects?.filter(p => p.status === 'ACTIVE').length ?? 0)}
              iconBg="bg-purple-50" iconColor="text-purple-600"
              href="/administration/projects"
            />
            <StatCard
              icon={ArrowLeftRight} label="Transactions total"
              value={fmt(data?.pendingTransactions?.length ?? 0)}
              sub="en base"
              iconBg="bg-indigo-50" iconColor="text-indigo-600"
              href="/administration/transactions"
            />
            <StatCard
              icon={Flag} label="Guinée" value={fmt(s?.byCountry?.gn ?? 0)}
              sub={`Bénin: ${s?.byCountry?.bj ?? 0} · CI: ${s?.byCountry?.ci ?? 0}`}
              iconBg="bg-orange-50" iconColor="text-orange-600"
              href="/administration/analytics"
            />
          </div>

          {/* Actions rapides — avec badges en attente */}
          <div>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Actions rapides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              <a href="/administration/transactions"
                className="flex items-start gap-4 rounded-2xl border p-5 bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${pendingCount > 0 ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                  <Clock size={18} className={pendingCount > 0 ? 'text-yellow-600' : 'text-gray-400'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#0B1668] text-sm">Transactions</p>
                    {pendingCount > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">{pendingCount}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {pendingCount > 0 ? `${pendingCount} dépôt${pendingCount > 1 ? 's' : ''} à valider` : 'Aucun dépôt en attente'}
                  </p>
                </div>
              </a>

              <a href="/administration/kyc"
                className="flex items-start gap-4 rounded-2xl border p-5 bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${(s?.kycPending ?? 0) > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <UserCheck size={18} className={(s?.kycPending ?? 0) > 0 ? 'text-blue-600' : 'text-gray-400'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#0B1668] text-sm">KYC</p>
                    {(s?.kycPending ?? 0) > 0 && (
                      <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">{s?.kycPending}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(s?.kycPending ?? 0) > 0 ? `${s?.kycPending} demande${(s?.kycPending ?? 0) > 1 ? 's' : ''} à vérifier` : 'Tout est à jour'}
                  </p>
                </div>
              </a>

              <a href="/administration/users"
                className="flex items-start gap-4 rounded-2xl border p-5 bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-green-100">
                  <Users size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-[#0B1668] text-sm">Utilisateurs</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmt(s?.total ?? 0)} compte{(s?.total ?? 0) > 1 ? 's' : ''} enregistré{(s?.total ?? 0) > 1 ? 's' : ''}
                  </p>
                </div>
              </a>

            </div>
          </div>
        </>
      )}
    </div>
  )
}
