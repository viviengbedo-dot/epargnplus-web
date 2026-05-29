import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ORIGIN_API = 'https://epargnplus.vercel.app/api/transactions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type  = searchParams.get('type') || ''
  const limit = searchParams.get('limit') || '100'

  try {
    const qs = new URLSearchParams({ limit })
    if (type) qs.set('type', type)

    const res = await fetch(`${ORIGIN_API}/list?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      // Fallback : retourner tableau vide si l'endpoint n'existe pas encore
      return NextResponse.json({ success: true, data: [] })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ success: true, data: [] })
  }
}
