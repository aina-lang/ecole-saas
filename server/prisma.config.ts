import { defineConfig } from 'prisma/config'
import { loadEnvFile } from 'node:process'
import { resolve } from 'node:path'

try {
  loadEnvFile(resolve(process.cwd(), '.env'))
} catch {
  /* .env absent */
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
