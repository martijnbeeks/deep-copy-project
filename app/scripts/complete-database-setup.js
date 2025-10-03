// scripts/complete-database-setup.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// ============================================================================
// CONFIGURATION - Flexible database setup for local and cloud databases
// ============================================================================
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ai_copywriting',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  // Enable SSL for production/cloud databases (Render, Railway, Supabase, etc.)
  ssl: process.env.NODE_ENV === 'production' || 
       process.env.DB_HOST?.includes('render.com') || 
       process.env.DB_HOST?.includes('railway.app') || 
       process.env.DB_HOST?.includes('supabase.co') || 
       process.env.DB_HOST?.includes('amazonaws.com') ? 
       { rejectUnauthorized: false } : false,
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

// Demo user credentials
const DEMO_USER = {
  email: 'demo@example.com',
  name: 'Demo User',
  password: 'demo123'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getCategoryFromFilename(filename) {
  const name = filename.toLowerCase();
  if (name.includes('kingsloot') || name.includes('loot')) {
    return 'Gaming';
  } else if (name.includes('petlab') || name.includes('pet')) {
    return 'Pet Care';
  } else if (name.includes('javvycoffe') || name.includes('coffee')) {
    return 'Food & Beverage';
  } else if (name.includes('brunchescrunches') || name.includes('brunch')) {
    return 'Food & Beverage';
  } else {
    return 'General';
  }
}

function readSwipeTemplates() {
  const templatesDir = path.join(process.cwd(), 'swipe_templates');
  
  if (!fs.existsSync(templatesDir)) {
    console.log('⚠️  swipe_templates folder not found, skipping...');
    return [];
  }
  
  const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.html'));
  console.log(`�� Found ${files.length} HTML files in swipe_templates:`, files);
  
  const templates = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(templatesDir, file);
      const htmlContent = fs.readFileSync(filePath, 'utf8');
      const title = file.replace('.html', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const description = `Professional ${title} template for marketing campaigns`;
      const category = getCategoryFromFilename(file);
      
      templates.push({
        name: title,
        description,
        html_content: htmlContent,
        category
      });
    } catch (error) {
      console.error(`❌ Error reading file ${file}:`, error.message);
    }
  }
  
  return templates;
}

// ============================================================================
// DATABASE SETUP FUNCTIONS
// ============================================================================

async function createTables(client) {
  console.log('📝 Creating tables...');
  
  // Users table
  await client.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✅ Users table created');
  
  // Templates table with explicit unique constraint
  await client.query(`
    CREATE TABLE templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      html_content TEXT NOT NULL,
      category VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT templates_name_unique UNIQUE (name)
    );
  `);
  console.log('✅ Templates table created with unique constraint');
  
  // Jobs table
  await client.query(`
    CREATE TABLE jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      brand_info TEXT NOT NULL,
      sales_page_url TEXT,
      template_id UUID REFERENCES templates(id),
      status VARCHAR(50) DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      execution_id VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✅ Jobs table created');
  
  // Results table
  await client.query(`
    CREATE TABLE results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      html_content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('✅ Results table created');
}

async function createIndexes(client) {
  console.log('📊 Creating indexes...');
  
  const indexes = [
    'CREATE INDEX idx_jobs_user_id ON jobs(user_id);',
    'CREATE INDEX idx_jobs_status ON jobs(status);',
    'CREATE INDEX idx_jobs_created_at ON jobs(created_at);',
    'CREATE INDEX idx_results_job_id ON results(job_id);',
    'CREATE INDEX idx_templates_category ON templates(category);'
  ];
  
  for (const indexQuery of indexes) {
    await client.query(indexQuery);
  }
  console.log('✅ Indexes created');
}

async function insertDemoUser(client) {
  console.log('👤 Inserting demo user...');
  
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(DEMO_USER.password, saltRounds);
  
  await client.query(`
    INSERT INTO users (email, name, password_hash) VALUES 
    ($1, $2, $3);
  `, [DEMO_USER.email, DEMO_USER.name, hashedPassword]);
  
  console.log('✅ Demo user inserted');
  console.log(`   Email: ${DEMO_USER.email}`);
  console.log(`   Password: ${DEMO_USER.password}`);
}

async function insertDefaultTemplates(client) {
  console.log('📄 Inserting default templates...');
  
  const defaultTemplates = [
    {
      name: 'E-commerce Product Page',
      description: 'Professional product page template for e-commerce websites',
      html_content: '<!DOCTYPE html><html><head><title>Product Page</title></head><body><h1>Product Name</h1><p>Product description here...</p></body></html>',
      category: 'E-commerce'
    },
    {
      name: 'SaaS Landing Page',
      description: 'Modern landing page template for SaaS products',
      html_content: '<!DOCTYPE html><html><head><title>SaaS Landing</title></head><body><h1>Your SaaS Product</h1><p>Transform your business with our solution...</p></body></html>',
      category: 'SaaS'
    },
    {
      name: 'Lead Magnet Landing',
      description: 'High-converting landing page for lead magnets',
      html_content: '<!DOCTYPE html><html><head><title>Lead Magnet</title></head><body><h1>Get Your Free Guide</h1><p>Download our exclusive guide...</p></body></html>',
      category: 'Marketing'
    }
  ];
  
  for (const template of defaultTemplates) {
    await client.query(`
      INSERT INTO templates (name, description, html_content, category) VALUES 
      ($1, $2, $3, $4);
    `, [template.name, template.description, template.html_content, template.category]);
  }
  console.log('✅ Default templates inserted');
}

async function insertSwipeTemplates(client) {
  console.log('🎯 Inserting swipe templates...');
  
  const swipeTemplates = readSwipeTemplates();
  
  if (swipeTemplates.length === 0) {
    console.log('⚠️  No swipe templates found, skipping...');
    return;
  }
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  for (const template of swipeTemplates) {
    try {
      console.log(`📝 Processing: ${template.name} (Category: ${template.category})`);
      
      const result = await client.query(`
        INSERT INTO templates (name, description, html_content, category) VALUES 
        ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
        RETURNING id;
      `, [template.name, template.description, template.html_content, template.category]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Inserted: ${template.name}`);
        insertedCount++;
      } else {
        console.log(`⏭️  Skipped: ${template.name} (already exists)`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${template.name}:`, error.message);
    }
  }
  
  console.log(`✅ Swipe templates: ${insertedCount} inserted, ${skippedCount} skipped`);
}

async function verifySetup(client) {
  console.log('✅ Verifying setup...');
  
  const userCount = await client.query('SELECT COUNT(*) FROM users');
  const templateCount = await client.query('SELECT COUNT(*) FROM templates');
  
  console.log(`👥 Users: ${userCount.rows[0].count}`);
  console.log(`📄 Templates: ${templateCount.rows[0].count}`);
  
  // Show all templates by category
  const templates = await client.query('SELECT name, category FROM templates ORDER BY category, name');
  console.log('\n📋 All templates by category:');
  
  const categories = {};
  templates.rows.forEach(template => {
    if (!categories[template.category]) {
      categories[template.category] = [];
    }
    categories[template.category].push(template.name);
  });
  
  Object.keys(categories).sort().forEach(category => {
    console.log(`\n  ${category}:`);
    categories[category].forEach(name => {
      console.log(`    - ${name}`);
    });
  });
}

// ============================================================================
// MIGRATION FUNCTION - Add new fields to existing database
// ============================================================================
async function runMigration(client) {
  console.log('🔄 Running database migration...');
  
  try {
    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND column_name IN ('advertorial_type', 'persona', 'age_range', 'gender')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    const newColumns = ['advertorial_type', 'persona', 'age_range', 'gender'];
    const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col));
    
    if (columnsToAdd.length === 0) {
      console.log('✅ All new columns already exist, migration not needed');
      return;
    }
    
    console.log(`📝 Adding columns: ${columnsToAdd.join(', ')}`);
    
    // Add new columns to jobs table
    await client.query(`
      ALTER TABLE jobs 
      ADD COLUMN advertorial_type VARCHAR(50) DEFAULT 'Listicle',
      ADD COLUMN persona TEXT,
      ADD COLUMN age_range VARCHAR(50),
      ADD COLUMN gender VARCHAR(20)
    `);
    
    // Update existing records to have a default advertorial_type
    await client.query(`
      UPDATE jobs SET advertorial_type = 'Listicle' WHERE advertorial_type IS NULL
    `);
    
    // Make advertorial_type NOT NULL after setting defaults
    await client.query(`
      ALTER TABLE jobs ALTER COLUMN advertorial_type SET NOT NULL
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('Added columns: advertorial_type, persona, age_range, gender');
    
  } catch (error) {
    if (error.code === '42701') {
      console.log('ℹ️  Columns already exist, migration not needed');
    } else {
      throw error;
    }
  }
}

// ============================================================================
// MAIN SETUP FUNCTION
// ============================================================================

async function setupDatabase() {
  let client;
  try {
    console.log('🚀 Starting complete database setup...');
    console.log('�� Database:', DB_CONFIG.database);
    console.log('🌐 Host:', DB_CONFIG.host);
    console.log('�� User:', DB_CONFIG.user);
    console.log('');
    
    const pool = new Pool(DB_CONFIG);
    client = await pool.connect();
    console.log('✅ Connected to database');
    
    // 1. Drop existing tables if they exist (clean slate)
    console.log('🧹 Cleaning existing tables...');
    await client.query('DROP TABLE IF EXISTS results CASCADE;');
    await client.query('DROP TABLE IF EXISTS jobs CASCADE;');
    await client.query('DROP TABLE IF EXISTS templates CASCADE;');
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    console.log('✅ Existing tables dropped');
    
    // 2. Create tables
    await createTables(client);
    
    // 3. Create indexes
    await createIndexes(client);
    
    // 4. Insert demo user
    await insertDemoUser(client);
    
    // 5. Insert default templates
    await insertDefaultTemplates(client);
    
    // 6. Insert swipe templates
    await insertSwipeTemplates(client);
    
    // 7. Verify setup
    await verifySetup(client);
    
    console.log('\n�� Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update your environment variables:');
    console.log(`   DB_HOST=${DB_CONFIG.host}`);
    console.log(`   DB_PORT=${DB_CONFIG.port}`);
    console.log(`   DB_NAME=${DB_CONFIG.database}`);
    console.log(`   DB_USER=${DB_CONFIG.user}`);
    console.log(`   DB_PASSWORD=${DB_CONFIG.password}`);
    console.log('2. Deploy your application');
    console.log('3. Login with:');
    console.log(`   Email: ${DEMO_USER.email}`);
    console.log(`   Password: ${DEMO_USER.password}`);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Error code:', error.code);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused. Check your database credentials and network access.');
    } else if (error.code === '28P01') {
      console.error('\n�� Authentication failed. Check your username and password.');
    } else if (error.code === '3D000') {
      console.error('\n💡 Database does not exist. Create the database first.');
    }
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }
}

// ============================================================================
// MIGRATION-ONLY FUNCTION - For existing databases
// ============================================================================

async function runMigrationOnly() {
  let client;
  let pool;
  try {
    console.log('🚀 Starting database migration...');
    console.log('🌐 Database:', DB_CONFIG.database);
    console.log('🌐 Host:', DB_CONFIG.host);
    console.log('👤 User:', DB_CONFIG.user);
    console.log('');
    
    pool = new Pool(DB_CONFIG);
    client = await pool.connect();
    console.log('✅ Connected to database');
    
    // Run migration
    await runMigration(client);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Your database now supports:');
    console.log('   - advertorial_type (required field)');
    console.log('   - persona (optional field)');
    console.log('   - age_range (optional field)');
    console.log('   - gender (optional field)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error code:', error.code);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused. Check your database credentials and network access.');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Check your username and password.');
    } else if (error.code === '3D000') {
      console.error('\n💡 Database does not exist. Create the database first.');
    }
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }
}

// ============================================================================
// RUN SETUP OR MIGRATION
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'migrate') {
    runMigrationOnly();
  } else {
    console.log('🚀 Starting complete database setup...');
    console.log('💡 Tip: Use "node scripts/complete-database-setup.js migrate" to run migration only');
    setupDatabase();
  }
}

module.exports = { setupDatabase, runMigrationOnly, DB_CONFIG, DEMO_USER };