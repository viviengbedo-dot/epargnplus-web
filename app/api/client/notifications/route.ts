import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ORIGIN_API = 'https://epargnplus.vercel.app/api/notifications'

export const dynamic = 'force-dynamic'

export async function GET() {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: true, data: [] })

  try {
    const res = await fetch(ORIGIN_API, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })

    if (!res.ok) return NextResponse.json({ success: true, data: [] })

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ success: true, data: [] })
  }
}
