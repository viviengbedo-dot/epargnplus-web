'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Target, Check, X, Brain,
  TrendingUp, TrendingDown, Clock, AlertCircle,
  Zap, Star, ChevronRight, Pause, Play,
} from 'lucide-react'
import { clientApi, Project, AiAdvice, AiAdviceScenario } from '@/lib/client-api'

/* ─── Config ──────────────────────────────────────────────── */
const ICONS = ['🎯','🏠','📱','✈️','🎓','💍','🚗','💊','🌱','💼','🏋️','🎸']

const FEASIBILITY_STYLES: Record<string, string> = {
  green:  'bg-green-50  text-green-700  border-green-200',
  lime:   'bg-lime/10   text-green-700  border-lime/30',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  red:    'bg-red-50    text-red-700    border-red-200',
  gray:   'bg-gray-50   text-gray-600   border-gray-200',
}

function fmtGNF(v: number) { return v.toLocaleString('fr-FR') }

/* ─── Page ────────────────────────────────────────────────── */
export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects]           = useState<Project[]>([])
  const [loading, setLoading]             = useState(true)
  const [showCreate, setShowCreate]       = useState(false)
  const [aiProject, setAiProject]         = useState<Project | null>(null)
  const [advice, setAdvice]               = useState<AiAdvice | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)

  // Create form
  const [name, setName]         = useState('')
  const [goal, setGoal]         = useState('')
  const [icon, setIcon]         = useState('🎯')
  const [deadline, setDeadline] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError]       = useState('')

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
      await clientApi.createProject({ name, goalAmount: parseInt(goal, 10), icon, deadline: deadline || null })
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
    try { setAdvice(await clientApi.aiAdvice(p.id)) }
    catch { setAdvice(null) }
    finally { setAdviceLoading(false) }
  }

  const active    = projects.filter((p) => p.status === 'ACTIVE')
  const paused    = projects.filter((p) => p.status === 'PAUSED')
  const completed = projects.filter((p) => p.status === 'COMPLETED')

  // Totals for summary
  const totalGoal  = active.reduce((s, p) => s + p.goalAmount, 0)
  const totalSaved = active.reduce((s, p) => s + p.currentAmount, 0)
  const globalPct  = totalGoal > 0 ? Math.round((totalSaved / totalGoal) * 100) : 0

  return (
    <>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-navy">Mes Projets</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            {active.length} actif{active.length !== 1 ? 's' : ''} · {completed.length} complété{completed.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-lime text-navy rounded-2xl px-4 py-2.5 text-sm font-black flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-lime/20"
        >
          <Plus size={15} /> Nouveau
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40 text-gray-300 text-sm animate-pulse">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-lime/20 rounded-xl flex items-center justify-center animate-bounce">
              <Target size={18} className="text-navy" />
            </div>
            Chargement…
          </div>
        </div>
      )}

      {/* ── Summary bar ────────────────────────────────────── */}
      {!loading && active.length > 0 && (
        <div className="bg-navy rounded-3xl p-4 mb-4 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-lime/10 rounded-full" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Épargne totale</p>
              <p className="text-white font-black text-2xl leading-tight">{fmtGNF(totalSaved)}</p>
              <p className="text-lime text-[11px] font-semibold">/ {fmtGNF(totalGoal)} GNF objectif</p>
            </div>
            <div className="flex items-center justify-center w-16 h-16">
              <svg viewBox="0 0 60 60" className="w-16 h-16 -rotate-90">
                <circle cx="30" cy="30" r="24" fill="none" stroke="#FFFFFF10" strokeWidth="6" />
                <circle
                  cx="30" cy="30" r="24" fill="none" stroke="#C9E000" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(globalPct / 100) * (2 * Math.PI * 24)} ${2 * Math.PI * 24}`}
                />
              </svg>
              <span className="absolute text-white font-black text-sm">{globalPct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Active projects ─────────────────────────────────── */}
      {active.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-lime rounded-md flex items-center justify-center">
              <Zap size={11} className="text-navy" />
            </div>
            <p className="text-navy font-bold text-sm">Actifs</p>
          </div>
          <div className="space-y-3">
            {active.map((p) => (
              <ProjectCard key={p.id} project={p} onAiClick={() => openAiAdvice(p)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Paused projects ─────────────────────────────────── */}
      {paused.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-yellow-100 rounded-md flex items-center justify-center">
              <Pause size={10} className="text-yellow-600" />
            </div>
            <p className="text-navy font-bold text-sm">En pause</p>
          </div>
          <div className="space-y-3">
            {paused.map((p) => (
              <ProjectCard key={p.id} project={p} onAiClick={() => openAiAdvice(p)} paused />
            ))}
          </div>
        </div>
      )}

      {/* ── Completed projects ──────────────────────────────── */}
      {completed.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-green-100 rounded-md flex items-center justify-center">
              <Check size={11} className="text-green-600" />
            </div>
            <p className="text-navy font-bold text-sm">Complétés</p>
          </div>
          <div className="space-y-2">
            {completed.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3 opacity-60">
                <span className="text-2xl">{p.icon || '🎯'}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-navy">{p.name}</p>
                  <p className="text-xs text-gray-400">{fmtGNF(p.goalAmount)} GNF atteint 🎉</p>
                </div>
                <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                  <Check size={15} className="text-green-600" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!loading && projects.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-lime/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Target size={28} className="text-navy" />
          </div>
          <p className="font-black text-navy text-lg mb-1">Aucun projet</p>
          <p className="text-gray-400 text-sm mb-6">Créez votre premier projet d&apos;épargne et commencez à construire votre avenir</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-lime text-navy font-black px-8 py-3 rounded-2xl text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-lime/20"
          >
            Créer un projet
          </button>
        </div>
      )}

      {/* ── Opportunités Elite ──────────────────────────────── */}
      {!loading && (
        <div className="mt-2 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-navy rounded-md flex items-center justify-center">
              <Star size={10} className="text-lime" fill="#C9E000" />
            </div>
            <p className="text-navy font-bold text-sm">Opportunités Élite</p>
          </div>

          <div className="space-y-3">
            {/* Épargne Long Terme */}
            <div
              onClick={() => router.push('/dashboard/tontine')}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-navy/5 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📈</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-black text-navy">Épargne Long Terme</p>
                    <span className="bg-lime/20 text-navy text-[10px] font-black px-2 py-0.5 rounded-full">+8%/an</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Bloquez votre épargne 6-36 mois pour un rendement premium</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </div>
            </div>

            {/* Tontine collective */}
            <div
              onClick={() => router.push('/dashboard/tontine')}
              className="bg-navy rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all relative overflow-hidden"
            >
              <div className="absolute -top-4 -right-4 w-16 h-16 bg-lime/15 rounded-full" />
              <div className="relative flex items-center gap-3">
                <div className="w-11 h-11 bg-lime/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">🤝</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-black text-white">Tontine Collective</p>
                    <span className="bg-lime text-navy text-[10px] font-black px-2 py-0.5 rounded-full">Actif</span>
                  </div>
                  <p className="text-[11px] text-white/50">Épargnez en groupe, renforcez vos liens</p>
                </div>
                <ChevronRight size={16} className="text-white/30 flex-shrink-0" />
              </div>
            </div>

            {/* Bonus fidélité */}
            <div className="bg-gradient-to-r from-lime/10 to-lime/5 rounded-2xl p-4 border border-lime/20">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-lime/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">⭐</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-navy mb-0.5">Bonus Fidélité</p>
                  <p className="text-[11px] text-gray-500">+5% offert aux membres actifs depuis 3 mois</p>
                </div>
                <div className="w-8 h-8 bg-lime rounded-xl flex items-center justify-center">
                  <Star size={14} className="text-navy" fill="#0B1668" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New project button ──────────────────────────────── */}
      {!loading && projects.length > 0 && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-navy/40 hover:text-navy hover:border-navy/30 text-sm font-semibold transition-all mb-2"
        >
          <Plus size={16} /> Nouveau projet d&apos;épargne
        </button>
      )}

      {/* ─────────────── MODALS ──────────────────────────────── */}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-navy px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-lime/20 rounded-xl flex items-center justify-center">
                  <Plus size={14} className="text-lime" />
                </div>
                <h3 className="font-black text-white text-base">Nouveau projet</h3>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl border border-red-100 flex items-center gap-2">
                  <AlertCircle size={13} />{error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-navy/60 uppercase tracking-wide mb-2">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setIcon(ic)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${
                        icon === ic ? 'border-navy bg-navy/5 scale-105' : 'border-gray-100 hover:border-gray-300'
                      }`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy/60 uppercase tracking-wide mb-2">Nom du projet</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50}
                  placeholder="Ex: Voyage à Dakar"
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors" />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy/60 uppercase tracking-wide mb-2">Objectif (GNF)</label>
                <input type="number" min="10000" step="1000" value={goal} onChange={(e) => setGoal(e.target.value)} required
                  placeholder="Ex: 5 000 000"
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors" />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy/60 uppercase tracking-wide mb-2">
                  Date limite <span className="text-gray-400 font-normal normal-case">(optionnel)</span>
                </label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors" />
                <p className="text-xs text-gray-400 mt-1.5 px-1">Le Coach IA calculera votre rythme de dépôt idéal.</p>
              </div>

              <button type="submit" disabled={creating}
                className="w-full bg-lime text-navy font-black py-3.5 rounded-2xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 shadow-lg shadow-lime/20">
                {creating ? 'Création…' : 'Créer le projet'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI Advice modal */}
      {aiProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-navy px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-lime/20 rounded-xl flex items-center justify-center">
                  <Brain size={14} className="text-lime" />
                </div>
                <p className="text-white font-black text-base">Coach IA</p>
              </div>
              <button onClick={() => setAiProject(null)} className="text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {adviceLoading && (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400 text-sm">
                  <div className="w-8 h-8 bg-lime/20 rounded-xl animate-bounce flex items-center justify-center">
                    <Brain size={16} className="text-navy" />
                  </div>
                  Analyse en cours…
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

/* ─── Project Card ────────────────────────────────────────── */
function ProjectCard({ project: p, onAiClick, paused: isPaused }: {
  project: Project
  onAiClick: () => void
  paused?: boolean
}) {
  const pct = Math.min(100, Math.round((p.currentAmount / p.goalAmount) * 100))

  let onTrackBadge: React.ReactNode = null
  if (p.deadline) {
    const today      = new Date()
    const dl         = new Date(p.deadline)
    const totalMs    = dl.getTime() - new Date(p.createdAt).getTime()
    const elapsedMs  = today.getTime() - new Date(p.createdAt).getTime()
    const elapsedPct = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0
    const savedPct   = p.goalAmount > 0 ? p.currentAmount / p.goalAmount : 0
    const onTrack    = savedPct >= elapsedPct - 0.05
    const daysLeft   = Math.max(0, Math.floor((dl.getTime() - today.getTime()) / 86400000))

    onTrackBadge = (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
        onTrack ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
      }`}>
        {onTrack ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
        {daysLeft > 0 ? `J-${daysLeft}` : 'Échu'}
      </span>
    )
  }

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
      isPaused ? 'border-yellow-100 opacity-75' : 'border-gray-100'
    }`}>
      {/* Card top */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-navy/5 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
            {p.icon || '🎯'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="font-black text-navy text-[15px] leading-tight">{p.name}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isPaused && (
                  <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Pause size={8} /> Pause
                  </span>
                )}
                {onTrackBadge}
                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                  pct >= 100 ? 'bg-green-100 text-green-700' : 'bg-lime/15 text-navy'
                }`}>{pct}%</span>
              </div>
            </div>

            <div className="flex items-baseline gap-1">
              <p className="text-sm font-black text-navy">{fmtGNF(p.currentAmount)}</p>
              <p className="text-xs text-gray-400">/ {fmtGNF(p.goalAmount)} GNF</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #C9E000, #a8c200)',
            }}
          />
        </div>

        {/* Restant + deadline */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-gray-400">
            Reste : <span className="font-bold text-navy">{fmtGNF(Math.max(0, p.goalAmount - p.currentAmount))} GNF</span>
          </p>
          {p.deadline && (
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock size={10} />
              {new Date(p.deadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Card footer */}
      <div className="border-t border-gray-50 px-4 py-2.5 flex items-center justify-between">
        <button
          onClick={onAiClick}
          className="flex items-center gap-1.5 text-xs text-navy font-bold bg-navy/5 hover:bg-navy/10 px-3 py-1.5 rounded-xl transition-colors"
        >
          <Brain size={12} className="text-lime" />
          Coach IA
        </button>
        <div className="flex items-center gap-1">
          {isPaused ? (
            <span className="text-xs text-yellow-600 flex items-center gap-1">
              <Play size={10} /> Reprendre
            </span>
          ) : (
            <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wide">Actif</span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── AI Advice Panel ─────────────────────────────────────── */
function AiAdvicePanel({ advice, project }: { advice: AiAdvice; project: Project }) {
  if (advice.completed) {
    return (
      <div className="text-center py-8">
        <span className="text-5xl">🎉</span>
        <p className="font-black text-navy text-lg mt-4">Objectif atteint !</p>
        <p className="text-gray-400 text-sm mt-1">{project.name}</p>
      </div>
    )
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR')

  return (
    <div className="space-y-4">
      {/* Project info */}
      <div className="bg-navy/5 rounded-2xl p-3">
        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Projet</p>
        <p className="font-black text-navy">{advice.projectName}</p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-lime rounded-full" style={{
              width: `${advice.goalAmount ? Math.min(100, Math.round(((advice.currentAmount ?? 0) / advice.goalAmount) * 100)) : 0}%`
            }} />
          </div>
          <span className="text-xs font-black text-navy">
            {advice.goalAmount ? Math.min(100, Math.round(((advice.currentAmount ?? 0) / advice.goalAmount) * 100)) : 0}%
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Reste : <span className="font-bold text-navy">{fmt(advice.remaining ?? 0)} GNF</span>
        </p>
      </div>

      {advice.needsIncome && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2.5 rounded-xl flex items-start gap-2">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          Complétez votre revenu mensuel dans Mon profil pour l&apos;indicateur de faisabilité.
        </div>
      )}

      {advice.hasDeadline && advice.deadline && (
        <>
          <div className="bg-navy/5 rounded-2xl p-3">
            <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
              <Clock size={11} /> Échéance : <span className="font-bold text-navy ml-0.5">{advice.deadline}</span>
              <span className="ml-auto font-bold text-navy">J-{advice.daysLeft}</span>
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Par jour',    val: advice.dailyDeposit },
                { label: 'Par semaine', val: advice.weeklyDeposit },
                { label: 'Par mois',    val: advice.monthlyDeposit },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white rounded-xl p-2.5 border border-gray-100">
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className="text-sm font-black text-navy">{fmt(val ?? 0)}</p>
                  <p className="text-[10px] text-gray-400">GNF</p>
                </div>
              ))}
            </div>
          </div>

          {advice.feasibilityLabel && advice.feasibilityColor && (
            <div className={`rounded-xl p-3 border text-sm font-bold flex items-center justify-between ${FEASIBILITY_STYLES[advice.feasibilityColor]}`}>
              <span>{advice.feasibilityLabel}</span>
              {advice.affordabilityPct != null && (
                <span className="text-xs opacity-70">{advice.affordabilityPct}% du revenu</span>
              )}
            </div>
          )}

          {advice.isOnTrack != null && (
            <div className={`rounded-xl p-3 flex items-center gap-2 text-sm font-bold ${
              advice.isOnTrack ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>
              {advice.isOnTrack ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {advice.isOnTrack ? 'Excellente progression !' : 'Accélérez pour rattraper votre retard.'}
            </div>
          )}
        </>
      )}

      {!advice.hasDeadline && advice.scenarios && (
        <>
          <p className="text-xs text-gray-400 font-medium">Choisissez votre horizon d&apos;épargne :</p>
          <div className="space-y-2">
            {advice.scenarios.map((s: AiAdviceScenario) => (
              <div key={s.months} className={`rounded-xl p-3 border ${FEASIBILITY_STYLES[s.feasibilityColor]}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-black">{s.months} mois</p>
                  {s.feasibilityLabel && <span className="text-xs font-medium opacity-80">{s.feasibilityLabel}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span><strong>{fmt(s.monthlyDeposit)}</strong> GNF/mois</span>
                  <span className="opacity-40">·</span>
                  <span><strong>{fmt(s.weeklyDeposit)}</strong> GNF/semaine</span>
                  {s.affordabilityPct != null && (
                    <span className="opacity-60 ml-auto">{s.affordabilityPct}% revenus</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Ajoutez une date limite à votre projet pour un suivi précis.</p>
        </>
      )}
    </div>
  )
}
