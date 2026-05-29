'use client'
import { useEffect, useState, Suspense } from 'react'
import { CheckCircle2, XCircle, RefreshCw, AlertCircle, Clock } from 'lucide-react'
import { administrationApi, AdminDataTransaction, AdminDataUser } from '@/lib/administration-api'

type TxWithUser = AdminDataTransaction & { userPhone?: string }

function TransactionsContent() {
  const [transactions, setTransactions] = useState<TxWithUser[]>([])
  const [users, setUsers] = useState<AdminDataUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [actionId, setActionId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await administrationApi.getData()
      setUsers(data.users)
      // Combine pending transactions + pending_deposit from users
      const txns: TxWithUser[] = [...data.pendingTransactions]

      // Ajouter les dépôts depuis pending_deposit des users (si pas déjà dans transactions)
      data.users.forEach(u => {
        if (!u.pending_deposit) return
        try {
          const pd = JSON.parse(u.pending_deposit)
          if (pd && pd.amount > 0 && !txns.find(t => t.id === pd.txnId)) {
            txns.push({
              id: pd.txnId || `pd_${u.id}`,
              user_id: u.id,
              type: 'depot',
              montant: pd.amount,
              operator: pd.operator || 'Mobile Money',
              statut: 'pending',
              created_at: pd.requestedAt || new Date().toISOString(),
              userPhone: u.phone,
            })
          }
        } catch {}
      })

      setTransactions(txns.map(t => ({
        ...t,
        userPhone: t.userPhone || data.users.find(u => u.id === t.user_id)?.phone || t.user_id,
      })))
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

  const displayed = filter === 'pending'
    ? transactions.filter(t => t.statut === 'pending')
    : transactions

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Transactions</h1>
          <p className="text-gray-400 text-sm mt-0.5">{transactions.filter(t => t.statut === 'pending').length} dépôt{transactions.filter(t => t.statut === 'pending').length !== 1 ? 's' : ''} en attente</p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value as 'pending' | 'all')}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none bg-white">
            <option value="pending">En attente</option>
            <option value="all">Toutes</option>
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
                    <p className="text-gray-400 text-sm">Aucun dépôt {filter === 'pending' ? 'en attente' : ''}</p>
                  </td>
                </tr>
              ) : displayed.map(tx => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-[#0B1668] font-medium">{tx.userPhone}</td>
                  <td className="px-5 py-3.5 font-black text-[#0B1668]">{tx.montant.toLocaleString('fr-FR')} GNF</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs uppercase">{tx.operator || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      tx.statut === 'pending' ? 'bg-yellow-100 text-yellow-700'
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
                          <CheckCircle2 size={12} /> Confirmer
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
