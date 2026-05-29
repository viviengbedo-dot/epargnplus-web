'use client'
import { BarChart2 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-[#0B1668]">Analytiques</h1>
        <p className="text-gray-400 text-sm mt-0.5">Métriques et graphiques de la plateforme</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
        <BarChart2 size={48} className="text-gray-200 mx-auto mb-4" />
        <h3 className="text-[#0B1668] font-bold text-lg mb-2">Tableau analytique</h3>
        <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
          Les graphiques d&apos;évolution, volumes journaliers et métriques de rétention seront disponibles ici.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-medium px-4 py-2 rounded-xl">
          🔄 En cours de développement
        </div>
      </div>
    </div>
  )
}
