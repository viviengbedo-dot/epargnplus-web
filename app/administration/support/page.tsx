'use client'
import { MessageSquare } from 'lucide-react'

export default function SupportPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0B1668]">Support</h1>
        <p className="text-gray-400 text-sm mt-0.5">Tickets et demandes d&apos;assistance utilisateur</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
        <MessageSquare size={48} className="text-gray-200 mx-auto mb-4" />
        <h3 className="text-[#0B1668] font-bold text-lg mb-2">Centre de support</h3>
        <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
          Les tickets de support utilisateur, réclamations et demandes d&apos;aide seront gérés depuis cette section.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium px-4 py-2 rounded-xl">
          🔄 En cours de développement
        </div>
      </div>
    </div>
  )
}
