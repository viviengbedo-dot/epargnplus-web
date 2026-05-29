'use client'
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertCircle, Target } from 'lucide-react'
import { adminApi, AdminProject } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  PAUSED: 'bg-gray-100 text-gray-500',
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actif',
  COMPLETED: 'Complété',
  PAUSED: 'Suspendu',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await adminApi.projects(page)
      setProjects(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch {
      setError('Impossible de charger les projets.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Projets</h1>
          <p className="text-gray-400 text-sm mt-0.5">{total} projet{total !== 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-2xl mb-4 flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Projet</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Objectif</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Épargne</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Progression</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Target size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Aucun projet trouvé</p>
                  </td>
                </tr>
              ) : projects.map((proj) => {
                const pct = proj.goalAmount > 0 ? Math.min(100, Math.round((proj.currentAmount / proj.goalAmount) * 100)) : 0
                return (
                  <tr key={proj.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-semibold text-[#0B1668]">{proj.name}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs font-mono">{proj.userPhone}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-600">{(proj.goalAmount ?? 0).toLocaleString('fr-FR')} GNF</td>
                    <td className="px-5 py-3.5 font-bold text-[#C9E000] text-shadow-none" style={{ color: '#0B1668' }}>{(proj.currentAmount ?? 0).toLocaleString('fr-FR')} GNF</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
                          <div className="bg-[#C9E000] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[proj.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[proj.status] ?? proj.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {new Date(proj.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">Page {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Précédent</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suivant →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
