import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const VERCEL_API  = 'https://epargnplus.vercel.app/api/transactions'
const RENDER_API  = 'https://epargnplus-api.onrender.com/v1'
const JWT_SECRET  = process.env.JWT_SECRET || 'epargn-jwt-dev-secret-CHANGE-IN-PRODUCTION'
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export const dynamic = 'force-dynamic'

/** Décode le JWT client sans librairie externe */
function decodeJWT(token: string): { userId: string } | null {
  try {
    const parts = token.trim().split('.')
    if (parts.length !== 3) return null
    const [header, claims, sig] = parts
    const expected = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${claims}`).digest('base64url')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'))
    if (payload.exp < Date.now() / 1000) return null
    return payload
  } catch { return null }
}

/** Normalise un objet transaction depuis n'importe quelle source */
function normalize(t: Record<string, unknown>) {
  const rawType = (t.type as string || '').toLowerCase()
  const type = rawType === 'depot' || rawType === 'deposit' ? 'deposit'
    : rawType === 'retrait' || rawType === 'withdrawal' ? 'withdrawal'
    : rawType === 'bonus' ? 'bonus'
    : 'deposit'

  const rawStatut = ((t.statut || t.status) as string || '').toLowerCase()
  const status = rawStatut === 'completed' || rawStatut === 'success' ? 'success'
    : rawStatut === 'failed' || rawStatut === 'rejected' ? 'failed'
    : 'pending'

  return {
    id:          t.id as string,
    type,
    amount:      (t.amount || t.montant || 0) as number,
    operator:    (t.operator || '') as string,
    projectId:   (t.project_id || t.projectId || null) as string | null,
    projectName: (t.project_name || t.projectName || null) as string | null,
    status,
    reference:   (t.id || t.reference || '') as string,
    label:       (t.label || (type === 'deposit' ? 'Dépôt' : 'Retrait')) as string,
    date:        (t.created_at || t.date || new Date().toISOString()) as string,
    phone:       (t.phone || '') as string,
  }
}

export async function GET(req: NextRequest) {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = searchParams.get('limit') || '100'

  /* ── 1. Essayer le nouveau endpoint Vercel ── */
  try {
    const res = await fetch(`${VERCEL_API}/list?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return NextResponse.json({ success: true, data: json.data.map(normalize) })
      }
    }
  } catch {}

  /* ── 2. Fallback: Supabase direct si env vars disponibles ── */
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const payload = decodeJWT(token)
      if (payload?.userId) {
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/transactions?user_id=eq.${encodeURIComponent(payload.userId)}&select=id,type,amount,operator,project_id,statut,status,label,created_at&order=created_at.desc&limit=${limit}`,
          {
            headers: {
              apikey:          SUPABASE_KEY,
              Authorization:   `Bearer ${SUPABASE_KEY}`,
              'Content-Type':  'application/json',
            },
          }
        )
        if (sbRes.ok) {
          const rows = await sbRes.json()
          if (Array.isArray(rows)) {
            return NextResponse.json({ success: true, data: rows.map(normalize) })
          }
        }
      }
    } catch {}
  }

  /* ── 3. Fallback: Render API avec normalisation ── */
  try {
    const res = await fetch(`${RENDER_API}/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        return NextResponse.json({ success: true, data: json.data.map(normalize) })
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data: [] })
}
