'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ArrowLeftRight, Target, User, Bell, Users, HelpCircle, Gift, LogOut } from 'lucide-react'
import { clearClientToken, clientApi } from '@/lib/client-api'

const NAV_MAIN = [
  { href: '/dashboard',              label: 'Coffre',     icon: Home          },
  { href: '/dashboard/tontine',      label: 'Tontine',    icon: Users         },
  { href: '/dashboard/transactions', label: 'Mouvements', icon: ArrowLeftRight},
  { href: '/dashboard/projects',     label: 'Projets',    icon: Target        },
  { href: '/dashboard/profile',      label: 'Profil',     icon: User          },
]

const NAV_EXTRA = [
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell   },
  { href: '/dashboard/referral',      label: 'Parrainer',     icon: Gift   },
  { href: '/dashboard/support',       label: 'Aide',          icon: HelpCircle },
]

function isActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    clientApi.unreadCount().then((d) => setUnread(d.count)).catch(() => {})
  }, [pathname])

  function handleLogout() {
    clearClientToken()
    router.push('/dashboard/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F7]">

      {/* ── Top bar ───────────────────────────────────────── */}
      <header className="bg-navy text-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-lime rounded-lg flex items-center justify-center">
            <span className="text-navy font-black text-xs">E+</span>
          </div>
          <span className="font-black text-white tracking-tight">Epargn+</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => router.push('/dashboard/notifications')}
            className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-lime text-navy text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button onClick={handleLogout}
            className="text-white/40 hover:text-white text-xs transition-colors px-2 py-1 hidden sm:block">
            Quitter
          </button>
        </div>
      </header>

      {/* ── Desktop side nav ──────────────────────────────── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-navy flex-col pt-16 pb-4 px-3 gap-1 z-30 overflow-y-auto">
        <div className="flex items-center gap-2 px-3 pb-5 pt-2">
          <div className="w-9 h-9 bg-lime rounded-xl flex items-center justify-center">
            <span className="text-navy font-black text-sm">E+</span>
          </div>
          <span className="font-black text-white text-lg tracking-tight">Epargn+</span>
        </div>

        {NAV_MAIN.map(({ href, label, icon: Icon }) => (
          <button key={href} onClick={() => router.push(href)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${
              isActive(href, pathname) ? 'bg-lime text-navy' : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}>
            <Icon size={18} />
            {label}
          </button>
        ))}

        <div className="border-t border-white/10 mt-2 pt-2 space-y-1">
          {NAV_EXTRA.map(({ href, label, icon: Icon }) => (
            <button key={href} onClick={() => router.push(href)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${
                isActive(href, pathname) ? 'bg-lime text-navy' : 'text-white/40 hover:bg-white/10 hover:text-white'
              }`}>
              <div className="relative">
                <Icon size={16} />
                {href === '/dashboard/notifications' && unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-lime text-navy text-[7px] font-black rounded-full flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </div>
              {label}
              {href === '/dashboard/notifications' && unread > 0 && (
                <span className="ml-auto bg-lime/20 text-lime text-xs font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/30 hover:text-white hover:bg-white/10 transition-colors">
          <LogOut size={16} />
          Deconnexion
        </button>
      </aside>

      {/* ── Content ───────────────────────────────────────── */}
      <main className="flex-1 pb-24 md:pb-6 px-4 py-4 max-w-xl mx-auto w-full md:ml-56 md:max-w-3xl">
        {children}
      </main>

      {/* ── Bottom nav (mobile 5 items) ───────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 grid grid-cols-5 md:hidden z-40">
        {NAV_MAIN.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname)
          return (
            <button key={href} onClick={() => router.push(href)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                active ? 'text-navy' : 'text-gray-400'
              }`}>
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                {href === '/dashboard/notifications' && unread > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-lime text-navy text-[8px] font-black rounded-full flex items-center justify-center">
                    {unread > 9 ? '9' : unread}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-medium leading-tight">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-lime" />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
