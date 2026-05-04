import { NextRequest } from 'next/server'

type RouteContext = { params: Promise<Record<string, string>> }

type RouteHandler = (
  request: NextRequest,
  context: RouteContext
) => Promise<Response>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeRoute(handler: (...args: any[]) => Promise<Response>): RouteHandler {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (err) {
      console.error(`[${request.method} ${request.nextUrl.pathname}]`, err)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }
}
