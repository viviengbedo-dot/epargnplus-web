'use client'
import { useEffect, useState, useCallback } from 'react'
import { Filter, Download } from 'lucide-react'
import { adminApi, AdminTransaction } from '@/lib/api'

function exportCSV(type: string, status: string) {
  const token = document.cookie.match(/admin_token=([^;]+)/)?.[1] || ''
  window.open(`${process.env.NEXT_PUBLIC_API_URL}/admin/export/transactions.csv?token=${token}&type=${type}&status=${status}`, '_blank')
}

const TYPE_OPTIONS = [
  { value: '', label: 'Tous types' },
  { value: 'deposit', label: 'Dépôts' },
  { value: 'withdrawal', label: 'Retraits' },
  { value: 'bonus', label: 'Bonus' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tous statuts' },
  { value: 'success', label: 'Réussi' },
  { value: 'pending', label: 'En cours' },
  { value: 'failed', label: 'Échec' },
]

export default function TransactionsPage() {
  const [txs, setTxs] = useState<AdminTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.transactions(page, type, status)
      setTxs(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page, type, status])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Transactions</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} transactions au total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCSV(type, status)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download size={15} /> CSV
          </button>
          <Filter size={16} className="text-gray-400" />
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Référence</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Utilisateur</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Type</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Opérateur</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium text-xs">Montant</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Statut</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + j * 8}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : txs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">Aucune transaction</td>
                </tr>
              ) : txs.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{tx.reference}</td>
                  <td className="px-5 py-3 text-navy font-medium">{tx.userPhone}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.type === 'deposit'    ? 'bg-green-50 text-green-600' :
                      tx.type === 'withdrawal' ? 'bg-orange-50 text-orange-500' :
                      tx.type === 'bonus'      ? 'bg-purple-50 text-purple-600' :
                      'bg-blue-50 text-blue-500'
                    }`}>
                      {tx.type === 'deposit' ? 'Dépôt' : tx.type === 'withdrawal' ? 'Retrait' : tx.type === 'bonus' ? 'Bonus' : tx.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{tx.operator || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-bold ${tx.type === 'withdrawal' ? 'text-red-500' : 'text-navy'}`}>
                      {tx.type === 'withdrawal' ? '-' : '+'}{tx.amount.toLocaleString()} GNF
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === 'success' ? 'bg-green-50 text-green-600' :
                      tx.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {tx.status === 'success' ? 'Réussi' : tx.status === 'pending' ? 'En cours' : 'Échec'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{tx.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Page {page} sur {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Précédent
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
