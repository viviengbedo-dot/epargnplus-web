'use client'
import { useEffect, useState, useCallback } from 'react'
import { adminApi, AdminProject } from '@/lib/api'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Actif',    cls: 'bg-green-50 text-green-600' },
  COMPLETED: { label: 'Atteint', cls: 'bg-blue-50 text-blue-600' },
  PAUSED:    { label: 'Pausé',   cls: 'bg-yellow-50 text-yellow-600' },
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.projects(page)
      setProjects(res.items)
      setTotal(res.total)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-navy">Projets d&apos;épargne</h1>
        <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString()} projets au total</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Projet</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Utilisateur</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Objectif</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Progression</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Statut</th>
                <th className="text-left px-5 py-3 text-gray-400 font-medium text-xs">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${55 + j * 8}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">Aucun projet</td>
                </tr>
              ) : projects.map((p) => {
                const pct = p.goalAmount > 0 ? Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100)) : 0
                const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.ACTIVE
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-navy">{p.name}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{p.userPhone}</td>
                    <td className="px-5 py-3 font-bold text-navy text-xs">{p.goalAmount.toLocaleString()} GNF</td>
                    <td className="px-5 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-lime rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{p.currentAmount.toLocaleString()} / {p.goalAmount.toLocaleString()} GNF</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{p.createdAt}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {total > 20 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Page {page} sur {Math.ceil(total / 20)}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Précédent
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
