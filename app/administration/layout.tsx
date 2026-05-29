import AdminSidebar from '@/components/administration/Sidebar'
import AdminGuard from '@/components/administration/AdminGuard'

export const metadata = {
  title: 'Epargn+ — Administration',
  robots: 'noindex,nofollow',
}

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      {children}
    </AdminGuard>
  )
}
