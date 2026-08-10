/**
 * scripts/_env.mjs
 *
 * Loads .env.local into process.env for the standalone scripts.
 * Kept dependency-free on purpose — the project does not install dotenv, and
 * `next dev` reads .env.local itself, so this only exists for `node scripts/*`.
 *
 * Values already present in the environment always win, so CI can override.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))

export function loadEnvLocal(file = '../.env.local') {
  try {
    const lines = readFileSync(resolve(here, file), 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (key && !(key in process.env)) process.env[key] = value
    }
  } catch {
    // absent in CI — env vars are expected to be set already
  }
}
