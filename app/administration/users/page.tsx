'use client'
import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, AlertCircle, ShieldCheck, ShieldOff, UserX, UserCheck } from 'lucide-react'
import { adminApi, AdminUser } from '@/lib/api'

const KYC_COLORS: Record<string, string> = {
  none: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
}
const KYC_LABELS: Record<string, string> = {
  none: 'Non vérifié',
  pending: 'En attente',
  verified: 'Vérifié',
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.users(page, search)
      setUsers(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Impossible de charger les utilisateurs.')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const timer = setTimeout(fetchData, 300)
    return () => clearTimeout(timer)
  }, [fetchData])

  async function toggleBlock(user: AdminUser) {
    setActionId(user.id)
    try {
      await adminApi.updateUser(user.id, { isBlocked: !user.isBlocked })
      fetchData()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Utilisateurs</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} compte{total !== 1 ? 's' : ''} enregistré{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 flex items-center gap-3">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-300"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-4 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Téléphone</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Solde</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">KYC</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Parrain</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Inscrit le</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 font-semibold text-[#0B1668]">{user.name || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">{user.phone}</td>
                  <td className="px-5 py-3.5 font-bold text-[#0B1668]">{(user.balance ?? 0).toLocaleString('fr-FR')} GNF</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${KYC_COLORS[user.kycStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                      {KYC_LABELS[user.kycStatus] ?? user.kycStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{user.referralCode || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap text-xs">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-5 py-3.5">
                    {user.isBlocked ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                        <ShieldOff size={13} /> Bloqué
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-green-500">
                        <ShieldCheck size={13} /> Actif
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => toggleBlock(user)}
                      disabled={actionId === user.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 ${
                        user.isBlocked
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                      }`}
                    >
                      {user.isBlocked ? <><UserCheck size={12} /> Débloquer</> : <><UserX size={12} /> Bloquer</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Page {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Précédent</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
