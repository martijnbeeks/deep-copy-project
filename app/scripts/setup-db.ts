import { query } from '../lib/db/connection'
import { createUser } from '../lib/db/queries'
import { seedTemplates } from './seed-templates'

async function setupDatabase() {
  try {
    console.log('Setting up database...')
    
    // Test database connection first
    console.log('Testing database connection...')
    await query('SELECT NOW()')
    console.log('✓ Database connection successful')
    
    // Create a demo user
    console.log('Creating demo user...')
    try {
      await createUser('demo@example.com', 'password', 'Demo User')
      console.log('✓ Demo user created')
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        console.log('✓ Demo user already exists')
      } else {
        throw error
      }
    }
    
    // Seed templates
    await seedTemplates()
    
    console.log('Database setup completed successfully!')
    console.log('\n🎉 You can now start the development server with: npm run dev')
    console.log('📧 Login with: demo@example.com / password')
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    console.log('\n💡 Make sure PostgreSQL is running and check your connection settings in .env.local')
    console.log('📖 See DATABASE_SETUP.md for detailed instructions')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase().then(() => process.exit(0))
}

export { setupDatabase }
