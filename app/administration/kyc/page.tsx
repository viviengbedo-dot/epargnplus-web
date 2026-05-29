'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertCircle, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react'
import { adminApi, AdminKycUser } from '@/lib/api'

export default function KycPage() {
  const [users, setUsers] = useState<AdminKycUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.kycList(page)
      setUsers(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Impossible de charger les demandes KYC.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  async function approve(id: string) {
    setActionId(id)
    try {
      await adminApi.kycApprove(id)
      fetchData()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActionId(null)
    }
  }

  async function reject(id: string) {
    setActionId(id)
    try {
      await adminApi.kycReject(id)
      fetchData()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setActionId(null)
    }
  }

  const pending = users.filter(u => u.kycStatus === 'pending')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">KYC</h1>
          <p className="text-gray-400 text-sm mt-0.5">{pending.length} demande{pending.length !== 1 ? 's' : ''} en attente</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-4 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-20" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <ShieldCheck size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune demande KYC trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50/50"
                onClick={() => setExpanded(expanded === user.id ? null : user.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#0B1668]/10 rounded-xl flex items-center justify-center">
                    <ShieldCheck size={18} className="text-[#0B1668]" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0B1668] text-sm">{user.name || user.phone}</p>
                    <p className="text-xs text-gray-400">{user.phone} · Tier {user.kycTier} · {new Date(user.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    user.kycStatus === 'verified' ? 'bg-green-100 text-green-700'
                    : user.kycStatus === 'pending' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {user.kycStatus === 'verified' ? 'Vérifié' : user.kycStatus === 'pending' ? 'En attente' : 'Non vérifié'}
                  </span>
                  {user.kycStatus === 'pending' && (
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => approve(user.id)}
                        disabled={actionId === user.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle2 size={12} /> Approuver
                      </button>
                      <button
                        onClick={() => reject(user.id)}
                        disabled={actionId === user.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                      >
                        <XCircle size={12} /> Rejeter
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents */}
              {expanded === user.id && user.docs && user.docs.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Documents</p>
                  <div className="flex flex-wrap gap-3">
                    {user.docs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                        <span className={`w-2 h-2 rounded-full ${doc.verified ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        <span className="text-xs font-medium text-gray-600">{doc.type}</span>
                        <span className="text-xs text-gray-400">{doc.verified ? '✓ Vérifié' : 'En attente'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">Page {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs font-medium border border-gray-200 bg-white rounded-lg disabled:opacity-40 hover:bg-gray-50">← Précédent</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs font-medium border border-gray-200 bg-white rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant →</button>
          </div>
        </div>
      )}
    </div>
  )
}
