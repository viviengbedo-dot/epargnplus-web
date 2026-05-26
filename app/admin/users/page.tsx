'use client'
import { useEffect, useState, useCallback } from 'react'
import { Search, CheckCircle, Clock, XCircle, Shield, ShieldOff } from 'lucide-react'
import { adminApi, AdminUser } from '@/lib/api'

const KYC_BADGE: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Vérifié',    cls: 'bg-green-50 text-green-600' },
  pending:  { label: 'En attente', cls: 'bg-yellow-50 text-yellow-600' },
  none:     { label: 'Aucun',      cls: 'bg-gray-100 text-gray-500' },
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.users(page, search)
      setUsers(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  async function toggleBlock(user: AdminUser) {
    setUpdatingId(user.id)
    try {
      await adminApi.updateUser(user.id, { isBlocked: !user.isBlocked })
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isBlocked: !u.isBlocked } : u))
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingId(null)
    }
  }

  async function updateKYC(user: AdminUser, status: AdminUser['kycStatus']) {
    setUpdatingId(user.id)
    try {
      await adminApi.updateUser(user.id, { kycStatus: status })
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, kycStatus: status } : u))
    } catch (e) {
      console.error(e)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} comptes enregistrés</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher par téléphone..."
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Utilisateur</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Solde</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">KYC</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Parrainage</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Inscrit le</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">Aucun utilisateur trouvé</td>
                </tr>
              ) : users.map((user) => {
                const kyc = KYC_BADGE[user.kycStatus]
                return (
                  <tr key={user.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${user.isBlocked ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy">{user.phone}</p>
                      {user.name && <p className="text-xs text-gray-400">{user.name}</p>}
                    </td>
                    <td className="px-5 py-3 font-bold text-navy">
                      {user.balance.toLocaleString()} <span className="text-xs font-normal text-gray-400">GNF</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${kyc.cls}`}>
                        {kyc.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{user.referralCode}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{user.createdAt}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {user.kycStatus === 'pending' && (
                          <>
                            <button
                              onClick={() => updateKYC(user, 'verified')}
                              disabled={updatingId === user.id}
                              title="Approuver KYC"
                              className="text-green-500 hover:text-green-600 disabled:opacity-50"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => updateKYC(user, 'none')}
                              disabled={updatingId === user.id}
                              title="Rejeter KYC"
                              className="text-red-400 hover:text-red-500 disabled:opacity-50"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => toggleBlock(user)}
                          disabled={updatingId === user.id}
                          title={user.isBlocked ? 'Débloquer' : 'Bloquer'}
                          className={`disabled:opacity-50 ${user.isBlocked ? 'text-green-500 hover:text-green-600' : 'text-red-400 hover:text-red-500'}`}
                        >
                          {user.isBlocked ? <Shield size={16} /> : <ShieldOff size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Page {page} sur {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
