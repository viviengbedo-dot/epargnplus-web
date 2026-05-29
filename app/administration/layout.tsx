import AdminSidebar from '@/components/administration/Sidebar'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Epargn+ — Administration',
  robots: 'noindex,nofollow',
}

export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="adm-layout" className="adm-layout">
      {children}
    </div>
  )
}
