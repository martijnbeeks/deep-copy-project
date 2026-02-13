const { Pool } = require('pg');

// Your DATABASE_URL
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nr9wb0VgLIDQ@ep-still-leaf-agtx4xxw-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function runMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  console.log('🚀 Starting migration: Create image_generation_jobs table');

  try {
    await pool.query('BEGIN');

    // Create the image_generation_jobs table
    const createTableQuery = `
      CREATE TABLE image_generation_jobs (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          external_job_id TEXT NOT NULL UNIQUE,
          injected_template_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          prompts JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP,
          result_images JSONB,
          error_message TEXT
      );
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Table created successfully');

    // Add comments
    const comments = [
      `COMMENT ON TABLE image_generation_jobs IS 'Tracks image generation jobs for background polling and recovery'`,
      `COMMENT ON COLUMN image_generation_jobs.id IS 'Primary key - local database ID'`,
      `COMMENT ON COLUMN image_generation_jobs.external_job_id IS 'Backend API job ID from prelander-images service'`,
      `COMMENT ON COLUMN image_generation_jobs.injected_template_id IS 'Template ID that images are being generated for'`,
      `COMMENT ON COLUMN image_generation_jobs.user_id IS 'User who initiated the image generation'`,
      `COMMENT ON COLUMN image_generation_jobs.status IS 'Current status of the job'`,
      `COMMENT ON COLUMN image_generation_jobs.prompts IS 'Original prompts used for image generation'`,
      `COMMENT ON COLUMN image_generation_jobs.result_images IS 'Generated image URLs when job completes'`,
      `COMMENT ON COLUMN image_generation_jobs.error_message IS 'Error details if job fails'`
    ];

    for (const comment of comments) {
      await pool.query(comment);
    }
    console.log('✅ Comments added');

    // Create indexes
    const indexes = [
      `CREATE INDEX idx_image_generation_jobs_status ON image_generation_jobs(status)`,
      `CREATE INDEX idx_image_generation_jobs_user_id ON image_generation_jobs(user_id)`,
      `CREATE INDEX idx_image_generation_jobs_external_job_id ON image_generation_jobs(external_job_id)`,
      `CREATE INDEX idx_image_generation_jobs_created_at ON image_generation_jobs(created_at)`,
      `CREATE INDEX idx_image_generation_jobs_updated_at ON image_generation_jobs(updated_at)`,
      `CREATE INDEX idx_image_generation_jobs_polling ON image_generation_jobs(status, updated_at) WHERE status IN ('pending', 'processing')`
    ];

    for (const index of indexes) {
      await pool.query(index);
    }
    console.log('✅ Indexes created');

    // Create trigger function for updated_at
    const triggerFunction = `
      CREATE OR REPLACE FUNCTION update_image_generation_jobs_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `;
    
    await pool.query(triggerFunction);
    console.log('✅ Trigger function created');

    // Create trigger
    const trigger = `
      CREATE TRIGGER trigger_update_image_generation_jobs_updated_at
          BEFORE UPDATE ON image_generation_jobs
          FOR EACH ROW
          EXECUTE FUNCTION update_image_generation_jobs_updated_at();
    `;
    
    await pool.query(trigger);
    console.log('✅ Trigger created');

    // Verify the migration
    const verifyQuery = `
      SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
      FROM information_schema.columns 
      WHERE table_name = 'image_generation_jobs'
      ORDER BY ordinal_position;
    `;
    
    const verification = await pool.query(verifyQuery);
    console.log('\n📋 Table verification:');
    console.table(verification.rows);

    // Show table statistics
    const tableCheck = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'image_generation_jobs'
    `);
    
    console.log(`\n📊 Table exists: ${tableCheck.rows[0].count > 0 ? 'YES' : 'NO'}`);

    // Show indexes
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'image_generation_jobs'
      ORDER BY indexname
    `);
    
    console.log('\n📚 Indexes created:');
    console.table(indexCheck.rows);

    await pool.query('COMMIT');
    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Rollback function
async function rollbackMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  console.log('⚠️  Rolling back migration: Drop image_generation_jobs table');

  try {
    await pool.query('DROP TABLE IF EXISTS image_generation_jobs');
    console.log('✅ Table dropped successfully');
    
    // Drop trigger function if it exists
    await pool.query('DROP FUNCTION IF EXISTS update_image_generation_jobs_updated_at()');
    console.log('✅ Trigger function dropped');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Command line arguments
const command = process.argv[2];

if (command === 'rollback') {
  rollbackMigration();
} else if (command === 'up' || !command) {
  runMigration();
} else {
  console.log('Usage:');
  console.log('  node create-image-generationJobs-table.js up    # Run migration');
  console.log('  node create-image-generationJobs-table.js rollback # Rollback migration');
  process.exit(1);
}
