'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AdminSidebar from './Sidebar'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)

  const isLoginPage = pathname === '/administration'

  useEffect(() => {
    const hasSession = document.cookie.includes('adm_session=1')
    setAuthenticated(hasSession)
    setChecked(true)

    // Redirige vers login si pas authentifié sur une page protégée
    if (!hasSession && !isLoginPage) {
      router.replace('/administration')
    }
    // Redirige vers dashboard si déjà authentifié sur la page login
    if (hasSession && isLoginPage) {
      router.replace('/administration/dashboard')
    }
  }, [pathname, isLoginPage, router])

  // Pendant la vérification
  if (!checked) {
    return (
      <div className="min-h-screen bg-[#0B1668] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C9E000] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Page de login (pas authentifié)
  if (isLoginPage && !authenticated) {
    return <>{children}</>
  }

  // Pages protégées (authentifié)
  if (!isLoginPage && authenticated) {
    return (
      <div className="flex min-h-screen bg-[#F2F4FA]">
        <AdminSidebar />
        <main className="flex-1 overflow-auto pt-14 md:pt-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    )
  }

  // En attente de redirection
  return (
    <div className="min-h-screen bg-[#0B1668] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#C9E000] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
