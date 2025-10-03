import { query } from './connection'
import { User, Template, Job, Result, JobWithTemplate, JobWithResult } from './types'
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
  advertorial_type: string
  persona?: string
  age_range?: string
  gender?: string
  execution_id?: string
  custom_id?: string
}): Promise<Job> => {
  if (jobData.custom_id) {
    // Use custom ID (DeepCopy job ID) as the primary key
    const result = await query(
      'INSERT INTO jobs (id, user_id, title, brand_info, sales_page_url, template_id, advertorial_type, persona, age_range, gender, execution_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
      [jobData.custom_id, jobData.user_id, jobData.title, jobData.brand_info, jobData.sales_page_url, jobData.template_id, jobData.advertorial_type, jobData.persona, jobData.age_range, jobData.gender, jobData.execution_id]
    )
    return result.rows[0]
  } else {
    // Use default UUID generation
    const result = await query(
      'INSERT INTO jobs (user_id, title, brand_info, sales_page_url, template_id, advertorial_type, persona, age_range, gender, execution_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [jobData.user_id, jobData.title, jobData.brand_info, jobData.sales_page_url, jobData.template_id, jobData.advertorial_type, jobData.persona, jobData.age_range, jobData.gender, jobData.execution_id]
    )
    return result.rows[0]
  }
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
    LEFT JOIN results r ON j.id = r.job_id
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
      console.log('completed_at column not found, skipping...')
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
