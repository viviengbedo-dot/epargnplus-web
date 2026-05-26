'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, ArrowLeftRight, Target, LogOut, Menu, X, Bell, ShieldCheck
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/admin/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/users',          label: 'Utilisateurs',   icon: Users },
  { href: '/admin/transactions',   label: 'Transactions',   icon: ArrowLeftRight },
  { href: '/admin/projects',       label: 'Projets',        icon: Target },
  { href: '/admin/notifications',  label: 'Notifications',  icon: Bell },
  { href: '/admin/kyc',            label: 'KYC',            icon: ShieldCheck },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  function logout() {
    document.cookie = 'admin_token=; Max-Age=0; path=/'
    router.push('/admin/login')
  }

  const NavContent = () => (
    <>
      <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-lime rounded-lg flex items-center justify-center">
          <span className="text-navy font-black text-sm">E+</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm">Epargn+</p>
          <p className="text-white/40 text-xs">Administration</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-lime text-navy'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-colors w-full"
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-navy h-screen sticky top-0 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-navy border-b border-white/10 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-lime rounded-lg flex items-center justify-center">
            <span className="text-navy font-black text-xs">E+</span>
          </div>
          <span className="text-white font-bold text-sm">Admin</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)}>
          <aside
            className="absolute left-0 top-14 bottom-0 w-56 bg-navy flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <NavContent />
          </aside>
        </div>
      )}
    </>
  )
}
