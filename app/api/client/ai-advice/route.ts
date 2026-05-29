import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const ORIGIN_API = 'https://epargnplus.vercel.app/api/user/ai-advice'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = cookies().get('client_token')?.value
  if (!token) return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId') || ''

  try {
    const res = await fetch(`${ORIGIN_API}?projectId=${encodeURIComponent(projectId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    })

    if (!res.ok) return NextResponse.json({ success: true, data: null })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ success: true, data: null })
  }
}
