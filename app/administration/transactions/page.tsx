'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Search, RefreshCw, AlertCircle } from 'lucide-react'
import { adminApi, AdminTransaction } from '@/lib/api'

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  success: 'Confirmé',
  failed: 'Refusé',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}
const TYPE_LABELS: Record<string, string> = {
  deposit: 'Dépôt',
  withdrawal: 'Retrait',
  transfer: 'Transfert',
  bonus: 'Bonus',
}

function TransactionsContent() {
  const searchParams = useSearchParams()
  const [transactions, setTransactions] = useState<AdminTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') || '')
  const [type, setType] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.transactions(page, type, status)
      setTransactions(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Impossible de charger les transactions.')
    } finally {
      setLoading(false)
    }
  }, [page, type, status])

  useEffect(() => { fetchData() }, [fetchData])

  async function confirmTx(id: string) {
    setActionId(id)
    try {
      await adminApi.confirmTransaction(id)
      fetchData()
    } catch (e) {
      alert((e as Error).message || 'Erreur lors de la confirmation')
    } finally {
      setActionId(null)
    }
  }

  async function rejectTx(id: string) {
    setActionId(id)
    try {
      await adminApi.rejectTransaction(id)
      fetchData()
    } catch (e) {
      alert((e as Error).message || 'Erreur lors du rejet')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Transactions</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} transaction{total !== 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-gray-400" />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="flex-1 text-sm border-0 outline-none bg-transparent text-gray-600"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="success">Confirmé</option>
            <option value="failed">Refusé</option>
          </select>
        </div>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1) }}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none"
        >
          <option value="">Tous les types</option>
          <option value="deposit">Dépôt</option>
          <option value="withdrawal">Retrait</option>
          <option value="transfer">Transfert</option>
          <option value="bonus">Bonus</option>
        </select>
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
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Montant</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Opérateur</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Référence</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Actions</th>
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
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">
                    Aucune transaction trouvée
                  </td>
                </tr>
              ) : transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-[#0B1668]">{tx.userPhone}</td>
                  <td className="px-5 py-3.5">
                    <span className="bg-[#0B1668]/10 text-[#0B1668] px-2.5 py-1 rounded-lg text-xs font-medium">
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-black text-[#0B1668]">
                    {tx.amount.toLocaleString('fr-FR')} GNF
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 uppercase text-xs">{tx.operator || '—'}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{tx.reference || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[tx.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[tx.status] ?? tx.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {tx.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => confirmTx(tx.id)}
                          disabled={actionId === tx.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle2 size={12} /> Confirmer
                        </button>
                        <button
                          onClick={() => rejectTx(tx.id)}
                          disabled={actionId === tx.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                        >
                          <XCircle size={12} /> Rejeter
                        </button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-gray-300">
                        {tx.status === 'success'
                          ? <CheckCircle2 size={14} className="text-green-400" />
                          : <XCircle size={14} className="text-red-300" />}
                        Traité
                      </span>
                    )}
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

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0B1668] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  )
}
