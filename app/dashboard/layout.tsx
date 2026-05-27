'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home, ArrowLeftRight, Target, Rocket,
  User, Bell, Gift, HelpCircle, LogOut,
} from 'lucide-react'
import { clearClientToken, clientApi } from '@/lib/client-api'

/* ─── Nav config ─────────────────────────────────────────── */
const NAV = [
  { href: '/dashboard',              label: 'Coffre',     icon: Home          },
  { href: '/dashboard/projects',     label: 'Projets',    icon: Target        },
  { href: '/dashboard/tontine',      label: 'Lancer',     icon: Rocket        },
  { href: '/dashboard/transactions', label: 'Mouvements', icon: ArrowLeftRight},
]

const NAV_SIDE = [
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell      },
  { href: '/dashboard/referral',       label: 'Parrainer',    icon: Gift      },
  { href: '/dashboard/support',        label: 'Aide',         icon: HelpCircle},
  { href: '/dashboard/profile',        label: 'Mon Profil',   icon: User      },
]

function isActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

/* ─── Layout ─────────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [unread, setUnread] = useState(0)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    clientApi.unreadCount().then((d) => setUnread(d.count)).catch(() => {})
    clientApi.profile().then((p) => setUserName(p.firstName ?? '')).catch(() => {})
  }, [pathname])

  function handleLogout() {
    clearClientToken()
    router.push('/dashboard/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4FA]">

      {/* ── Top bar ───────────────────────────────────────── */}
      <header className="bg-navy text-white px-5 pt-10 pb-4 flex items-center justify-between sticky top-0 z-40">
        <div>
          <p className="text-white/40 text-[11px] font-medium">Bonjour 👋</p>
          <p className="text-white font-black text-[17px] leading-tight">
            {userName || 'Utilisateur'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/dashboard/notifications')}
            className="relative w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <Bell size={17} className="text-white" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-lime text-navy text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button
            onClick={() => router.push('/dashboard/profile')}
            className="w-9 h-9 rounded-xl bg-lime/20 flex items-center justify-center hover:bg-lime/30 transition-colors"
          >
            <User size={17} className="text-lime" />
          </button>
        </div>
      </header>

      {/* ── Desktop sidebar ───────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 bg-navy flex-col pt-20 pb-4 px-3 gap-1 z-30 overflow-y-auto">
        <div className="flex items-center gap-2.5 px-3 pb-6 pt-1">
          <div className="w-10 h-10 bg-lime rounded-2xl flex items-center justify-center shadow-lg shadow-lime/20">
            <span className="text-navy font-black text-sm">E+</span>
          </div>
          <div>
            <p className="font-black text-white text-base tracking-tight leading-tight">Epargn+</p>
            <p className="text-white/30 text-[10px]">Épargne intelligente</p>
          </div>
        </div>

        <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest px-3 mb-1">Principal</p>
        {NAV.map(({ href, label, icon: Icon }) => (
          <button key={href} onClick={() => router.push(href)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full text-left ${
              isActive(href, pathname)
                ? 'bg-lime text-navy shadow-md shadow-lime/20'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}>
            <Icon size={17} />
            {label}
          </button>
        ))}

        <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest px-3 mb-1 mt-4">Compte</p>
        {NAV_SIDE.map(({ href, label, icon: Icon }) => (
          <button key={href} onClick={() => router.push(href)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full text-left ${
              isActive(href, pathname)
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:bg-white/10 hover:text-white'
            }`}>
            <div className="relative">
              <Icon size={16} />
              {href === '/dashboard/notifications' && unread > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-lime text-navy text-[7px] font-black rounded-full flex items-center justify-center">
                  {unread > 9 ? '9' : unread}
                </span>
              )}
            </div>
            {label}
            {href === '/dashboard/notifications' && unread > 0 && (
              <span className="ml-auto bg-lime/20 text-lime text-[10px] font-bold px-2 py-0.5 rounded-full">{unread}</span>
            )}
          </button>
        ))}

        <div className="flex-1" />
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut size={16} />
          Déconnexion
        </button>
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex-1 pb-28 md:pb-8 px-4 pt-4 max-w-xl mx-auto w-full md:ml-60 md:max-w-2xl">
        {children}
      </main>

      {/* ── Bottom nav (mobile, 4 tabs) ────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 md:hidden z-40 shadow-2xl shadow-black/10">
        <div className="grid grid-cols-4 max-w-xl mx-auto relative">
          {NAV.map(({ href, label, icon: Icon }, idx) => {
            const active  = isActive(href, pathname)
            const isLaunch = label === 'Lancer'

            if (isLaunch) {
              return (
                <button
                  key={href}
                  onClick={() => router.push(href)}
                  className="flex flex-col items-center justify-end pb-2 pt-1 relative"
                >
                  {/* Raised circle */}
                  <div className={`absolute -top-5 w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-navy/25 transition-all ${
                    active ? 'bg-lime scale-105' : 'bg-navy'
                  }`}>
                    <Icon size={22} className={active ? 'text-navy' : 'text-lime'} />
                  </div>
                  <span className={`text-[9px] font-bold mt-8 leading-tight ${active ? 'text-navy' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </button>
              )
            }

            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`flex flex-col items-center justify-center gap-0.5 py-3 transition-colors ${
                  active ? 'text-navy' : 'text-gray-400'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[9px] font-semibold leading-tight">{label}</span>
                {active && <span className="w-1 h-1 rounded-full bg-lime" />}
              </button>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
