'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react'
import { administrationApi, AdminDataUser } from '@/lib/administration-api'

export default function KycPage() {
  const [users, setUsers] = useState<AdminDataUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await administrationApi.getData()
      setUsers(data.users)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function approve(userId: string) {
    setActionId(userId)
    try { await administrationApi.approveKyc(userId); await load() }
    catch (e) { alert((e as Error).message) }
    finally { setActionId(null) }
  }

  async function reject(userId: string) {
    const reason = window.prompt('Raison du rejet (optionnel) :') ?? ''
    setActionId(userId)
    try { await administrationApi.rejectKyc(userId, reason); await load() }
    catch (e) { alert((e as Error).message) }
    finally { setActionId(null) }
  }

  const displayed = filter === 'pending'
    ? users.filter(u => u.kyc_status === 'pending')
    : users.filter(u => u.kyc_status !== 'none')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">KYC</h1>
          <p className="text-gray-400 text-sm mt-0.5">{users.filter(u => u.kyc_status === 'pending').length} demande{users.filter(u => u.kyc_status === 'pending').length !== 1 ? 's' : ''} en attente</p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value as 'pending' | 'all')}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none bg-white">
            <option value="pending">En attente</option>
            <option value="all">Tous avec KYC</option>
          </select>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} /> Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-4 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse h-20" />
        ))}</div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <ShieldCheck size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune demande KYC {filter === 'pending' ? 'en attente' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(user => (
            <div key={user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#0B1668]/10 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={18} className="text-[#0B1668]" />
                </div>
                <div>
                  <p className="font-bold text-[#0B1668] text-sm">{[user.prenom, user.nom].filter(Boolean).join(' ') || user.phone}</p>
                  <p className="text-xs text-gray-400">{user.phone} · {user.country?.toUpperCase() || 'GN'} · {new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                  user.kyc_status === 'verified' ? 'bg-green-100 text-green-700'
                  : user.kyc_status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                  : user.kyc_status === 'rejected' ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                  {user.kyc_status === 'verified' ? 'Vérifié' : user.kyc_status === 'pending' ? 'En attente' : user.kyc_status === 'rejected' ? 'Rejeté' : 'Aucun'}
                </span>
                {user.kyc_status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => approve(user.id)} disabled={actionId === user.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors">
                      <CheckCircle2 size={12} /> Approuver
                    </button>
                    <button onClick={() => reject(user.id)} disabled={actionId === user.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors">
                      <XCircle size={12} /> Rejeter
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
