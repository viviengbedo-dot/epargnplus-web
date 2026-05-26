'use client'
import { useState } from 'react'
import { Bell, Users, Send } from 'lucide-react'

export default function BroadcastPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [target, setTarget] = useState<'all' | 'active'>('all')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function send() {
    if (!title.trim() || !body.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const token = document.cookie.match(/admin_token=([^;]+)/)?.[1] || ''
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body, target }),
      })
      const json = await res.json()
      setResult({ success: json.success, message: json.success ? `Envoyé à ${json.data?.count ?? 0} utilisateurs` : json.message })
      if (json.success) { setTitle(''); setBody('') }
    } catch {
      setResult({ success: false, message: 'Erreur réseau' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-navy">Notifications</h1>
        <p className="text-gray-500 text-sm mt-0.5">Envoyer un message à tous les utilisateurs</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex gap-3">
          {(['all', 'active'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                target === t ? 'bg-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t === 'all' ? <><Users size={14} /> Tous les users</> : <><Bell size={14} /> Users actifs</>}
            </button>
          ))}
        </div>

        {result && (
          <div className={`px-3 py-2 rounded-xl text-sm ${result.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {result.message}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Titre</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Nouveauté Epargn+"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Votre message..."
            rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{body.length}/160 caractères</p>
        </div>

        <button
          onClick={send}
          disabled={loading || !title.trim() || !body.trim()}
          className="w-full flex items-center justify-center gap-2 bg-navy text-white font-bold py-3 rounded-xl hover:bg-navy-600 disabled:opacity-50 transition-colors"
        >
          <Send size={16} />
          {loading ? 'Envoi en cours...' : 'Envoyer la notification'}
        </button>
      </div>
    </div>
  )
}
