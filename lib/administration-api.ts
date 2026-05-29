// Types basés sur le schéma Supabase réel (colonnes montant, statut, epargne, goal, actuel)

export interface AdminDataUser {
  id: string
  phone: string
  prenom?: string
  nom?: string
  country?: string
  operator?: string
  epargne: number
  pending_deposit?: string | null
  kyc_status: 'none' | 'pending' | 'verified' | 'rejected'
  role?: string
  created_at: string
}

export interface AdminDataTransaction {
  id: string
  user_id: string
  type: string         // 'depot' | 'retrait' | ...
  montant: number
  operator?: string
  statut: 'pending' | 'completed' | 'failed'
  project_id?: string | null
  note?: string | null
  created_at: string
  // Relations jointes (si disponibles)
  phone?: string
}

export interface AdminDataProject {
  id: string
  user_id: string
  name: string
  goal: number
  actuel: number
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED'
  color?: string
  duree?: number
  created_at: string
}

export interface AdminStats {
  total: number
  epargneTotal: number
  kycPending: number
  kycVerified: number
  pendingCount: number
  byCountry: { gn: number; bj: number; ci: number; other: number }
}

export interface AdminData {
  users: AdminDataUser[]
  pendingTransactions: AdminDataTransaction[]
  allProjects: AdminDataProject[]
  stats: AdminStats
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res  = await fetch(url, options)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur API')
  return data as T
}

export const administrationApi = {
  /** Charge toutes les données admin depuis le vrai backend */
  getData: () => apiFetch<AdminData>('/api/administration/data'),

  /** Approuve un dépôt */
  approveDeposit: (userId: string, txnId: string, amount?: number) =>
    apiFetch<{ ok: boolean; epargne?: number }>('/api/administration/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, txnId, action: 'approve', amount }),
    }),

  /** Rejette un dépôt */
  rejectDeposit: (userId: string, txnId: string) =>
    apiFetch<{ ok: boolean }>('/api/administration/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, txnId, action: 'reject' }),
    }),

  /** Correction manuelle du solde */
  setBalance: (userId: string, amount: number) =>
    apiFetch<{ ok: boolean; epargne?: number }>('/api/administration/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'set', amount }),
    }),

  /** Approuve le KYC */
  approveKyc: (userId: string) =>
    apiFetch<{ ok: boolean }>('/api/administration/kyc-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status: 'verified' }),
    }),

  /** Rejette le KYC */
  rejectKyc: (userId: string, reason?: string) =>
    apiFetch<{ ok: boolean }>('/api/administration/kyc-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status: 'rejected', rejectionReason: reason }),
    }),
}
