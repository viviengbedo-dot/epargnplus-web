'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Smartphone, Clock, Copy, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { clientApi, DepositResult } from '@/lib/client-api'

const OPERATORS = [
  {
    id: 'orange-money',
    name: 'Orange Money',
    short: 'OM',
    bg: 'bg-orange-500',
    ring: 'ring-orange-400',
    selected: 'border-orange-400 bg-orange-50',
    text: 'text-orange-600',
  },
  {
    id: 'mtn-momo',
    name: 'MTN MoMo',
    short: 'MTN',
    bg: 'bg-yellow-400',
    ring: 'ring-yellow-400',
    selected: 'border-yellow-400 bg-yellow-50',
    text: 'text-yellow-600',
  },
]

const QUICK_AMOUNTS = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000]

export default function DepositPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState('orange-money')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DepositResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    clientApi.profile().then((p) => setPhone(p.phone)).catch(() => router.push('/dashboard/login'))
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const amt = parseInt(amount, 10)
    if (!amt || amt < 1000) { setError('Montant minimum : 1 000 GNF'); return }
    setLoading(true)
    try {
      const res = await clientApi.deposit({ amount: amt, mobileOperator: operator, phone })
      setResult(res)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function copyRef() {
    if (!result) return
    navigator.clipboard.writeText(result.reference).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ── Success screen ── */
  if (result) {
    return (
      <>
        {/* Back header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/dashboard')}
            className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-gray-100 shadow-sm">
            <ArrowLeft size={18} className="text-navy" />
          </button>
          <h1 className="text-xl font-black text-navy">Instructions de dépôt</h1>
        </div>

        {/* Operator card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black ${
              operator === 'orange-money' ? 'bg-orange-500' : 'bg-yellow-400'
            }`}>
              {operator === 'orange-money' ? 'OM' : 'MTN'}
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Envoyez via {result.operatorLabel}</p>
              <p className="text-2xl font-black text-navy tracking-tight">{result.merchantNumber}</p>
            </div>
          </div>
          <div className="bg-[#F5F5F7] rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Montant à envoyer</p>
              <p className="font-black text-navy text-lg">{result.amount.toLocaleString('fr-FR')} GNF</p>
            </div>
            <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center">
              <Smartphone size={18} className="text-navy" />
            </div>
          </div>
        </div>

        {/* Reference */}
        <div className="bg-navy rounded-2xl p-5 mb-4">
          <p className="text-white/50 text-xs mb-2 font-medium">Référence (motif du paiement)</p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono font-black text-lime text-xl tracking-wider">{result.reference}</p>
            <button onClick={copyRef}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}>
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          <p className="text-white/40 text-xs mt-2">⚠ Obligatoire — mentionnez cette référence dans le motif du paiement.</p>
        </div>

        {/* Timer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Clock size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-800 font-bold text-sm">Traitement sous 15–30 minutes</p>
            <p className="text-yellow-700 text-xs mt-0.5 leading-relaxed">
              Après réception du paiement, votre solde sera crédité automatiquement. Vous recevrez une notification de confirmation.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <p className="text-navy font-bold text-sm mb-3">Étapes à suivre</p>
          <div className="space-y-3">
            {[
              `Ouvrez votre app ${result.operatorLabel}`,
              `Sélectionnez "Transfert d'argent"`,
              `Saisissez le numéro : ${result.merchantNumber}`,
              `Montant : ${result.amount.toLocaleString('fr-FR')} GNF`,
              `Motif / référence : ${result.reference}`,
              'Validez avec votre PIN Mobile Money',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 bg-navy rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-lime text-[9px] font-black">{i + 1}</span>
                </div>
                <p className="text-gray-600 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => router.push('/dashboard')}
          className="w-full bg-lime text-navy font-black py-4 rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          J&apos;ai effectué le paiement <ArrowRight size={18} />
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
          <h1 className="text-xl font-black text-navy leading-tight">Dépôt Mobile Money</h1>
          <p className="text-xs text-gray-400">Alimentez votre Coffre Epargn+</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl">
            {error}
          </div>
        )}

        {/* Operator */}
        <div>
          <label className="block text-sm font-bold text-navy mb-3">Choisissez votre opérateur</label>
          <div className="grid grid-cols-2 gap-3">
            {OPERATORS.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setOperator(op.id)}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                  operator === op.id ? op.selected + ' border-2' : 'border-gray-100 bg-white hover:border-gray-200'
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
          <label className="block text-sm font-bold text-navy mb-2">Numéro Mobile Money</label>
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
          <p className="text-xs text-gray-400 mt-1.5 px-1">Le numéro associé à votre compte {OPERATORS.find(o => o.id === operator)?.name}.</p>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-bold text-navy mb-2">Montant (GNF)</label>
          <input
            type="number"
            min="1000"
            step="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy bg-white text-lg font-bold"
            placeholder="0"
          />
          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {QUICK_AMOUNTS.map((q) => (
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
          <p className="text-xs text-gray-400 mt-2 px-1">Montant minimum : 1 000 GNF</p>
        </div>

        {/* Summary */}
        {amount && parseInt(amount) >= 1000 && (
          <div className="bg-[#F5F5F7] rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-2 font-medium">Récapitulatif</p>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Montant déposé</span>
              <span className="font-black text-navy">{parseInt(amount).toLocaleString('fr-FR')} GNF</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-500">Frais de dépôt</span>
              <span className="font-medium text-green-600">Gratuit</span>
            </div>
            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between items-center">
              <span className="font-bold text-navy text-sm">Crédité sur votre coffre</span>
              <span className="font-black text-lime text-lg">{parseInt(amount).toLocaleString('fr-FR')} GNF</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-lime text-navy font-black py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-40 text-base"
        >
          {loading ? 'Traitement…' : 'Confirmer le dépôt →'}
        </button>
      </form>

      {/* Info footer */}
      <div className="mt-6 bg-navy/5 rounded-2xl p-4 flex items-start gap-3">
        <Clock size={15} className="text-navy/50 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 leading-relaxed">
          Après validation, vous recevrez un numéro marchand et une référence à communiquer lors de votre paiement Mobile Money. Traitement sous 15–30 min.
        </p>
      </div>
    </>
  )
}
