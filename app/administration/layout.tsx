import { cookies } from 'next/headers'
import AdminSidebar from '@/components/administration/Sidebar'

export const metadata = {
  title: 'Epargn+ — Administration',
  robots: 'noindex,nofollow',
}

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  const session = cookies().get('adm_session')?.value

  if (!session) {
    return <>{children}</>
  }

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
