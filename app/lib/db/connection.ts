import { Pool } from 'pg'

// Support both connection string (DATABASE_URL) and individual env vars
const getPoolConfig = () => {
  // If DATABASE_URL is provided, use it directly (Neon provides this format)
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : process.env.DATABASE_URL.includes('render.com')
          ? { rejectUnauthorized: false }
          : false,
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      acquireTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    }
  }

  // Fallback to individual env vars (for backward compatibility)
  const isNeon = process.env.DB_HOST?.includes('neon.tech')
  const isRender = process.env.DB_HOST?.includes('render.com')

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'ai_copywriting',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: isNeon || isRender ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    acquireTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  }
}

const pool = new Pool(getPoolConfig())

// Add connection event handlers for debugging
pool.on('connect', (client) => {
})

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
})

pool.on('remove', (client) => {
})

export default pool

export const query = async (text: string, params?: any[]) => {
  let retries = 3
  let lastError: any

  while (retries > 0) {
    try {
      const res = await pool.query(text, params)
      return res
    } catch (error: any) {
      lastError = error

      // If it's a connection error, retry
      if (error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('timeout')) {
        retries--
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second before retry
          continue
        }
      }

      // If it's not a connection error or we're out of retries, throw immediately
      throw error
    }
  }

  throw lastError
}
