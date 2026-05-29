'use client'
import { useEffect, useState } from 'react'
import { Users, ArrowLeftRight, TrendingUp, Wallet, UserCheck, Clock, AlertCircle } from 'lucide-react'
import { adminApi, AdminStats } from '@/lib/api'

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'bg-white',
  iconColor = 'text-[#0B1668]',
  iconBg = 'bg-[#0B1668]/10',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
  iconColor?: string
  iconBg?: string
}) {
  return (
    <div className={`${color} rounded-2xl p-5 border border-gray-100 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center`}>
          <Icon size={18} className={iconColor} />
        </div>
      </div>
      <p className="text-2xl font-black text-[#0B1668] leading-none">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    adminApi.stats()
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques.'))
      .finally(() => setLoading(false))
  }, [])

  function fmt(n: number) {
    return n?.toLocaleString('fr-FR') ?? '—'
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0B1668]">Tableau de bord</h1>
        <p className="text-gray-400 text-sm mt-0.5">Vue d&apos;ensemble de la plateforme Epargn+</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-5 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={Users}
              label="Comptes enregistrés"
              value={fmt(stats?.totalUsers ?? 0)}
              sub={`+${fmt(stats?.newUsersThisMonth ?? 0)} ce mois`}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              icon={UserCheck}
              label="Utilisateurs actifs"
              value={fmt(stats?.activeUsers ?? 0)}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <StatCard
              icon={Wallet}
              label="Épargne totale"
              value={`${fmt(stats?.totalBalance ?? 0)} GNF`}
              iconBg="bg-[#C9E000]/20"
              iconColor="text-[#0B1668]"
            />
            <StatCard
              icon={TrendingUp}
              label="Volume ce mois"
              value={`${fmt(stats?.volumeThisMonth ?? 0)} GNF`}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <StatCard
              icon={ArrowLeftRight}
              label="Transactions totales"
              value={fmt(stats?.totalTransactions ?? 0)}
              iconBg="bg-orange-50"
              iconColor="text-orange-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Volume total"
              value={`${fmt(stats?.transactionsVolume ?? 0)} GNF`}
              iconBg="bg-indigo-50"
              iconColor="text-indigo-600"
            />
            <StatCard
              icon={Clock}
              label="Projets actifs"
              value={fmt(stats?.activeProjects ?? 0)}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <QuickLink href="/administration/transactions?status=pending" label="Dépôts en attente" desc="Valider les paiements Mobile Money" color="bg-yellow-50 border-yellow-200 text-yellow-700" />
            <QuickLink href="/administration/kyc" label="KYC à vérifier" desc="Vérifier les pièces d'identité" color="bg-blue-50 border-blue-200 text-blue-700" />
            <QuickLink href="/administration/users" label="Gérer les utilisateurs" desc="Voir et modifier les comptes" color="bg-green-50 border-green-200 text-green-700" />
          </div>
        </>
      )}
    </div>
  )
}

function QuickLink({ href, label, desc, color }: { href: string; label: string; desc: string; color: string }) {
  return (
    <a
      href={href}
      className={`block rounded-2xl border p-4 hover:opacity-80 transition-opacity ${color}`}
    >
      <p className="font-bold text-sm">{label}</p>
      <p className="text-xs opacity-70 mt-0.5">{desc}</p>
    </a>
  )
}
