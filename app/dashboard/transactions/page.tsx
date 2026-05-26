'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight, Gift, ArrowLeftRight } from 'lucide-react'
import { clientApi, Transaction } from '@/lib/client-api'

type Filter = 'all' | 'deposit' | 'withdrawal' | 'bonus'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'deposit', label: 'Dépôts' },
  { id: 'withdrawal', label: 'Retraits' },
  { id: 'bonus', label: 'Bonus' },
]

function txIcon(type: Transaction['type']) {
  if (type === 'deposit') return <ArrowDownLeft size={16} className="text-green-600" />
  if (type === 'withdrawal') return <ArrowUpRight size={16} className="text-orange-500" />
  if (type === 'bonus') return <Gift size={16} className="text-purple-500" />
  return <ArrowLeftRight size={16} className="text-blue-500" />
}

function txBg(type: Transaction['type']) {
  if (type === 'deposit') return 'bg-green-50'
  if (type === 'withdrawal') return 'bg-orange-50'
  if (type === 'bonus') return 'bg-purple-50'
  return 'bg-blue-50'
}

function txColor(type: Transaction['type']) {
  if (type === 'deposit' || type === 'bonus') return 'text-green-600'
  return 'text-orange-500'
}

export default function TransactionsPage() {
  const router = useRouter()
  const [all, setAll] = useState<Transaction[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    clientApi.transactions()
      .then(setAll)
      .catch(() => router.push('/dashboard/login'))
      .finally(() => setLoading(false))
  }, [router])

  const list = filter === 'all' ? all : all.filter((t) => t.type === filter)

  function groupByDate(txs: Transaction[]) {
    const map = new Map<string, Transaction[]>()
    txs.forEach((tx) => {
      const d = new Date(tx.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
      const key = d.charAt(0).toUpperCase() + d.slice(1)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(tx)
    })
    return Array.from(map.entries())
  }

  const grouped = groupByDate(list)

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-black text-navy">Historique</h1>
        <p className="text-gray-400 text-xs mt-0.5">Toutes vos opérations</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === id
                ? 'bg-navy text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-navy/40'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm animate-pulse">
          Chargement...
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">Aucune transaction</p>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([date, txs]) => (
          <div key={date}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              {date}
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
              {txs.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${txBg(tx.type)}`}>
                    {txIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{tx.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{tx.reference}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${txColor(tx.type)}`}>
                      {tx.type === 'withdrawal' ? '-' : '+'}{tx.amount.toLocaleString('fr-FR')} GNF
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      tx.status === 'success' ? 'bg-green-50 text-green-600' :
                      tx.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {tx.status === 'success' ? 'Réussi' : tx.status === 'pending' ? 'En cours' : 'Échoué'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
