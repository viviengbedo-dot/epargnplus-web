'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Target, Check, X, Brain, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react'
import { clientApi, Project, AiAdvice, AiAdviceScenario } from '@/lib/client-api'

const ICONS = ['🎯', '🏠', '📱', '✈️', '🎓', '💍', '🚗', '💊', '🌱', '💼']

const FEASIBILITY_STYLES: Record<string, string> = {
  green:  'bg-green-50  text-green-700  border-green-200',
  lime:   'bg-lime/10   text-green-700  border-lime/30',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red:    'bg-red-50    text-red-700    border-red-200',
  gray:   'bg-gray-50   text-gray-600   border-gray-200',
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects]       = useState<Project[]>([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [aiProject, setAiProject]     = useState<Project | null>(null)
  const [advice, setAdvice]           = useState<AiAdvice | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)

  // Create form
  const [name, setName]     = useState('')
  const [goal, setGoal]     = useState('')
  const [icon, setIcon]     = useState('🎯')
  const [deadline, setDeadline] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError]   = useState('')

  const load = useCallback(async () => {
    try {
      setProjects(await clientApi.projects())
    } catch {
      router.push('/dashboard/login')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await clientApi.createProject({
        name,
        goalAmount: parseInt(goal, 10),
        icon,
        deadline: deadline || null,
      })
      setShowCreate(false)
      setName(''); setGoal(''); setIcon('🎯'); setDeadline('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function openAiAdvice(p: Project) {
    setAiProject(p)
    setAdvice(null)
    setAdviceLoading(true)
    try {
      setAdvice(await clientApi.aiAdvice(p.id))
    } catch {
      setAdvice(null)
    } finally {
      setAdviceLoading(false)
    }
  }

  const active = projects.filter((p) => p.status === 'ACTIVE')
  const done   = projects.filter((p) => p.status === 'COMPLETED')

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-navy">Projets</h1>
          <p className="text-gray-400 text-xs mt-0.5">{active.length} actif{active.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-lime text-navy rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
          <Plus size={15} /> Nouveau
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm animate-pulse">Chargement...</div>
      )}

      {/* Active projects */}
      {active.length > 0 && (
        <div className="space-y-3 mb-6">
          {active.map((p) => <ProjectCard key={p.id} project={p} onAiClick={() => openAiAdvice(p)} />)}
        </div>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Completes</p>
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
          <p className="text-gray-400 text-sm mb-4">Creez votre premier projet d&apos;epargne</p>
          <button onClick={() => setShowCreate(true)}
            className="bg-lime text-navy font-bold px-5 py-2.5 rounded-xl text-sm hover:opacity-90">
            Creer un projet
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-navy text-lg">Nouveau projet</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-xl border border-red-100 flex items-center gap-2">
                  <AlertCircle size={13} />{error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Icone</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setIcon(ic)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border-2 transition-colors ${
                        icon === ic ? 'border-navy bg-navy/5' : 'border-gray-100 hover:border-gray-300'
                      }`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Nom du projet</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50}
                  placeholder="Ex: Voyage a Dakar"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Objectif (GNF)</label>
                <input type="number" min="10000" step="1000" value={goal} onChange={(e) => setGoal(e.target.value)} required
                  placeholder="Ex: 5 000 000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">
                  Date limite <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy" />
                <p className="text-xs text-gray-400 mt-1">Permet au coach IA de calculer votre rythme de depot ideal.</p>
              </div>

              <button type="submit" disabled={creating}
                className="w-full bg-lime text-navy font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-40">
                {creating ? 'Creation...' : 'Creer le projet'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI Advice modal */}
      {aiProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-navy px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={18} className="text-lime" />
                <p className="text-white font-bold text-sm">Coach IA</p>
              </div>
              <button onClick={() => setAiProject(null)} className="text-white/40 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-5">
              {adviceLoading && (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm animate-pulse">
                  Analyse en cours...
                </div>
              )}

              {!adviceLoading && advice && <AiAdvicePanel advice={advice} project={aiProject} />}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project: p, onAiClick }: { project: Project; onAiClick: () => void }) {
  const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))

  // Compute on-track badge if deadline set
  let onTrackBadge: React.ReactNode = null
  if (p.deadline) {
    const today = new Date()
    const dl    = new Date(p.deadline)
    const totalMs = dl.getTime() - new Date(p.createdAt).getTime()
    const elapsedMs = today.getTime() - new Date(p.createdAt).getTime()
    const elapsedPct = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0
    const savedPct   = p.goalAmount > 0 ? p.currentAmount / p.goalAmount : 0
    const onTrack    = savedPct >= elapsedPct - 0.05

    const daysLeft = Math.max(0, Math.floor((dl.getTime() - today.getTime()) / 86400000))
    onTrackBadge = (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
        onTrack ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
      }`}>
        {onTrack ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {daysLeft > 0 ? `J-${daysLeft}` : 'Echu'}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{p.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-bold text-navy">{p.name}</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {onTrackBadge}
              <span className="text-xs font-bold text-lime bg-navy/10 px-2 py-0.5 rounded-full">{pct}%</span>
            </div>
          </div>

          <div className="h-2 bg-gray-100 rounded-full mt-2 mb-1 overflow-hidden">
            <div className="h-full bg-lime rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>

          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>{p.currentAmount.toLocaleString('fr-FR')} GNF</span>
            <span>{p.goalAmount.toLocaleString('fr-FR')} GNF</span>
          </div>

          {p.deadline && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
              <Clock size={11} />
              <span>Echeance: {new Date(p.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          )}

          <button onClick={onAiClick}
            className="flex items-center gap-1.5 text-xs text-navy font-medium bg-navy/5 hover:bg-navy/10 px-2.5 py-1.5 rounded-lg transition-colors">
            <Brain size={12} className="text-lime" />
            Coach IA
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Advice Panel ──────────────────────────────────────────────────────────

function AiAdvicePanel({ advice, project }: { advice: AiAdvice; project: Project }) {
  if (advice.completed) {
    return (
      <div className="text-center py-6">
        <span className="text-4xl">🎉</span>
        <p className="font-bold text-navy mt-3">Objectif atteint !</p>
        <p className="text-gray-400 text-sm mt-1">{project.name}</p>
      </div>
    )
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR')

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-400">Projet</p>
        <p className="font-bold text-navy">{advice.projectName}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-lime rounded-full" style={{ width: `${advice.goalAmount ? Math.min(100, Math.round(((advice.currentAmount ?? 0) / advice.goalAmount) * 100)) : 0}%` }} />
          </div>
          <span className="text-xs font-bold text-navy">
            {advice.goalAmount ? Math.min(100, Math.round(((advice.currentAmount ?? 0) / advice.goalAmount) * 100)) : 0}%
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Reste: <span className="font-semibold text-navy">{fmt(advice.remaining ?? 0)} GNF</span>
        </p>
      </div>

      {advice.needsIncome && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded-xl flex items-start gap-2">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          Completez votre revenu mensuel dans Mon profil pour voir l&apos;indicateur de faisabilite.
        </div>
      )}

      {advice.hasDeadline && advice.deadline && (
        <>
          <div className="bg-navy/5 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
              <Clock size={11} /> Echeance: <span className="font-medium text-navy">{advice.deadline}</span>
              {' · '}J-{advice.daysLeft}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Par jour', val: advice.dailyDeposit },
                { label: 'Par semaine', val: advice.weeklyDeposit },
                { label: 'Par mois', val: advice.monthlyDeposit },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white rounded-xl p-2 border border-gray-100">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-black text-navy">{fmt(val ?? 0)}</p>
                  <p className="text-xs text-gray-400">GNF</p>
                </div>
              ))}
            </div>
          </div>

          {advice.feasibilityLabel && advice.feasibilityColor && (
            <div className={`rounded-xl p-3 border text-sm font-medium flex items-center justify-between ${FEASIBILITY_STYLES[advice.feasibilityColor]}`}>
              <span>{advice.feasibilityLabel}</span>
              {advice.affordabilityPct != null && (
                <span className="text-xs opacity-70">{advice.affordabilityPct}% du revenu</span>
              )}
            </div>
          )}

          {advice.isOnTrack != null && (
            <div className={`rounded-xl p-3 flex items-center gap-2 text-sm font-medium ${
              advice.isOnTrack ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>
              {advice.isOnTrack ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {advice.isOnTrack ? 'En bonne progression !' : 'Prenez de l\'avance pour rattraper le retard.'}
            </div>
          )}
        </>
      )}

      {!advice.hasDeadline && advice.scenarios && (
        <>
          <p className="text-xs text-gray-400">Choisissez votre horizon d&apos;epargne :</p>
          <div className="space-y-2">
            {advice.scenarios.map((s: AiAdviceScenario) => (
              <div key={s.months} className={`rounded-xl p-3 border ${FEASIBILITY_STYLES[s.feasibilityColor]}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold">{s.months} mois</p>
                  {s.feasibilityLabel && (
                    <span className="text-xs font-medium opacity-80">{s.feasibilityLabel}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span><strong>{fmt(s.monthlyDeposit)}</strong> GNF/mois</span>
                  <span className="text-current/50">·</span>
                  <span><strong>{fmt(s.weeklyDeposit)}</strong> GNF/semaine</span>
                  {s.affordabilityPct != null && (
                    <span className="opacity-60 ml-auto">{s.affordabilityPct}% revenus</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Ajoutez une date limite a votre projet pour un suivi precis.
          </p>
        </>
      )}
    </div>
  )
}
