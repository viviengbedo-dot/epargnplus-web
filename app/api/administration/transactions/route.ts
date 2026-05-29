import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ORIGIN_API   = 'https://epargnplus.vercel.app/api/admin'
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = cookies().get('adm_session')?.value
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut') || ''
  const limit  = searchParams.get('limit')  || '500'

  try {
    const qs = new URLSearchParams({ limit })
    if (statut) qs.set('statut', statut)

    const res  = await fetch(`${ORIGIN_API}/transactions?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      // Fallback: si le nouvel endpoint n'existe pas encore, retourner tableau vide
      return NextResponse.json({ transactions: [], total: 0 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ transactions: [], total: 0 })
  }
}
