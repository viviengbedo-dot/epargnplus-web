'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Target, Check, X, ChevronRight } from 'lucide-react'
import { clientApi, Project } from '@/lib/client-api'

const ICONS = ['🎯', '🏠', '📱', '✈️', '🎓', '💍', '🚗', '💊', '🌱', '💼']

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [icon, setIcon] = useState('🎯')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await clientApi.projects()
      setProjects(data)
    } catch {
      router.push('/dashboard/login')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await clientApi.createProject({ name, goalAmount: parseInt(goal, 10), icon })
      setShowCreate(false)
      setName(''); setGoal(''); setIcon('🎯')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const active = projects.filter((p) => p.status === 'ACTIVE')
  const done = projects.filter((p) => p.status === 'COMPLETED')

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-navy">Projets d&apos;épargne</h1>
          <p className="text-gray-400 text-xs mt-0.5">{active.length} projet{active.length !== 1 ? 's' : ''} actif{active.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-lime text-navy rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> Nouveau
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm animate-pulse">
          Chargement...
        </div>
      )}

      {/* Active projects */}
      {active.length > 0 && (
        <div className="space-y-3 mb-6">
          {active.map((p) => {
            const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))
            return (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-navy">{p.name}</p>
                      <span className="text-xs font-bold text-lime bg-navy/10 px-2 py-0.5 rounded-full">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full mt-2 mb-1 overflow-hidden">
                      <div
                        className="h-full bg-lime rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{p.currentAmount.toLocaleString('fr-FR')} GNF</span>
                      <span>Objectif : {p.goalAmount.toLocaleString('fr-FR')} GNF</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">Créé le {p.createdAt}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            Complétés
          </p>
          <div className="space-y-2">
            {done.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3 opacity-70">
                <span className="text-xl">{p.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.goalAmount.toLocaleString('fr-FR')} GNF atteint</p>
                </div>
                <Check size={16} className="text-green-500" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <Target size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="font-bold text-navy mb-1">Aucun projet</p>
          <p className="text-gray-400 text-sm mb-4">Créez votre premier projet d&apos;épargne</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-lime text-navy font-bold px-5 py-2.5 rounded-xl text-sm hover:opacity-90"
          >
            Créer un projet
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-navy text-lg">Nouveau projet</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border-2 transition-colors ${
                        icon === ic ? 'border-navy bg-navy/5' : 'border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Nom du projet</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={50}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  placeholder="Ex : Voyage à Dakar"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Objectif (GNF)</label>
                <input
                  type="number"
                  min="10000"
                  step="1000"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  placeholder="Ex : 5 000 000"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-lime text-navy font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-40"
              >
                {creating ? 'Création...' : 'Créer le projet'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
