'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Phone, Calendar, Shield, Wallet, Target, ArrowLeftRight, Bell, CheckCircle, XCircle } from 'lucide-react'
import { adminApi, AdminUser, AdminTransaction } from '@/lib/api'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [txs, setTxs] = useState<AdminTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [notifMsg, setNotifMsg] = useState('')
  const [notifTitle, setNotifTitle] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${id}`, {
        headers: { Authorization: `Bearer ${getCookie('admin_token')}` },
      }).then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/users/${id}/transactions`, {
        headers: { Authorization: `Bearer ${getCookie('admin_token')}` },
      }).then((r) => r.json()),
    ]).then(([u, t]) => {
      if (u.success) setUser(u.data)
      if (t.success) setTxs(t.data.items || [])
    }).finally(() => setLoading(false))
  }, [id])

  async function sendNotification() {
    if (!notifTitle.trim() || !notifMsg.trim()) return
    setSending(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getCookie('admin_token')}`,
        },
        body: JSON.stringify({ userId: id, title: notifTitle, body: notifMsg }),
      })
      if ((await res.json()).success) {
        setSent(true)
        setNotifTitle('')
        setNotifMsg('')
        setTimeout(() => setSent(false), 3000)
      }
    } finally {
      setSending(false)
    }
  }

  async function toggleBlock() {
    if (!user) return
    await adminApi.updateUser(id, { isBlocked: !user.isBlocked })
    setUser((u) => u ? { ...u, isBlocked: !u.isBlocked } : u)
  }

  async function updateKYC(status: AdminUser['kycStatus']) {
    await adminApi.updateUser(id, { kycStatus: status })
    setUser((u) => u ? { ...u, kycStatus: status } : u)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Chargement...</div>
  if (!user) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Utilisateur introuvable</div>

  const KYC_COLORS: Record<string, string> = {
    verified: 'bg-green-50 text-green-600',
    pending: 'bg-yellow-50 text-yellow-600',
    none: 'bg-gray-100 text-gray-500',
  }
  const KYC_LABELS: Record<string, string> = { verified: 'Vérifié', pending: 'En attente', none: 'Non vérifié' }

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-navy text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* User card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-navy/10 rounded-2xl flex items-center justify-center">
              <Phone size={20} className="text-navy" />
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.isBlocked ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
              {user.isBlocked ? 'Bloqué' : 'Actif'}
            </span>
          </div>
          <h2 className="font-black text-navy text-lg">{user.phone}</h2>
          {user.name && <p className="text-gray-500 text-sm">{user.name}</p>}

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar size={14} /> Inscrit le {user.createdAt}
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Wallet size={14} /> Solde: <span className="font-bold text-navy">{user.balance.toLocaleString()} GNF</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Shield size={14} /> KYC:
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${KYC_COLORS[user.kycStatus]}`}>
                {KYC_LABELS[user.kycStatus]}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            {user.kycStatus === 'pending' && (
              <div className="flex gap-2">
                <button onClick={() => updateKYC('verified')}
                  className="flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 text-xs font-medium py-2 rounded-xl hover:bg-green-100">
                  <CheckCircle size={14} /> Approuver KYC
                </button>
                <button onClick={() => updateKYC('none')}
                  className="flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-500 text-xs font-medium py-2 rounded-xl hover:bg-red-100">
                  <XCircle size={14} /> Rejeter
                </button>
              </div>
            )}
            <button onClick={toggleBlock}
              className={`w-full text-xs font-medium py-2 rounded-xl transition-colors ${
                user.isBlocked
                  ? 'bg-green-50 text-green-600 hover:bg-green-100'
                  : 'bg-red-50 text-red-500 hover:bg-red-100'
              }`}>
              {user.isBlocked ? 'Débloquer le compte' : 'Bloquer le compte'}
            </button>
          </div>
        </div>

        {/* Send notification */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-navy" />
            <h3 className="font-bold text-navy">Envoyer une notification</h3>
          </div>
          {sent && (
            <div className="bg-green-50 text-green-600 text-xs px-3 py-2 rounded-xl mb-3">
              Notification envoyée ✓
            </div>
          )}
          <div className="space-y-3">
            <input
              type="text"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              placeholder="Titre"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <textarea
              value={notifMsg}
              onChange={(e) => setNotifMsg(e.target.value)}
              placeholder="Message..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none"
            />
            <button
              onClick={sendNotification}
              disabled={sending || !notifTitle.trim() || !notifMsg.trim()}
              className="w-full bg-navy text-white text-sm font-bold py-2.5 rounded-xl hover:bg-navy-600 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </div>

        {/* Stats summary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-navy mb-4">Statistiques</h3>
          <div className="space-y-3">
            {[
              { icon: ArrowLeftRight, label: 'Total transactions', value: txs.length },
              { icon: Wallet, label: 'Volume total', value: `${txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0).toLocaleString()} GNF` },
              { icon: Target, label: 'Code parrainage', value: user.referralCode },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 bg-[#F5F5F7] rounded-lg flex items-center justify-center">
                  <Icon size={14} className="text-navy" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-bold text-navy text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction history */}
      <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-navy">Historique des transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Référence</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Type</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Opérateur</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium text-xs">Montant</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Statut</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Date</th>
              </tr>
            </thead>
            <tbody>
              {txs.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">Aucune transaction</td></tr>
              ) : txs.map((tx) => (
                <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{tx.reference}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.type === 'deposit' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                    }`}>{tx.type === 'deposit' ? 'Dépôt' : 'Retrait'}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{tx.operator || '—'}</td>
                  <td className={`px-5 py-3 text-right font-bold ${tx.type === 'withdrawal' ? 'text-red-500' : 'text-navy'}`}>
                    {tx.type === 'withdrawal' ? '-' : '+'}{tx.amount.toLocaleString()} GNF
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                    }`}>{tx.status === 'success' ? 'Réussi' : 'Échec'}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{tx.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : ''
}
