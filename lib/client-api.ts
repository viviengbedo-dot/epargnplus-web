const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://epargnplus-api.onrender.com/v1'

function getClientToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/client_token=([^;]+)/)
  return match ? match[1] : null
}

export function setClientToken(token: string) {
  document.cookie = `client_token=${token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict`
}

export function clearClientToken() {
  document.cookie = 'client_token=; path=/; max-age=0'
}

async function clientFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getClientToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message || 'Erreur API')
  return json.data as T
}

export const clientApi = {
  sendOtp: (phone: string) =>
    clientFetch<void>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (phone: string, otp: string) =>
    clientFetch<{ token: string; userId: string; name: string; isNewUser: boolean }>(
      '/auth/verify-otp',
      { method: 'POST', body: JSON.stringify({ phone, otp }) }
    ),

  profile: () =>
    clientFetch<UserProfile>('/user/profile'),

  updateProfile: (name: string) =>
    clientFetch<void>('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  balance: () =>
    clientFetch<{ balance: number }>('/wallet/balance'),

  transactions: (type?: string) =>
    clientFetch<Transaction[]>(`/transactions${type ? `?type=${type}` : ''}`),

  deposit: (data: DepositData) =>
    clientFetch<DepositResult>('/transactions/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  withdraw: (data: WithdrawData) =>
    clientFetch<WithdrawResult>('/transactions/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProfileFull: (data: ProfileUpdateData) =>
    clientFetch<void>('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  kycDocs: () =>
    clientFetch<KycDoc[]>('/user/kyc'),

  submitKycDoc: (type: KycDocType, fileData: string) =>
    clientFetch<void>('/user/kyc', {
      method: 'POST',
      body: JSON.stringify({ type, fileData }),
    }),

  changePIN: (pinHash: string) =>
    clientFetch<void>('/user/change-pin', {
      method: 'PATCH',
      body: JSON.stringify({ pinHash }),
    }),

  aiAdvice: (projectId: string) =>
    clientFetch<AiAdvice>(`/user/ai-advice?projectId=${projectId}`),

  projects: () =>
    clientFetch<Project[]>('/projects'),

  createProject: (data: CreateProjectData) =>
    clientFetch<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  depositToProject: (projectId: string, amount: number) =>
    clientFetch<void>(`/projects/${projectId}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),
}

export interface UserProfile {
  id: string
  phone: string
  name: string
  balance: number
  kycStatus: 'none' | 'pending' | 'verified'
  kycTier: number
  referralCode: string
  memberSince: string
  birthDate: string | null
  city: string
  profession: string
  monthlyIncome: number | null
}

export interface ProfileUpdateData {
  name?: string
  birthDate?: string | null
  city?: string
  profession?: string
  monthlyIncome?: number | null
}

export type KycDocType = 'id_card' | 'selfie' | 'proof_address'

export interface KycDoc {
  id: string
  type: KycDocType
  verified: boolean
  uploadedAt: string
}

export interface AiAdviceScenario {
  months: number
  monthlyDeposit: number
  weeklyDeposit: number
  affordabilityPct: number | null
  feasibilityLabel: string | null
  feasibilityColor: string
}

export interface AiAdvice {
  completed: boolean
  hasDeadline?: boolean
  projectName: string
  remaining?: number
  goalAmount?: number
  currentAmount?: number
  // with deadline
  daysLeft?: number
  monthsLeft?: number
  monthlyDeposit?: number
  weeklyDeposit?: number
  dailyDeposit?: number
  deadline?: string
  affordabilityPct?: number | null
  feasibilityLabel?: string | null
  feasibilityColor?: string
  isOnTrack?: boolean
  // no deadline
  scenarios?: AiAdviceScenario[]
  needsIncome?: boolean
}

export interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'transfer' | 'bonus'
  amount: number
  operator: string
  phone: string
  projectId: string | null
  projectName: string | null
  status: 'pending' | 'success' | 'failed'
  reference: string
  label: string
  date: string
}

export interface Project {
  id: string
  name: string
  icon: string
  currentAmount: number
  goalAmount: number
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED'
  deadline: string | null
  createdAt: string
}

export interface DepositData {
  amount: number
  mobileOperator: string
  phone: string
  projectId?: string
}

export interface WithdrawData {
  amount: number
  mobileOperator: string
  phone: string
}

export interface DepositResult {
  reference: string
  status: string
  merchantNumber: string
  operatorLabel: string
  amount: number
  instructions: string
  message: string
}

export interface WithdrawResult {
  reference: string
  status: string
  amount: number
  fee: number
  total: number
  message: string
}

export interface CreateProjectData {
  name: string
  goalAmount: number
  icon?: string
  deadline?: string | null
}
