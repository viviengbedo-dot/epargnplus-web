import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ORIGIN_API   = 'https://epargnplus.vercel.app/api/admin'
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = cookies().get('adm_session')?.value
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const res  = await fetch(`${ORIGIN_API}/data`, {
      headers: { Authorization: `Bearer ${ADMIN_SECRET}` },
      next: { revalidate: 0 },
    })
    const data = await res.json()

    // Normalise les champs : le backend retourne `amount` mais l'interface attend `montant`
    if (data.pendingTransactions) {
      data.pendingTransactions = data.pendingTransactions.map((t: Record<string, unknown>) => ({
        ...t,
        montant: (t.montant as number) ?? (t.amount as number) ?? 0,
      }))
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Backend inaccessible' }, { status: 502 })
  }
}
