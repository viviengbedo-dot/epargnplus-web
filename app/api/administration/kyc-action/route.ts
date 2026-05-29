import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ORIGIN_API   = 'https://epargnplus.vercel.app/api/admin'
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'epargn-admin-dev-2026'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = cookies().get('adm_session')?.value
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const body = await req.json()
    const res  = await fetch(`${ORIGIN_API}/update-kyc`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (err) {
    return NextResponse.json({ error: 'Backend inaccessible' }, { status: 502 })
  }
}
