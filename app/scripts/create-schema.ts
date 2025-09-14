import { readFileSync } from 'fs'
import { join } from 'path'
import { query } from '../lib/db/connection'

async function createSchema() {
  try {
    console.log('Creating database schema...')
    
    // Read the schema file
    const schemaPath = join(__dirname, '../lib/db/schema.sql')
    const schema = readFileSync(schemaPath, 'utf8')
    
    // Execute the schema
    await query(schema)
    
    console.log('✓ Database schema created successfully!')
    console.log('📋 Tables created: users, templates, jobs, results')
  } catch (error) {
    console.error('❌ Schema creation failed:', error)
    console.log('\n💡 Make sure PostgreSQL is running and the database exists')
    console.log('📖 See DATABASE_SETUP.md for detailed instructions')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  createSchema().then(() => process.exit(0))
}

export { createSchema }
