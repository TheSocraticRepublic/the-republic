import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * The app version, read once from package.json at import time. Single source
 * for every surface that reports a version (health endpoint, archive bundle
 * REPUBLIC_VERSION) — before this module each hardcoded its own copy and a
 * package.json bump would silently desynchronize them.
 */
export const APP_VERSION: string = (() => {
  try {
    const pkgPath = join(process.cwd(), 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
})()
