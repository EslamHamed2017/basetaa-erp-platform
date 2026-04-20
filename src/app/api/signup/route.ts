import { NextRequest, NextResponse } from 'next/server'
import { provisionTenant } from '@/lib/provisioning'
import { SignupInput } from '@/types'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const input = body as SignupInput
  const result = await provisionTenant(input)

  if (!result.success) {
    return NextResponse.json(result, { status: 422 })
  }

  return NextResponse.json(result, { status: 201 })
}
