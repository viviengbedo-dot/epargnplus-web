'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, ShieldCheck, ShieldOff, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { administrationApi, AdminDataUser, AdminDataProject, AdminDataTransaction } from '@/lib/administration-api'

type UserWithProjects = AdminDataUser & {
  projects?: AdminDataProject[]
  transactions?: AdminDataTransaction[]
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithProjects[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [countryFilter, setCountryFilter] = useState<string>('all')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await administrationApi.getData()
      const enriched: UserWithProjects[] = data.users.map(u => ({
        ...u,
        projects: data.allProjects.filter(p => p.user_id === u.id),
        transactions: data.pendingTransactions.filter(t => t.user_id === u.id),
      }))
      setUsers(enriched)
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

  const countries = Array.from(new Set(users.map(u => u.country || 'gn'))).sort()

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.phone?.includes(search) ||
      `${u.prenom} ${u.nom}`.toLowerCase().includes(search.toLowerCase())
    const matchCountry = countryFilter === 'all' || (u.country || 'gn') === countryFilter
    return matchSearch && matchCountry
  })

  const totalEpargne = filtered.reduce((acc, u) => acc + (u.epargne || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Utilisateurs</h1>
          <p className="text-gray-400 text-sm mt-0.5">{users.length} compte{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input type="text" placeholder="Rechercher par nom ou téléphone…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-300" />
        </div>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none bg-white shrink-0">
          <option value="all">Tous les pays</option>
          {countries.map(c => (
            <option key={c} value={c}>{c.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Résumé filtré */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-xl font-black text-[#0B1668]">{filtered.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Utilisateurs affichés</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-xl font-black text-[#0B1668]">{totalEpargne.toLocaleString('fr-FR')} GNF</p>
            <p className="text-xs text-gray-400 mt-0.5">Épargne totale</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-xl font-black text-green-600">{filtered.filter(u => u.kyc_status === 'verified').length}</p>
            <p className="text-xs text-gray-400 mt-0.5">KYC vérifiés</p>
          </div>
        </div>
      )}

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
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Inscrit le</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><div className="h-4 bg-gray-100 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">Aucun utilisateur</td></tr>
              ) : filtered.map(user => {
                let pendingAmt = 0
                try { const pd = JSON.parse(user.pending_deposit || 'null'); if (pd) pendingAmt = pd.amount || 0 } catch {}
                const isExpanded = expandedId === user.id
                return (
                  <>
                    <tr key={user.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${isExpanded ? 'bg-gray-50/50' : ''}`}>
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
                          {user.kyc_status === 'verified' ? <><ShieldCheck size={13} /> Vérifié</>
                          : user.kyc_status === 'pending' ? <><ShieldOff size={13} /> En attente</>
                          : user.kyc_status === 'rejected' ? <><ShieldOff size={13} /> Rejeté</>
                          : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 uppercase">{user.country || 'gn'}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : user.id)}
                          className="text-gray-400 hover:text-[#0B1668] transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${user.id}-detail`} className="border-b border-gray-100 bg-[#F2F4FA]">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Projets */}
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                Projets ({user.projects?.length ?? 0})
                              </p>
                              {(user.projects?.length ?? 0) === 0 ? (
                                <p className="text-xs text-gray-400">Aucun projet</p>
                              ) : (
                                <div className="space-y-2">
                                  {user.projects!.map(p => {
                                    const pct = p.goal > 0 ? Math.min(100, Math.round((p.actuel / p.goal) * 100)) : 0
                                    return (
                                      <div key={p.id} className="bg-white rounded-xl p-3 border border-gray-100">
                                        <div className="flex justify-between items-center mb-1.5">
                                          <span className="text-xs font-semibold text-[#0B1668]">{p.name}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                                            p.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                                            : p.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-500'
                                          }`}>{p.status === 'ACTIVE' ? 'Actif' : p.status === 'COMPLETED' ? 'Complété' : 'Suspendu'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                            <div className="h-1.5 rounded-full bg-[#C9E000]" style={{ width: `${pct}%` }} />
                                          </div>
                                          <span className="text-xs text-gray-400">{pct}%</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">
                                          {(p.actuel || 0).toLocaleString('fr-FR')} / {(p.goal || 0).toLocaleString('fr-FR')} GNF
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                            {/* Infos supplémentaires */}
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Infos compte</p>
                              <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">ID</span>
                                  <span className="font-mono text-gray-600">{user.id.slice(0, 8)}…</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Opérateur</span>
                                  <span className="font-medium text-gray-600 uppercase">{user.operator || '—'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Rôle</span>
                                  <span className="font-medium text-gray-600">{user.role || 'user'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Pays</span>
                                  <span className="font-medium text-gray-600 uppercase">{user.country || 'gn'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Inscrit le</span>
                                  <span className="font-medium text-gray-600">{new Date(user.created_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
