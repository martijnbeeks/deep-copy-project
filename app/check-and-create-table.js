const { Pool } = require('pg');

// dev-2 branch (matches .env.local)
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nr9wb0VgLIDQ@ep-shiny-dust-agleytwf-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function checkAndCreateTable() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔍 Checking if image_generation_jobs table exists...');
    
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'image_generation_jobs'
      );
    `);

    const exists = tableExists.rows[0].exists;
    console.log(`❓ image_generation_jobs exists: ${exists ? 'YES' : 'NO'}`);

    if (!exists) {
      console.log('\n🚀 Table does not exist. Creating it now...');
      
      await pool.query('BEGIN');

      await pool.query(`
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
      `);
      console.log('✅ Table created');

      const indexes = [
        `CREATE INDEX idx_image_generation_jobs_status ON image_generation_jobs(status)`,
        `CREATE INDEX idx_image_generation_jobs_user_id ON image_generation_jobs(user_id)`,
        `CREATE INDEX idx_image_generation_jobs_external_job_id ON image_generation_jobs(external_job_id)`,
        `CREATE INDEX idx_image_generation_jobs_created_at ON image_generation_jobs(created_at)`,
        `CREATE INDEX idx_image_generation_jobs_updated_at ON image_generation_jobs(updated_at)`,
        `CREATE INDEX idx_image_generation_jobs_polling ON image_generation_jobs(status, updated_at) WHERE status IN ('pending', 'processing')`
      ];
      for (const idx of indexes) { await pool.query(idx); }
      console.log('✅ Indexes created');

      await pool.query(`
        CREATE OR REPLACE FUNCTION update_image_generation_jobs_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $$ language 'plpgsql';
      `);

      await pool.query(`
        CREATE TRIGGER trigger_update_image_generation_jobs_updated_at
            BEFORE UPDATE ON image_generation_jobs
            FOR EACH ROW
            EXECUTE FUNCTION update_image_generation_jobs_updated_at();
      `);
      console.log('✅ Trigger created');

      await pool.query('COMMIT');
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('✅ Table already exists.');
      
      // Reset any failed jobs so they can be retried
      const resetResult = await pool.query(`
        UPDATE image_generation_jobs 
        SET status = 'pending', error_message = NULL, updated_at = NOW()
        WHERE status = 'failed'
        RETURNING id, external_job_id
      `);
      if (resetResult.rows.length > 0) {
        console.log(`🔄 Reset ${resetResult.rows.length} failed job(s) to pending:`);
        resetResult.rows.forEach(row => console.log(`   - ${row.external_job_id}`));
      } else {
        console.log('No failed jobs to reset.');
      }

      // Always show current structure
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'image_generation_jobs'
        ORDER BY ordinal_position;
      `);
      console.log('\n📋 Table structure:');
      console.table(cols.rows);
    }

  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch(e) {}
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkAndCreateTable();
