import { query } from './connection'
import { User, Template, Job, Result, JobWithTemplate, JobWithResult, InjectableTemplate } from './types'
import bcrypt from 'bcryptjs'

// User queries
export const createUser = async (email: string, password: string, name: string): Promise<User> => {
  const passwordHash = await bcrypt.hash(password, 10)
  const result = await query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
    [email, passwordHash, name]
  )
  return result.rows[0]
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const result = await query('SELECT * FROM users WHERE email = $1', [email])
  return result.rows[0] || null
}

export const validatePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

// Template queries
export const getTemplates = async (filters: { category?: string; search?: string } = {}): Promise<Template[]> => {
  let sql = 'SELECT * FROM templates'
  const params: any[] = []
  const conditions: string[] = []

  if (filters.category) {
    conditions.push('category = $' + (params.length + 1))
    params.push(filters.category)
  }

  if (filters.search) {
    conditions.push('(name ILIKE $' + (params.length + 1) + ' OR description ILIKE $' + (params.length + 1) + ')')
    params.push(`%${filters.search}%`)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY created_at DESC'

  const result = await query(sql, params)
  return result.rows
}

export const getTemplateById = async (id: string): Promise<Template | null> => {
  const result = await query('SELECT * FROM templates WHERE id = $1', [id])
  return result.rows[0] || null
}

// Job queries
export const createJob = async (jobData: {
  user_id: string
  title: string
  brand_info: string
  sales_page_url?: string
  template_id?: string
  advertorial_type?: string
  target_approach?: string
  avatars?: any[]
  execution_id?: string
  custom_id?: string
}): Promise<Job> => {
  if (jobData.custom_id) {
    // Use custom ID (DeepCopy job ID) as the primary key
    const result = await query(
      'INSERT INTO jobs (id, user_id, title, brand_info, sales_page_url, template_id, advertorial_type, target_approach, avatars, execution_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [jobData.custom_id, jobData.user_id, jobData.title, jobData.brand_info, jobData.sales_page_url, jobData.template_id, jobData.advertorial_type, jobData.target_approach, JSON.stringify(jobData.avatars || []), jobData.execution_id]
    )
    return result.rows[0]
  } else {
    // Use default UUID generation
    const result = await query(
      'INSERT INTO jobs (user_id, title, brand_info, sales_page_url, template_id, advertorial_type, target_approach, avatars, execution_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [jobData.user_id, jobData.title, jobData.brand_info, jobData.sales_page_url, jobData.template_id, jobData.advertorial_type, jobData.target_approach, JSON.stringify(jobData.avatars || []), jobData.execution_id]
    )
    return result.rows[0]
  }
}

export const checkDuplicateJob = async (userId: string, title: string): Promise<Job | null> => {
  // Check for jobs with the same title created within the last 30 seconds
  const result = await query(
    'SELECT * FROM jobs WHERE user_id = $1 AND title = $2 AND created_at > NOW() - INTERVAL \'30 seconds\' ORDER BY created_at DESC LIMIT 1',
    [userId, title]
  )
  return result.rows[0] || null
}

export const getJobsByUserIdWithResults = async (userId: string, filters: { status?: string; search?: string; page?: number; limit?: number; offset?: number } = {}): Promise<JobWithResult[]> => {
  let sql = `
    SELECT j.*, t.name as template_name, t.description as template_description, t.html_content as template_html_content, t.category as template_category,
           r.id as result_id, r.html_content as result_html_content, r.metadata as result_metadata, r.created_at as result_created_at
    FROM jobs j
    LEFT JOIN templates t ON j.template_id = t.id
    LEFT JOIN results r ON j.id = r.job_id
    WHERE j.user_id = $1
  `
  const params: any[] = [userId]
  const conditions: string[] = []

  if (filters.status) {
    conditions.push('j.status = $' + (params.length + 1))
    params.push(filters.status)
  }

  if (filters.search) {
    conditions.push('(j.title ILIKE $' + (params.length + 1) + ' OR j.brand_info ILIKE $' + (params.length + 1) + ')')
    params.push(`%${filters.search}%`)
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY j.created_at DESC'

  // Add pagination
  if (filters.limit) {
    sql += ' LIMIT $' + (params.length + 1)
    params.push(filters.limit)
  }

  if (filters.offset) {
    sql += ' OFFSET $' + (params.length + 1)
    params.push(filters.offset)
  }

  const result = await query(sql, params)
  return result.rows.map(row => ({
    ...row,
    template: row.template_id ? {
      id: row.template_id,
      name: row.template_name,
      description: row.template_description,
      html_content: row.template_html_content,
      category: row.template_category,
      created_at: row.created_at,
      updated_at: row.updated_at
    } : undefined,
    result: row.result_id ? {
      id: row.result_id,
      job_id: row.id,
      html_content: row.result_html_content,
      metadata: row.result_metadata,
      created_at: row.result_created_at
    } : undefined
  }))
}

export const getJobsByUserId = async (userId: string, filters: { status?: string; search?: string } = {}): Promise<JobWithTemplate[]> => {
  let sql = `
    SELECT j.*, t.name as template_name, t.description as template_description, t.html_content as template_html_content, t.category as template_category
    FROM jobs j
    LEFT JOIN templates t ON j.template_id = t.id
    WHERE j.user_id = $1
  `
  const params: any[] = [userId]
  const conditions: string[] = []

  if (filters.status) {
    conditions.push('j.status = $' + (params.length + 1))
    params.push(filters.status)
  }

  if (filters.search) {
    conditions.push('(j.title ILIKE $' + (params.length + 1) + ' OR j.brand_info ILIKE $' + (params.length + 1) + ')')
    params.push(`%${filters.search}%`)
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY j.created_at DESC'

  const result = await query(sql, params)
  return result.rows.map(row => ({
    ...row,
    template: row.template_id ? {
      id: row.template_id,
      name: row.template_name,
      description: row.template_description,
      html_content: row.template_html_content,
      category: row.template_category,
      created_at: '',
      updated_at: ''
    } : undefined
  }))
}

export const getJobById = async (id: string, userId?: string): Promise<JobWithResult | null> => {
  let sql = `
    SELECT j.*, t.name as template_name, t.description as template_description, t.html_content as template_html_content, t.category as template_category,
           r.id as result_id, r.html_content as result_html_content, r.metadata as result_metadata, r.created_at as result_created_at
    FROM jobs j
    LEFT JOIN templates t ON j.template_id = t.id
    LEFT JOIN (
      SELECT DISTINCT ON (job_id) *
      FROM results
      ORDER BY job_id, created_at DESC
    ) r ON j.id = r.job_id
    WHERE j.id = $1
  `
  const params: any[] = [id]

  if (userId) {
    sql += ' AND j.user_id = $2'
    params.push(userId)
  }

  const result = await query(sql, params)
  if (result.rows.length === 0) return null

  const row = result.rows[0]
  return {
    ...row,
    template: row.template_id ? {
      id: row.template_id,
      name: row.template_name,
      description: row.template_description,
      html_content: row.template_html_content,
      category: row.template_category,
      created_at: '',
      updated_at: ''
    } : undefined,
    result: row.result_id ? {
      id: row.result_id,
      job_id: row.id,
      html_content: row.result_html_content,
      metadata: row.result_metadata,
      created_at: row.result_created_at
    } : undefined
  }
}

export const updateJobStatus = async (id: string, status: string, progress?: number, execution_id?: string): Promise<void> => {
  const updates: string[] = ['status = $2', 'updated_at = NOW()']
  const params: any[] = [id, status]

  if (progress !== undefined) {
    updates.push('progress = $' + (params.length + 1))
    params.push(progress)
  }

  if (execution_id) {
    updates.push('execution_id = $' + (params.length + 1))
    params.push(execution_id)
  }

  // Only add completed_at if the column exists (for backward compatibility)
  if (status === 'completed' || status === 'failed') {
    try {
      // Check if completed_at column exists
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'completed_at'
      `)
      
      if (columnCheck.rows.length > 0) {
        updates.push('completed_at = NOW()')
      }
    } catch (error) {
      // completed_at column not found, skipping
    }
  }

  await query(`UPDATE jobs SET ${updates.join(', ')} WHERE id = $1`, params)
}

export const updateJobExecutionId = async (id: string, execution_id: string): Promise<void> => {
  await query('UPDATE jobs SET execution_id = $2, updated_at = NOW() WHERE id = $1', [id, execution_id])
}

export const deleteJobById = async (id: string, userId: string): Promise<void> => {
  // First delete the associated result if it exists
  await query('DELETE FROM results WHERE job_id = $1', [id])
  
  // Then delete the job
  const result = await query('DELETE FROM jobs WHERE id = $1 AND user_id = $2', [id, userId])
  
  if (result.rowCount === 0) {
    throw new Error('Job not found or does not belong to user')
  }
}

// Result queries
export const createResult = async (jobId: string, htmlContent: string, metadata?: Record<string, any>): Promise<Result> => {
  const result = await query(
    'INSERT INTO results (job_id, html_content, metadata) VALUES ($1, $2, $3) RETURNING *',
    [jobId, htmlContent, JSON.stringify(metadata)]
  )
  return result.rows[0]
}

// Injectable Template queries
export const getInjectableTemplateById = async (id: string): Promise<InjectableTemplate[]> => {
  const result = await query('SELECT * FROM injectable_templates WHERE id = $1', [id])
  return result.rows
}

export const getInjectableTemplates = async (type?: 'listicle' | 'advertorial'): Promise<InjectableTemplate[]> => {
  let sql = 'SELECT * FROM injectable_templates'
  const params: any[] = []

  if (type) {
    sql += ' WHERE advertorial_type = $1'
    params.push(type)
  }

  sql += ' ORDER BY created_at DESC'

  const result = await query(sql, params)
  return result.rows
}

// Get injectable template ID for a given advertorial type
// This maps the template selection to the actual swipe file ID used by DeepCopy API
export const getInjectableTemplateIdForType = async (advertorialType: string): Promise<string | null> => {
  const result = await query(
    'SELECT id FROM injectable_templates WHERE advertorial_type = $1 ORDER BY created_at DESC LIMIT 1', 
    [advertorialType]
  )
  return result.rows[0]?.id || null
}

// Get injectable template ID based on the selected template ID
// This creates a mapping between regular templates and injectable templates
export const getInjectableTemplateIdForTemplate = async (templateId: string): Promise<string | null> => {
  // First get the template to determine its category/type
  const templateResult = await query('SELECT category FROM templates WHERE id = $1', [templateId])
  const template = templateResult.rows[0]
  
  if (!template) {
    return null
  }
  
  // Map template category to advertorial type
  const advertorialType = template.category === 'listicle' ? 'listicle' : 'advertorial'
  
  // Get the injectable template with the SAME ID as the template
  const injectableResult = await query(
    'SELECT id FROM injectable_templates WHERE id = $1 AND advertorial_type = $2', 
    [templateId, advertorialType]
  )
  
  if (injectableResult.rows[0]) {
    return injectableResult.rows[0].id
  }
  
  // Fallback: Get the most recent injectable template for this type if exact match not found
  const fallbackResult = await query(
    'SELECT id FROM injectable_templates WHERE advertorial_type = $1 ORDER BY created_at DESC LIMIT 1', 
    [advertorialType]
  )
  
  return fallbackResult.rows[0]?.id || null
}

export const getRandomInjectableTemplate = async (type: 'listicle' | 'advertorial'): Promise<InjectableTemplate | null> => {
  const result = await query(
    'SELECT * FROM injectable_templates WHERE advertorial_type = $1 ORDER BY RANDOM() LIMIT 1',
    [type]
  )
  return result.rows[0] || null
}

export const createInjectableTemplate = async (
  name: string,
  type: 'listicle' | 'advertorial',
  htmlContent: string,
  description?: string,
  customId?: string
): Promise<InjectableTemplate> => {
  const result = await query(
    'INSERT INTO injectable_templates (id, name, advertorial_type, html_content, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [customId || undefined, name, type, htmlContent, description]
  )
  return result.rows[0]
}

export const updateInjectableTemplate = async (
  id: string,
  updates: Partial<Pick<InjectableTemplate, 'name' | 'html_content' | 'description' | 'advertorial_type'>>
): Promise<InjectableTemplate | null> => {
  const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined)
  if (fields.length === 0) return null

  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ')
  const values = fields.map(field => updates[field as keyof typeof updates])
  
  const result = await query(
    `UPDATE injectable_templates SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return result.rows[0] || null
}

export const deleteInjectableTemplate = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM injectable_templates WHERE id = $1', [id])
  return result.rowCount > 0
}

// Job result queries
export const updateJobResult = async (jobId: string, updates: { html_content?: string; metadata?: any }): Promise<boolean> => {
  const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined)
  if (fields.length === 0) return false

  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ')
  const values = fields.map(field => {
    const value = updates[field as keyof typeof updates]
    return field === 'metadata' ? JSON.stringify(value) : value
  })
  
  const result = await query(
    `UPDATE results SET ${setClause} WHERE job_id = $1`,
    [jobId, ...values]
  )
  return result.rowCount > 0
}

// Injected templates queries
export const createInjectedTemplate = async (
  jobId: string,
  angleName: string,
  templateId: string,
  htmlContent: string,
  angleIndex?: number
): Promise<any> => {
  // Ensure injected_templates table exists
  await query(`
    CREATE TABLE IF NOT EXISTS injected_templates (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      angle_index INTEGER NOT NULL DEFAULT 1,
      angle_name VARCHAR(255) NOT NULL,
      html_content TEXT NOT NULL,
      template_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  // Use provided angleIndex or default to 1
  const finalAngleIndex = angleIndex || 1
  
  const result = await query(
    'INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [jobId, finalAngleIndex, angleName, htmlContent, templateId]
  )
  return result.rows[0]
}

export const getInjectedTemplatesByJob = async (jobId: string): Promise<any[]> => {
  const result = await query(
    'SELECT * FROM injected_templates WHERE job_id = $1 ORDER BY angle_index, created_at',
    [jobId]
  )
  return result.rows
}

export const getGeneratedAnglesForJob = async (jobId: string): Promise<string[]> => {
  const result = await query(
    'SELECT DISTINCT angle_name FROM injected_templates WHERE job_id = $1',
    [jobId]
  )
  return result.rows.map(row => row.angle_name)
}
