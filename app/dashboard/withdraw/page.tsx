'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Smartphone, Clock, CheckCircle2, AlertTriangle, ArrowRight,
} from 'lucide-react'
import { clientApi, WithdrawResult } from '@/lib/client-api'

const OPERATORS = [
  {
    id: 'orange-money',
    name: 'Orange Money',
    short: 'OM',
    bg: 'bg-orange-500',
    selected: 'border-orange-400 bg-orange-50',
    text: 'text-orange-600',
  },
  {
    id: 'mtn-momo',
    name: 'MTN MoMo',
    short: 'MTN',
    bg: 'bg-yellow-400',
    selected: 'border-yellow-400 bg-yellow-50',
    text: 'text-yellow-600',
  },
]

const QUICK_AMOUNTS = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000]
const FEE_RATE = 0.01 // 1%

export default function WithdrawPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [balance, setBalance] = useState(0)
  const [operator, setOperator] = useState('orange-money')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<WithdrawResult | null>(null)

  useEffect(() => {
    clientApi.profile()
      .then((p) => { setPhone(p.phone); setBalance(p.balance) })
      .catch(() => router.push('/dashboard/login'))
  }, [router])

  const fee = amount ? Math.ceil(parseInt(amount) * FEE_RATE) : 0
  const net = amount ? Math.max(0, parseInt(amount) - fee) : 0
  const insufficientFunds = !!amount && parseInt(amount) > balance

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const amt = parseInt(amount, 10)
    if (!amt || amt < 1000) { setError('Montant minimum : 1 000 GNF'); return }
    if (amt > balance) { setError('Solde insuffisant.'); return }
    setLoading(true)
    try {
      const res = await clientApi.withdraw({ amount: amt, mobileOperator: operator, phone })
      setResult(res)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  /* ── Success screen ── */
  if (result) {
    return (
      <>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/dashboard')}
            className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm">
            <ArrowLeft size={18} className="text-navy" />
          </button>
          <h1 className="text-xl font-black text-navy">Retrait en cours</h1>
        </div>

        {/* Status card */}
        <div className="bg-navy rounded-2xl p-6 mb-5 text-center">
          <div className="w-16 h-16 bg-lime/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-lime" />
          </div>
          <p className="text-white font-black text-xl mb-1">Demande enregistrée</p>
          <p className="text-white/50 text-sm">Votre retrait sera traité sous 15–30 minutes.</p>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-3">
          <p className="text-navy font-bold text-sm mb-1">Détails du retrait</p>
          {[
            { label: 'Référence', value: result.reference, mono: true },
            { label: 'Montant retiré', value: `${result.amount.toLocaleString('fr-FR')} GNF` },
            { label: 'Frais (1%)', value: `−${result.fee.toLocaleString('fr-FR')} GNF`, negative: true },
            { label: 'Vous recevrez', value: `${(result.amount - result.fee).toLocaleString('fr-FR')} GNF`, bold: true },
          ].map(({ label, value, mono, negative, bold }) => (
            <div key={label} className="flex items-center justify-between text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
              <span className="text-gray-500">{label}</span>
              <span className={`${mono ? 'font-mono font-bold text-navy' : ''} ${negative ? 'text-orange-500 font-medium' : ''} ${bold ? 'font-black text-lime text-base' : 'text-navy font-medium'}`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-700 text-xs leading-relaxed">
            L&apos;argent sera envoyé sur votre numéro {phone} via {OPERATORS.find(o => o.id === operator)?.name}. Votre solde a déjà été réservé.
          </p>
        </div>

        <button onClick={() => router.push('/dashboard')}
          className="w-full bg-navy text-white font-black py-4 rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          Retour au Coffre <ArrowRight size={18} />
        </button>
      </>
    )
  }

  /* ── Form screen ── */
  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
          <ArrowLeft size={18} className="text-navy" />
        </button>
        <div>
          <h1 className="text-xl font-black text-navy leading-tight">Retrait Mobile Money</h1>
          <p className="text-xs text-gray-400">Transférez vers votre Mobile Money</p>
        </div>
      </div>

      {/* Balance info */}
      <div className="bg-navy rounded-2xl p-4 mb-6 flex items-center justify-between">
        <div>
          <p className="text-white/50 text-xs font-medium mb-0.5">Solde disponible</p>
          <p className="text-white font-black text-xl">{balance.toLocaleString('fr-FR')} <span className="text-lime text-sm font-bold">GNF</span></p>
        </div>
        <button
          type="button"
          onClick={() => setAmount(String(balance))}
          className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
        >
          Tout retirer
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl flex items-center gap-2">
            <AlertTriangle size={15} /> {error}
          </div>
        )}

        {/* Operator */}
        <div>
          <label className="block text-sm font-bold text-navy mb-3">Opérateur de réception</label>
          <div className="grid grid-cols-2 gap-3">
            {OPERATORS.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setOperator(op.id)}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                  operator === op.id ? op.selected : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-sm ${op.bg}`}>
                  {op.short}
                </div>
                <span className={`text-sm font-bold ${operator === op.id ? op.text : 'text-gray-600'}`}>
                  {op.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-bold text-navy mb-2">Numéro de réception</label>
          <div className="relative">
            <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white"
              placeholder="+224 620 00 00 00"
            />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-bold text-navy mb-2">Montant à retirer (GNF)</label>
          <input
            type="number"
            min="1000"
            max={balance}
            step="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className={`w-full px-4 py-3.5 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 bg-white text-lg font-bold transition-colors ${
              insufficientFunds ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-navy'
            }`}
            placeholder="0"
          />
          {insufficientFunds && (
            <p className="text-red-500 text-xs mt-1.5 px-1">Solde insuffisant (disponible : {balance.toLocaleString('fr-FR')} GNF)</p>
          )}
          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {QUICK_AMOUNTS.filter(q => q <= balance).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className={`py-2 rounded-xl text-xs font-bold transition-colors border ${
                  amount === String(q)
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-navy border-gray-200 hover:border-navy/30'
                }`}
              >
                {q.toLocaleString('fr-FR')}
              </button>
            ))}
          </div>
        </div>

        {/* Fee summary */}
        {amount && parseInt(amount) >= 1000 && (
          <div className={`rounded-2xl p-4 ${insufficientFunds ? 'bg-red-50' : 'bg-[#F5F5F7]'}`}>
            <p className="text-xs text-gray-400 mb-2 font-medium">Récapitulatif</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Montant retiré</span>
                <span className="font-bold text-navy">{parseInt(amount).toLocaleString('fr-FR')} GNF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Frais service (1%)</span>
                <span className="text-orange-500 font-medium">−{fee.toLocaleString('fr-FR')} GNF</span>
              </div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between">
                <span className="font-bold text-navy text-sm">Vous recevrez</span>
                <span className="font-black text-lime text-base">{net.toLocaleString('fr-FR')} GNF</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || insufficientFunds || !amount}
          className="w-full bg-navy text-white font-black py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-40 text-base"
        >
          {loading ? 'Traitement…' : 'Confirmer le retrait →'}
        </button>
      </form>

      <div className="mt-4 bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-start gap-3">
        <Clock size={15} className="text-orange-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-orange-700 leading-relaxed">
          Un frais de <strong>1%</strong> est appliqué sur chaque retrait. L&apos;argent est envoyé sur votre Mobile Money sous 15–30 minutes.
        </p>
      </div>
    </>
  )
}
