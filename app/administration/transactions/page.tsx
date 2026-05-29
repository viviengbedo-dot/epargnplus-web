'use client'
import { useEffect, useState, Suspense } from 'react'
import { CheckCircle2, XCircle, RefreshCw, AlertCircle, Clock, Search } from 'lucide-react'
import { administrationApi, AdminDataTransaction, AdminDataUser } from '@/lib/administration-api'

type TxWithUser = AdminDataTransaction & { userPhone?: string; userName?: string }
type FilterStatut = 'pending' | 'completed' | 'failed' | 'all'

function TransactionsContent() {
  const [transactions, setTransactions] = useState<TxWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterStatut>('pending')
  const [search, setSearch] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [allRes, adminData] = await Promise.all([
        fetch('/api/administration/transactions').then(r => r.json()),
        administrationApi.getData(),
      ])

      const fromDB: TxWithUser[] = (allRes.transactions || [])
      const dbIds = new Set(fromDB.map((t: TxWithUser) => t.id))

      // Ajouter les pending_deposit des users non encore en DB
      const fromPD: TxWithUser[] = []
      adminData.users.forEach((u: AdminDataUser) => {
        if (!u.pending_deposit) return
        try {
          const pd = JSON.parse(u.pending_deposit)
          if (pd && pd.amount > 0 && !dbIds.has(pd.txnId)) {
            fromPD.push({
              id: pd.txnId || `pd_${u.id}`,
              user_id: u.id,
              type: 'depot',
              montant: pd.amount,
              operator: pd.operator || 'Mobile Money',
              statut: 'pending',
              created_at: pd.requestedAt || new Date().toISOString(),
              userPhone: u.phone,
              userName: [u.prenom, u.nom].filter(Boolean).join(' ') || undefined,
            })
          }
        } catch {}
      })

      setTransactions([...fromPD, ...fromDB])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function approve(tx: TxWithUser) {
    if (!window.confirm(`Confirmer le dépôt de ${tx.montant.toLocaleString('fr-FR')} GNF ?`)) return
    setActionId(tx.id)
    try {
      await administrationApi.approveDeposit(tx.user_id, tx.id, tx.montant)
      await load()
    } catch (e) { alert((e as Error).message) }
    finally { setActionId(null) }
  }

  async function reject(tx: TxWithUser) {
    if (!window.confirm('Rejeter ce dépôt ?')) return
    setActionId(tx.id)
    try {
      await administrationApi.rejectDeposit(tx.user_id, tx.id)
      await load()
    } catch (e) { alert((e as Error).message) }
    finally { setActionId(null) }
  }

  const pendingCount = transactions.filter(t => t.statut === 'pending').length

  const displayed = transactions
    .filter(t => {
      if (filter === 'pending')   return t.statut === 'pending'
      if (filter === 'completed') return t.statut === 'completed'
      if (filter === 'failed')    return t.statut === 'failed'
      return true
    })
    .filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (t.userPhone || '').includes(q) ||
        (t.userName || '').toLowerCase().includes(q) ||
        t.id.includes(q) ||
        (t.operator || '').toLowerCase().includes(q)
      )
    })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Transactions</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {pendingCount > 0
              ? <span className="text-yellow-600 font-semibold">{pendingCount} dépôt{pendingCount > 1 ? 's' : ''} en attente</span>
              : 'Aucun dépôt en attente'}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Filtres + recherche */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {(['pending', 'completed', 'failed', 'all'] as FilterStatut[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f ? 'bg-[#0B1668] text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              {f === 'pending'    ? `En attente${pendingCount > 0 ? ` (${pendingCount})` : ''}`
               : f === 'completed' ? 'Validés'
               : f === 'failed'    ? 'Rejetés'
               : `Tous (${transactions.length})`}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input type="text" placeholder="Téléphone, opérateur…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-300" />
        </div>
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
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Montant</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Opérateur</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><div className="h-4 bg-gray-100 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : displayed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Clock size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Aucune transaction</p>
                  </td>
                </tr>
              ) : displayed.map(tx => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-xs text-[#0B1668] font-medium">{tx.userPhone || tx.user_id.slice(0, 8)}</p>
                    {tx.userName && <p className="text-xs text-gray-400 mt-0.5">{tx.userName}</p>}
                  </td>
                  <td className="px-5 py-3.5 font-black text-[#0B1668]">{(tx.montant || 0).toLocaleString('fr-FR')} GNF</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs uppercase">{tx.operator || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      tx.statut === 'pending'    ? 'bg-yellow-100 text-yellow-700'
                      : tx.statut === 'completed' ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                    }`}>
                      {tx.statut === 'pending' ? 'En attente' : tx.statut === 'completed' ? 'Validé' : 'Rejeté'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {tx.statut === 'pending' ? (
                      <div className="flex gap-2">
                        <button onClick={() => approve(tx)} disabled={actionId === tx.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors">
                          <CheckCircle2 size={12} /> Valider
                        </button>
                        <button onClick={() => reject(tx)} disabled={actionId === tx.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors">
                          <XCircle size={12} /> Rejeter
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Traité</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#0B1668] border-t-transparent rounded-full animate-spin" /></div>}>
      <TransactionsContent />
    </Suspense>
  )
}
