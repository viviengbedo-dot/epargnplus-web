'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft, ArrowUpRight, Target, ChevronRight,
  TrendingUp, Plus, X, Check, Clock, Smartphone,
} from 'lucide-react'
import { clientApi, UserProfile, Transaction, Project, DepositResult, WithdrawResult } from '@/lib/client-api'

const OPERATORS = [
  { id: 'orange-money', label: 'Orange Money' },
  { id: 'mtn-momo', label: 'MTN MoMo' },
]

function fmtGNF(v: number) {
  return v.toLocaleString('fr-FR') + ' GNF'
}

function txColor(type: Transaction['type']) {
  if (type === 'deposit' || type === 'bonus') return 'text-green-600'
  if (type === 'withdrawal') return 'text-orange-500'
  return 'text-blue-500'
}

function txSign(type: Transaction['type']) {
  return type === 'deposit' || type === 'bonus' ? '+' : '-'
}

type Modal = null | 'deposit' | 'withdraw'

export default function DashboardHome() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Modal>(null)

  // Form state
  const [fAmount, setFAmount] = useState('')
  const [fPhone, setFPhone] = useState('')
  const [fOperator, setFOperator] = useState('orange')
  const [fLoading, setFLoading] = useState(false)
  const [fError, setFError] = useState('')
  const [fSuccess, setFSuccess] = useState('')
  const [fDepositResult, setFDepositResult] = useState<DepositResult | null>(null)
  const [fWithdrawResult, setFWithdrawResult] = useState<WithdrawResult | null>(null)

  useEffect(() => {
    Promise.all([clientApi.profile(), clientApi.transactions(), clientApi.projects()])
      .then(([p, tx, pr]) => {
        setProfile(p)
        setTransactions(tx.slice(0, 5))
        setProjects(pr.filter((p) => p.status === 'ACTIVE').slice(0, 3))
      })
      .catch(() => router.push('/dashboard/login'))
      .finally(() => setLoading(false))
  }, [router])

  function openModal(type: Modal) {
    setFAmount('')
    setFPhone(profile?.phone ?? '')
    setFOperator('orange-money')
    setFError('')
    setFSuccess('')
    setFDepositResult(null)
    setFWithdrawResult(null)
    setModal(type)
  }

  async function handleAction(e: React.FormEvent) {
    e.preventDefault()
    setFError('')
    setFLoading(true)
    try {
      const amount = parseInt(fAmount, 10)
      if (modal === 'deposit') {
        const result = await clientApi.deposit({ amount, mobileOperator: fOperator, phone: fPhone })
        setFDepositResult(result)
      } else {
        const result = await clientApi.withdraw({ amount, mobileOperator: fOperator, phone: fPhone })
        setFWithdrawResult(result)
        // Balance already reserved — refresh
        const updated = await clientApi.profile()
        setProfile(updated)
        const tx = await clientApi.transactions()
        setTransactions(tx.slice(0, 5))
      }
    } catch (err) {
      setFError((err as Error).message)
    } finally {
      setFLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm animate-pulse">
        Chargement...
      </div>
    )
  }

  return (
    <>
      {/* Balance card */}
      <div className="bg-navy rounded-2xl p-6 text-white mb-4 shadow-lg">
        <p className="text-white/50 text-xs font-medium mb-1">Solde disponible</p>
        <p className="text-4xl font-black tracking-tight mb-0.5">
          {(profile?.balance ?? 0).toLocaleString('fr-FR')}
        </p>
        <p className="text-lime text-sm font-bold">GNF</p>
        <div className="flex items-center gap-1 mt-3 text-white/40 text-xs">
          <TrendingUp size={12} />
          <span>Membre depuis {profile?.memberSince}</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => openModal('deposit')}
          className="bg-lime text-navy rounded-2xl p-4 flex items-center gap-3 font-bold shadow-sm hover:opacity-90 transition-opacity"
        >
          <div className="w-9 h-9 bg-navy/10 rounded-xl flex items-center justify-center">
            <ArrowDownLeft size={18} />
          </div>
          Déposer
        </button>
        <button
          onClick={() => openModal('withdraw')}
          className="bg-white text-navy rounded-2xl p-4 flex items-center gap-3 font-bold border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <div className="w-9 h-9 bg-navy/5 rounded-xl flex items-center justify-center">
            <ArrowUpRight size={18} />
          </div>
          Retirer
        </button>
      </div>

      {/* Active projects */}
      {projects.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-navy text-sm">Projets d&apos;épargne</h2>
            <button
              onClick={() => router.push('/dashboard/projects')}
              className="text-xs text-navy/60 hover:text-navy flex items-center gap-0.5"
            >
              Voir tout <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {projects.map((p) => {
              const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-navy">{p.name}</span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5 text-xs text-gray-400">
                    <span>{p.currentAmount.toLocaleString('fr-FR')} GNF</span>
                    <span>{p.goalAmount.toLocaleString('fr-FR')} GNF</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-navy text-sm">Transactions récentes</h2>
          <button
            onClick={() => router.push('/dashboard/transactions')}
            className="text-xs text-navy/60 hover:text-navy flex items-center gap-0.5"
          >
            Voir tout <ChevronRight size={12} />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {transactions.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">Aucune transaction</p>
          )}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                tx.type === 'deposit' || tx.type === 'bonus'
                  ? 'bg-green-50'
                  : tx.type === 'withdrawal'
                  ? 'bg-orange-50'
                  : 'bg-blue-50'
              }`}>
                {tx.type === 'deposit' || tx.type === 'bonus'
                  ? <ArrowDownLeft size={16} className="text-green-600" />
                  : <ArrowUpRight size={16} className="text-orange-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy truncate">{tx.label}</p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${txColor(tx.type)}`}>
                  {txSign(tx.type)}{tx.amount.toLocaleString('fr-FR')} GNF
                </p>
                <p className={`text-xs ${
                  tx.status === 'success' ? 'text-green-500' :
                  tx.status === 'pending' ? 'text-yellow-500' : 'text-red-400'
                }`}>
                  {tx.status === 'success' ? 'Réussi' : tx.status === 'pending' ? 'En cours' : 'Échoué'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create project shortcut */}
      <button
        onClick={() => router.push('/dashboard/projects')}
        className="w-full mt-4 border-2 border-dashed border-navy/20 rounded-2xl p-4 flex items-center justify-center gap-2 text-navy/50 hover:border-navy/40 hover:text-navy/70 transition-colors"
      >
        <Plus size={16} />
        <span className="text-sm font-medium">Créer un projet d&apos;épargne</span>
      </button>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-navy text-lg">
                {modal === 'deposit' ? 'Déposer de l\'argent' : 'Retirer de l\'argent'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Deposit instructions screen */}
            {fDepositResult ? (
              <div className="py-2">
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Smartphone size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-orange-600 font-medium">Envoyez via {fDepositResult.operatorLabel}</p>
                      <p className="text-xl font-black text-navy">{fDepositResult.merchantNumber}</p>
                    </div>
                  </div>
                  <div className="border-t border-orange-200 pt-3">
                    <p className="text-xs text-gray-500 mb-1">Montant à envoyer</p>
                    <p className="font-bold text-navy">{fDepositResult.amount.toLocaleString('fr-FR')} GNF</p>
                  </div>
                </div>
                <div className="bg-navy/5 rounded-xl p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1">Référence (motif du paiement)</p>
                  <p className="font-mono font-bold text-navy text-lg tracking-wider">{fDepositResult.reference}</p>
                  <p className="text-xs text-gray-400 mt-1">Obligatoire — permet de valider votre dépôt</p>
                </div>
                <div className="flex items-start gap-2 mb-4">
                  <Clock size={14} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500">Votre solde sera crédité dans <strong>15–30 minutes</strong> après réception du paiement.</p>
                </div>
                <button
                  onClick={() => setModal(null)}
                  className="w-full bg-navy text-white font-bold py-3 rounded-xl"
                >
                  J&apos;ai envoyé le paiement
                </button>
              </div>
            ) : fWithdrawResult ? (
              /* Withdraw pending screen */
              <div className="py-2 text-center">
                <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Clock size={28} className="text-yellow-500" />
                </div>
                <p className="font-black text-navy text-lg mb-1">Retrait en cours</p>
                <p className="text-gray-400 text-sm mb-4">Votre demande est enregistrée et sera traitée sous 15–30 minutes.</p>
                <div className="bg-gray-50 rounded-xl p-4 text-left mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Référence</span>
                    <span className="font-mono font-bold text-navy">{fWithdrawResult.reference}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Montant</span>
                    <span className="font-bold text-navy">{fWithdrawResult.amount.toLocaleString('fr-FR')} GNF</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Frais (1%)</span>
                    <span className="text-gray-500">−{fWithdrawResult.fee.toLocaleString('fr-FR')} GNF</span>
                  </div>
                </div>
                <button
                  onClick={() => setModal(null)}
                  className="w-full bg-navy text-white font-bold py-3 rounded-xl"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleAction} className="space-y-4">
                {fError && (
                  <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-xl border border-red-100">
                    {fError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">Opérateur</label>
                  <div className="grid grid-cols-2 gap-2">
                    {OPERATORS.map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setFOperator(op.id)}
                        className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                          fOperator === op.id
                            ? 'border-navy bg-navy text-white'
                            : 'border-gray-200 text-gray-600 hover:border-navy/40'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">Numéro Mobile Money</label>
                  <input
                    type="tel"
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                    placeholder="+224 620 00 00 00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-navy mb-1.5">Montant (GNF)</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={fAmount}
                    onChange={(e) => setFAmount(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                    placeholder="Ex : 50 000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={fLoading}
                  className={`w-full font-bold py-3 rounded-xl transition-opacity disabled:opacity-40 ${
                    modal === 'deposit'
                      ? 'bg-lime text-navy'
                      : 'bg-navy text-white'
                  }`}
                >
                  {fLoading ? 'Traitement...' : modal === 'deposit' ? 'Confirmer le dépôt' : 'Confirmer le retrait'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
