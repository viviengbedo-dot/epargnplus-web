import Sidebar from '@/components/admin/Sidebar'

export const metadata = {
  title: 'Epargn+ Admin',
  robots: 'noindex,nofollow',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F5F5F7]">
      <Sidebar />
      <main className="flex-1 md:overflow-auto pt-14 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
