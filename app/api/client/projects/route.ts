import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const VERCEL_API   = 'https://epargnplus.vercel.app/api/user/projects'
const RENDER_API   = 'https://epargnplus-api.onrender.com/v1'
const JWT_SECRET   = process.env.JWT_SECRET   || 'epargn-jwt-dev-secret-CHANGE-IN-PRODUCTION'
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export const dynamic = 'force-dynamic'

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

function normalizeProject(p: Record<string, unknown>) {
  return {
    id:            p.id as string,
    name:          (p.name || 'Projet') as string,
    icon:          (p.icon || p.color || '🎯') as string,
    currentAmount: ((p.currentAmount || p.actuel || p.current_amount || 0)) as number,
    goalAmount:    ((p.goalAmount   || p.goal   || p.goal_amount   || 0)) as number,
    status:        (p.status || 'ACTIVE') as string,
    deadline:      (p.deadline || null) as string | null,
    createdAt:     (p.createdAt || p.created_at || '') as string,
  }
}

export async function GET() {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 })

  /* ── 1. Nouveau endpoint Vercel ── */
  try {
    const res = await fetch(VERCEL_API, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        return NextResponse.json({ success: true, data: json.data.map(normalizeProject) })
      }
    }
  } catch {}

  /* ── 2. Supabase direct si env vars disponibles ── */
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const payload = decodeJWT(token)
      if (payload?.userId) {
        const sbRes = await fetch(
          `${SUPABASE_URL}/rest/v1/projects?user_id=eq.${encodeURIComponent(payload.userId)}&select=id,name,goal,actuel,status,color,created_at&order=created_at.desc`,
          {
            headers: {
              apikey:         SUPABASE_KEY,
              Authorization:  `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        )
        if (sbRes.ok) {
          const rows = await sbRes.json()
          if (Array.isArray(rows)) {
            return NextResponse.json({ success: true, data: rows.map(normalizeProject) })
          }
        }
      }
    } catch {}
  }

  /* ── 3. Render API fallback ── */
  try {
    const res = await fetch(`${RENDER_API}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        return NextResponse.json({ success: true, data: json.data.map(normalizeProject) })
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data: [] })
}

export async function POST(req: NextRequest) {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 })

  const body = await req.json()

  /* ── 1. Nouveau endpoint Vercel ── */
  try {
    const res = await fetch(VERCEL_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success) return NextResponse.json(json)
    }
  } catch {}

  /* ── 2. Supabase direct ── */
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const payload = decodeJWT(token)
      if (payload?.userId) {
        const goal = parseInt(body.goal || body.goal_amount || body.goalAmount, 10) || 0
        const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
          method: 'POST',
          headers: {
            apikey:         SUPABASE_KEY,
            Authorization:  `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer':       'return=representation',
          },
          body: JSON.stringify({
            user_id:    payload.userId,
            name:       body.name,
            goal,
            actuel:     0,
            status:     'ACTIVE',
            color:      body.icon || '🎯',
            created_at: new Date().toISOString(),
          }),
        })
        if (sbRes.ok) {
          const rows = await sbRes.json()
          const p = Array.isArray(rows) ? rows[0] : rows
          return NextResponse.json({ success: true, data: normalizeProject(p) })
        }
      }
    } catch {}
  }

  /* ── 3. Render API fallback ── */
  try {
    const res = await fetch(`${RENDER_API}/projects`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    return NextResponse.json(json, { status: res.ok ? 200 : res.status })
  } catch {
    return NextResponse.json({ success: false, message: 'Erreur création projet' }, { status: 500 })
  }
}
