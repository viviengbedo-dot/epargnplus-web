'use client'
import { useEffect, useState } from 'react'
import { Users, ArrowLeftRight, Wallet, TrendingUp, Clock, AlertCircle, UserCheck, Flag } from 'lucide-react'
import { administrationApi, AdminData } from '@/lib/administration-api'

function StatCard({ icon: Icon, label, value, sub, iconBg = 'bg-[#0B1668]/10', iconColor = 'text-[#0B1668]' }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; iconBg?: string; iconColor?: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center mb-3`}>
        <Icon size={18} className={iconColor} />
      </div>
      <p className="text-2xl font-black text-[#0B1668] leading-none">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Users} label="Comptes enregistrés" value={fmt(s?.total ?? 0)} iconBg="bg-blue-50" iconColor="text-blue-600" />
            <StatCard icon={Wallet} label="Épargne totale" value={`${fmt(s?.epargneTotal ?? 0)} GNF`} iconBg="bg-[#C9E000]/20" iconColor="text-[#0B1668]" />
            <StatCard icon={Clock} label="Dépôts en attente" value={fmt(s?.pendingCount ?? 0)} sub="À valider" iconBg="bg-yellow-50" iconColor="text-yellow-600" />
            <StatCard icon={UserCheck} label="KYC vérifiés" value={fmt(s?.kycVerified ?? 0)} sub={`${fmt(s?.kycPending ?? 0)} en attente`} iconBg="bg-green-50" iconColor="text-green-600" />
            <StatCard icon={TrendingUp} label="Projets actifs" value={fmt(data?.allProjects?.filter(p => p.status === 'ACTIVE').length ?? 0)} iconBg="bg-purple-50" iconColor="text-purple-600" />
            <StatCard icon={Flag} label="Guinée" value={fmt(s?.byCountry?.gn ?? 0)} sub={`Bénin: ${s?.byCountry?.bj ?? 0} · CI: ${s?.byCountry?.ci ?? 0}`} iconBg="bg-orange-50" iconColor="text-orange-600" />
          </div>

          {/* Dépôts en attente */}
          {(data?.pendingTransactions?.length ?? 0) > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 mb-5">
              <p className="font-bold text-yellow-800 text-sm mb-3">⚠ {data!.pendingTransactions.length} dépôt{data!.pendingTransactions.length > 1 ? 's' : ''} en attente de validation</p>
              <a href="/administration/transactions" className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-700 text-white text-xs font-bold rounded-xl hover:bg-yellow-800 transition-colors">
                Valider les dépôts →
              </a>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a href="/administration/transactions" className="block rounded-2xl border p-4 bg-yellow-50 border-yellow-200 text-yellow-700 hover:opacity-80 transition-opacity">
              <p className="font-bold text-sm">Dépôts en attente</p>
              <p className="text-xs opacity-70 mt-0.5">Confirmer les paiements Mobile Money</p>
            </a>
            <a href="/administration/kyc" className="block rounded-2xl border p-4 bg-blue-50 border-blue-200 text-blue-700 hover:opacity-80 transition-opacity">
              <p className="font-bold text-sm">KYC à vérifier</p>
              <p className="text-xs opacity-70 mt-0.5">{s?.kycPending ?? 0} demande{(s?.kycPending ?? 0) > 1 ? 's' : ''} en attente</p>
            </a>
            <a href="/administration/users" className="block rounded-2xl border p-4 bg-green-50 border-green-200 text-green-700 hover:opacity-80 transition-opacity">
              <p className="font-bold text-sm">Gérer les utilisateurs</p>
              <p className="text-xs opacity-70 mt-0.5">{s?.total ?? 0} compte{(s?.total ?? 0) > 1 ? 's' : ''} enregistré{(s?.total ?? 0) > 1 ? 's' : ''}</p>
            </a>
          </div>
        </>
      )}
    </div>
  )
}
