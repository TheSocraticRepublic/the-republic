import 'server-only'
import { SignJWT, jwtVerify } from 'jose'

const JWT_EXPIRY = '7d'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export interface JWTPayload {
  sub: string  // user ID
  email: string
  iat?: number
  exp?: number
}

export async function signJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret())
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      sub: payload.sub as string,
      email: payload['email'] as string,
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}
