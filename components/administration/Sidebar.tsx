'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, ArrowLeftRight, Target, ShieldCheck,
  Settings, BarChart2, MessageSquare, Menu, X, LogOut,
  Users2, RefreshCw, Globe, Eye,
} from 'lucide-react'
import { useState } from 'react'

const sections = [
  {
    label: 'VUE GÉNÉRALE',
    items: [
      { href: '/administration/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { href: '/administration/analytics', label: 'Analytiques', icon: BarChart2 },
    ],
  },
  {
    label: 'GESTION',
    items: [
      { href: '/administration/users', label: 'Utilisateurs', icon: Users },
      { href: '/administration/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { href: '/administration/projects', label: 'Projets', icon: Target },
      { href: '/administration/tontines', label: 'Tontines', icon: Users2 },
    ],
  },
  {
    label: 'VÉRIFICATION',
    items: [
      { href: '/administration/kyc', label: 'KYC en attente', icon: ShieldCheck },
      { href: '/administration/support', label: 'Support', icon: MessageSquare },
    ],
  },
  {
    label: 'SYSTÈME',
    items: [
      { href: '/administration/settings', label: 'Paramètres', icon: Settings },
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function logout() {
    await fetch('/api/administration/auth', { method: 'DELETE' })
    router.push('/administration')
  }

  async function refresh() {
    router.refresh()
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 bg-[#C9E000] rounded-xl flex items-center justify-center shrink-0">
          <span className="text-[#0B1668] font-black text-sm">E+</span>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Epargn+</p>
          <p className="text-white/40 text-xs">Administration</p>
        </div>
      </div>

      {/* Top action buttons */}
      <div className="px-4 pt-4 pb-2 flex gap-2 shrink-0">
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/15 hover:text-white text-xs font-medium transition-colors"
        >
          <RefreshCw size={12} /> Actualiser
        </button>
        <a
          href="https://epargnplus-web.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/15 hover:text-white text-xs font-medium transition-colors"
        >
          <Globe size={12} /> Site
        </a>
        <a
          href="https://epargnplus-web.vercel.app/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/15 hover:text-white text-xs font-medium transition-colors"
        >
          <Eye size={12} /> Client
        </a>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-3 text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1.5">
              {section.label}
            </p>
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5 ${
                    active
                      ? 'bg-[#C9E000] text-[#0B1668]'
                      : 'text-white/55 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-colors w-full"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-[#0B1668] h-screen sticky top-0 shrink-0 border-r border-white/10">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0B1668] border-b border-white/10 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#C9E000] rounded-lg flex items-center justify-center">
            <span className="text-[#0B1668] font-black text-xs">E+</span>
          </div>
          <span className="text-white font-bold text-sm">Administration</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white">
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/60" onClick={() => setMobileOpen(false)}>
          <aside
            className="absolute left-0 top-14 bottom-0 w-60 bg-[#0B1668] flex flex-col border-r border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <NavContent />
          </aside>
        </div>
      )}
    </>
  )
}
