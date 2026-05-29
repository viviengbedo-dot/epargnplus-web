import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ORIGIN_API = 'https://epargnplus.vercel.app/api/user/projects'

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 })

  try {
    const res = await fetch(ORIGIN_API, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) return NextResponse.json({ success: true, data: [] })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ success: true, data: [] })
  }
}

export async function POST(req: NextRequest) {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 })

  try {
    const body = await req.json()
    const res = await fetch(ORIGIN_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await res.json(), { status: res.ok ? 200 : res.status })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Erreur serveur' }, { status: 500 })
  }
}
