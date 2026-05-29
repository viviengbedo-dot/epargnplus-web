'use client'
import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle, Target } from 'lucide-react'
import { administrationApi, AdminDataProject, AdminDataUser } from '@/lib/administration-api'

type ProjectWithPhone = AdminDataProject & { phone?: string }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithPhone[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const data = await administrationApi.getData()
      const projs = data.allProjects.map(p => ({
        ...p,
        phone: data.users.find(u => u.id === p.user_id)?.phone,
      }))
      setProjects(projs)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#0B1668]">Projets</h1>
          <p className="text-gray-400 text-sm mt-0.5">{projects.length} projet{projects.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
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
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Épargné</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Progression</th>
                <th className="text-left px-5 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wide">Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><div className="h-4 bg-gray-100 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Target size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Aucun projet</p>
                  </td>
                </tr>
              ) : projects.map(p => {
                const pct = p.goal > 0 ? Math.min(100, Math.round((p.actuel / p.goal) * 100)) : 0
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-semibold text-[#0B1668]">{p.name}</td>
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-500">{p.phone || p.user_id.slice(0, 8)}</td>
                    <td className="px-5 py-3.5 text-gray-600 font-medium">{(p.goal || 0).toLocaleString('fr-FR')} GNF</td>
                    <td className="px-5 py-3.5 font-bold text-[#0B1668]">{(p.actuel || 0).toLocaleString('fr-FR')} GNF</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
                          <div className="bg-[#C9E000] h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        p.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                        : p.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.status === 'ACTIVE' ? 'Actif' : p.status === 'COMPLETED' ? 'Complété' : 'Suspendu'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
