'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ArrowLeftRight, Target, User, LogOut } from 'lucide-react'
import { clearClientToken } from '@/lib/client-api'

const NAV = [
  { href: '/dashboard', label: 'Accueil', icon: Home },
  { href: '/dashboard/transactions', label: 'Historique', icon: ArrowLeftRight },
  { href: '/dashboard/projects', label: 'Projets', icon: Target },
  { href: '/dashboard/profile', label: 'Profil', icon: User },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  function handleLogout() {
    clearClientToken()
    router.push('/dashboard/login')
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F7]">
      {/* Top bar */}
      <header className="bg-navy text-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-lime rounded-lg flex items-center justify-center">
            <span className="text-navy font-black text-xs">E+</span>
          </div>
          <span className="font-black text-white tracking-tight">Epargn+</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors"
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 md:pb-6 px-4 py-4 max-w-xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex md:hidden z-40 safe-area-bottom">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                active ? 'text-navy' : 'text-gray-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <span className="w-1 h-1 rounded-full bg-lime mt-0.5" />}
            </button>
          )
        })}
      </nav>

      {/* Desktop side nav */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 bg-navy flex-col pt-16 pb-4 px-3 gap-1 z-30">
        <div className="flex items-center gap-2 px-3 pb-6 pt-2">
          <div className="w-9 h-9 bg-lime rounded-xl flex items-center justify-center">
            <span className="text-navy font-black text-sm">E+</span>
          </div>
          <span className="font-black text-white text-lg tracking-tight">Epargn+</span>
        </div>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-left ${
                active ? 'bg-lime text-navy' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          )
        })}
        <div className="flex-1" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </aside>
    </div>
  )
}
