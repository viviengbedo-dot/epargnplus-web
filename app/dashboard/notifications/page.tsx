'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, Check, CheckCheck, Settings2 } from 'lucide-react'
import { clientApi } from '@/lib/client-api'

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  date: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `il y a ${d}j`
  if (h > 0) return `il y a ${h}h`
  if (m > 0) return `il y a ${m}min`
  return "a l'instant"
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const data = await clientApi.notifications()
      setNotifs(data)
    } catch {
      router.push('/dashboard/login')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  async function markRead(id: string) {
    await clientApi.markNotificationRead(id)
    setNotifs((n) => n.map((x) => x.id === id ? { ...x, read: true } : x))
  }

  async function markAllRead() {
    await clientApi.markAllRead()
    setNotifs((n) => n.map((x) => ({ ...x, read: true })))
  }

  const unread = notifs.filter((n) => !n.read).length

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm animate-pulse">Chargement...</div>
  )

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-navy">Notifications</h1>
          {unread > 0 && <p className="text-gray-400 text-xs mt-0.5">{unread} non lue{unread > 1 ? 's' : ''}</p>}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 text-xs text-navy font-medium bg-navy/5 hover:bg-navy/10 px-3 py-1.5 rounded-xl transition-colors">
              <CheckCheck size={13} /> Tout lire
            </button>
          )}
          <button onClick={() => router.push('/dashboard/notifications/settings')}
            className="w-8 h-8 bg-white border border-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm">
            <Settings2 size={15} className="text-navy" />
          </button>
        </div>
      </div>

      {notifs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
            <BellOff size={24} className="text-gray-300" />
          </div>
          <p className="font-bold text-navy">Aucune notification</p>
          <p className="text-gray-400 text-sm mt-1">Vous serez notifie de vos transactions et actualites ici.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <button key={n.id} onClick={() => !n.read && markRead(n.id)}
              className={`w-full text-left bg-white rounded-2xl p-4 border shadow-sm transition-all ${
                n.read ? 'border-gray-100 opacity-70' : 'border-navy/10 shadow-navy/5'
              }`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  n.read ? 'bg-gray-100' : 'bg-navy'
                }`}>
                  <Bell size={15} className={n.read ? 'text-gray-400' : 'text-lime'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-bold truncate ${n.read ? 'text-gray-600' : 'text-navy'}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(n.date)}</span>
                      {!n.read && <span className="w-2 h-2 bg-lime rounded-full flex-shrink-0" />}
                    </div>
                  </div>
                  {n.body && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  {n.read && (
                    <div className="flex items-center gap-1 mt-1">
                      <Check size={11} className="text-gray-300" />
                      <span className="text-xs text-gray-300">Lu</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
