'use client'
import { Users2, RefreshCw } from 'lucide-react'

export default function EpargneCollectivePage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Épargne Collective</h1>
          <p className="text-gray-400 text-sm mt-0.5">Gestion des groupes d&apos;épargne collective</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
        <Users2 size={48} className="text-gray-200 mx-auto mb-4" />
        <h3 className="text-[#0B1668] font-bold text-lg mb-2">Épargne Collective</h3>
        <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
          La gestion des groupes d&apos;épargne collective sera disponible prochainement. Les groupes et leurs membres seront listés ici.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium px-4 py-2 rounded-xl">
          🔄 En cours de développement
        </div>
      </div>
    </div>
  )
}
