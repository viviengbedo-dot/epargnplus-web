import { NextRequest, NextResponse } from 'next/server'

const ADMIN_KEY      = process.env.ADMIN_KEY      || 'EPARGN2026'
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@epargnplus.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin2026!'
const API_URL        = process.env.NEXT_PUBLIC_API_URL || 'https://epargnplus-api.onrender.com/v1'

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()

    if (!key || key !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Clé invalide — accès refusé.' }, { status: 401 })
    }

    // Get backend admin token
    let token = ''
    try {
      const loginRes = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      })
      const loginData = await loginRes.json()
      if (loginData.success && loginData.data?.token) {
        token = loginData.data.token
      }
    } catch {
      // Backend unreachable — continue with session cookie only
    }

    const response = NextResponse.json({ success: true })

    if (token) {
      response.cookies.set('admin_token', token, {
        httpOnly: false,
        maxAge: 60 * 60 * 8,
        path: '/',
        sameSite: 'strict',
      })
    }

    response.cookies.set('adm_session', '1', {
      maxAge: 60 * 60 * 8,
      path: '/',
      sameSite: 'strict',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('adm_session', '', { maxAge: 0, path: '/' })
  response.cookies.set('admin_token', '', { maxAge: 0, path: '/' })
  return response
}
