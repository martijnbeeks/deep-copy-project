import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ai_copywriting',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_HOST?.includes('render.com') ? { rejectUnauthorized: false } : false,
  max: 10, // Reduced from 20 to be more conservative
  idleTimeoutMillis: 60000, // Increased to 60 seconds
  connectionTimeoutMillis: 10000, // Increased to 10 seconds
  acquireTimeoutMillis: 10000, // Add acquire timeout
  keepAlive: true, // Enable keep-alive
  keepAliveInitialDelayMillis: 10000, // Keep-alive interval
})

// Add connection event handlers for debugging
pool.on('connect', (client) => {
  console.log('New database client connected')
})

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err)
})

pool.on('remove', (client) => {
  console.log('Database client removed from pool')
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
          console.log(`Database query failed, retrying... (${retries} attempts left)`)
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
