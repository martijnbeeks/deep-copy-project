#!/usr/bin/env tsx

import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

// Load environment variables from .env file
config()

// Database connection configuration
const getDbConfig = () => {
  // Try DATABASE_URL first (full connection string)
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    console.log('🔗 Using DATABASE_URL:', databaseUrl.replace(/\/\/.*@/, '//***:***@'))
    return { connectionString: databaseUrl }
  }
  
  // Fallback to individual parameters
  console.log('🔧 Using individual DB parameters')
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'your_database',
    user: process.env.DB_USER || 'your_username',
    password: process.env.DB_PASSWORD || 'your_password',
  }
}

async function runRollback(rollbackFile: string) {
  const pool = new Pool(getDbConfig())
  
  try {
    console.log(`🔄 Running rollback: ${rollbackFile}`)
    
    // Read rollback file
    const rollbackPath = join(__dirname, 'migrations', rollbackFile)
    const rollbackSQL = readFileSync(rollbackPath, 'utf8')
    
    // Connect to database
    const client = await pool.connect()
    
    try {
      // Start transaction
      await client.query('BEGIN')
      
      // Execute rollback
      await client.query(rollbackSQL)
      
      // Commit transaction
      await client.query('COMMIT')
      
      console.log(`✅ Rollback ${rollbackFile} completed successfully`)
      
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    
  } catch (error) {
    console.error(`❌ Rollback failed:`, error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Get rollback file from command line arguments
const rollbackFile = process.argv[2]

if (!rollbackFile) {
  console.error('❌ Please specify a rollback file')
  console.log('Usage: npx tsx rollback-migration.ts <rollback-file>')
  console.log('Example: npx tsx rollback-migration.ts rollback_add_job_credits_limit.sql')
  process.exit(1)
}

// Run the rollback
runRollback(rollbackFile)
