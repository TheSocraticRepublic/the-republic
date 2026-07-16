import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Only consumed by CLI migration tooling (drizzle.config.ts,
  // scripts/apply-custom-migrations.ts via scripts/lib/migration-database-url.ts).
  // The app runtime never reads this — it always uses DATABASE_URL.
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('production'),
  ENABLE_ARWEAVE: z.string().default('false'),
  IRYS_NETWORK: z.string().default('devnet'),
  ARWEAVE_GATEWAY: z.string().default('https://arweave.net'),

  // FORUM-1: server-side, fail-closed gate for the (unshipped) Forum surface.
  // Read directly via isForumEnabled() (src/lib/forum/flag.ts), not the `env`
  // proxy — same reasoning as ENABLE_ARWEAVE above. Declared here too so it
  // shows up in schema validation / docs, not because anything parses it
  // through getEnv().
  FORUM_ENABLED: z.string().default('false'),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  AP_DOMAIN: z.string().optional(),
  PINATA_JWT: z.string().optional(),
  PINATA_GATEWAY: z.string().optional(),
  IRYS_PRIVATE_KEY: z.string().optional(),
  DEV_AUTH_BYPASS: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  VOYAGE_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env)
  }
  return _env
}

export const env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env]
  },
})
