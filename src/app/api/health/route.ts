import { NextResponse } from 'next/server'
import { safeRoute } from '@/lib/api/safe-route'

export const GET = safeRoute(async () => {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  })
})
