const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://epargnplus-api.onrender.com/v1'

function getAdminToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : null
}

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAdminToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message || 'Erreur API')
  return json.data as T
}

export const adminApi = {
  login: (email: string, password: string) =>
    adminFetch<{ token: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  stats: () => adminFetch<AdminStats>('/admin/stats'),

  users: (page = 1, search = '') =>
    adminFetch<PaginatedResponse<AdminUser>>(`/admin/users?page=${page}&search=${encodeURIComponent(search)}`),

  updateUser: (id: string, data: Partial<AdminUser>) =>
    adminFetch<AdminUser>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  transactions: (page = 1, type = '', status = '') =>
    adminFetch<PaginatedResponse<AdminTransaction>>(
      `/admin/transactions?page=${page}&type=${type}&status=${status}`
    ),

  projects: (page = 1) =>
    adminFetch<PaginatedResponse<AdminProject>>(`/admin/projects?page=${page}`),

  confirmTransaction: (id: string) =>
    adminFetch<{ id: string; status: string }>(`/admin/transactions/${id}/confirm`, {
      method: 'PATCH',
    }),

  rejectTransaction: (id: string) =>
    adminFetch<{ id: string; status: string }>(`/admin/transactions/${id}/reject`, {
      method: 'PATCH',
    }),
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  totalBalance: number
  totalTransactions: number
  transactionsVolume: number
  activeProjects: number
  newUsersThisMonth: number
  volumeThisMonth: number
}

export interface AdminUser {
  id: string
  phone: string
  name: string
  balance: number
  kycStatus: 'none' | 'pending' | 'verified'
  kycTier: number
  referralCode: string
  isBlocked: boolean
  createdAt: string
}

export interface AdminTransaction {
  id: string
  userId: string
  userPhone: string
  type: 'deposit' | 'withdrawal' | 'transfer' | 'bonus'
  amount: number
  operator: string
  status: 'pending' | 'success' | 'failed'
  reference: string
  createdAt: string
}

export interface AdminProject {
  id: string
  userId: string
  userPhone: string
  name: string
  goalAmount: number
  currentAmount: number
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED'
  createdAt: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}
