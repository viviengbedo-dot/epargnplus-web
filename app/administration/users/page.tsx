'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, ShieldCheck, ShieldOff, Search } from 'lucide-react'
import { administrationApi, AdminDataUser } from '@/lib/administration-api'

export default function UsersPage() {
  const [users, setUsers] = useState<AdminDataUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await administrationApi.getData()
      setUsers(data.users)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function setBalance(userId: string) {
    const amt = parseInt(editAmount, 10)
    if (isNaN(amt) || amt < 0) return alert('Montant invalide')
    try {
      await administrationApi.setBalance(userId, amt)
      setEditId(null); setEditAmount('')
      await load()
    } catch (e) { alert((e as Error).message) }
  }

  const filtered = users.filter(u =>
    !search ||
    u.phone?.includes(search) ||
    `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Utilisateurs</h1>
          <p className="text-gray-400 text-sm mt-0.5">{users.length} compte{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 flex items-center gap-3">
        <Search size={16} className="text-gray-400 shrink-0" />
        <input type="text" placeholder="Rechercher par nom ou téléphone…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-300" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-4 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Téléphone</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Épargne</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Dépôt en attente</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">KYC</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Pays</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><div className="h-4 bg-gray-100 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">Aucun utilisateur</td></tr>
              ) : filtered.map(user => {
                let pendingAmt = 0
                try { const pd = JSON.parse(user.pending_deposit || 'null'); if (pd) pendingAmt = pd.amount || 0 } catch {}
                return (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-semibold text-[#0B1668]">{[user.prenom, user.nom].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-600">{user.phone}</td>
                    <td className="px-5 py-3.5 font-bold text-[#0B1668]">
                      {editId === user.id ? (
                        <div className="flex gap-1">
                          <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none"
                            placeholder={String(user.epargne)} />
                          <button onClick={() => setBalance(user.id)} className="px-2 py-1 bg-green-500 text-white text-xs rounded-lg">✓</button>
                          <button onClick={() => { setEditId(null); setEditAmount('') }} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">✗</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditId(user.id); setEditAmount(String(user.epargne || 0)) }}
                          className="hover:underline">{(user.epargne || 0).toLocaleString('fr-FR')} GNF</button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {pendingAmt > 0 ? (
                        <span className="text-yellow-700 font-bold">{pendingAmt.toLocaleString('fr-FR')} GNF</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`flex items-center gap-1 text-xs font-medium ${
                        user.kyc_status === 'verified' ? 'text-green-600'
                        : user.kyc_status === 'pending' ? 'text-yellow-600'
                        : user.kyc_status === 'rejected' ? 'text-red-500'
                        : 'text-gray-400'
                      }`}>
                        {user.kyc_status === 'verified' ? <><ShieldCheck size={13} /> Vérifié</> : user.kyc_status === 'pending' ? <><ShieldOff size={13} /> En attente</> : user.kyc_status === 'rejected' ? <><ShieldOff size={13} /> Rejeté</> : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 uppercase">{user.country || 'gn'}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">
                      {new Date(user.created_at).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
