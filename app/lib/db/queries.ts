import { query, withTransaction } from './connection'
import { User, Template, Job, Result, JobWithTemplate, JobWithResult, InjectableTemplate, InviteLink, Organization, OrganizationMember, UserRole, MemberStatus, InviteType, UsageType, OrganizationUsageLimits, OrganizationUsageTracking, JobCreditEvent, EditableProductDetails } from './types'
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
  parent_job_id?: string
  avatar_persona_name?: string
  is_avatar_job?: boolean
  screenshot?: string
  // V2 form fields
  research_requirements?: string
  target_gender?: string
  target_location?: string
  form_advertorial_type?: string
}): Promise<Job> => {
  if (jobData.custom_id) {
    // Use custom ID (DeepCopy job ID) as the primary key
    const result = await query(
      'INSERT INTO jobs (id, user_id, title, brand_info, sales_page_url, template_id, advertorial_type, target_approach, avatars, execution_id, parent_job_id, avatar_persona_name, is_avatar_job, screenshot, research_requirements, target_gender, target_location, form_advertorial_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *',
      [
        jobData.custom_id,
        jobData.user_id,
        jobData.title,
        jobData.brand_info,
        jobData.sales_page_url,
        jobData.template_id,
        jobData.advertorial_type,
        jobData.target_approach,
        JSON.stringify(jobData.avatars || []),
        jobData.execution_id,
        jobData.parent_job_id || null,
        jobData.avatar_persona_name || null,
        jobData.is_avatar_job || false,
        jobData.screenshot || null, // screenshot from avatar extraction (product_image)
        jobData.research_requirements || null,
        jobData.target_gender || null,
        jobData.target_location || null,
        jobData.form_advertorial_type || null
      ]
    )
    return result.rows[0]
  } else {
    // Use default UUID generation
    const result = await query(
      'INSERT INTO jobs (user_id, title, brand_info, sales_page_url, template_id, advertorial_type, target_approach, avatars, execution_id, parent_job_id, avatar_persona_name, is_avatar_job, screenshot, research_requirements, target_gender, target_location, form_advertorial_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *',
      [
        jobData.user_id,
        jobData.title,
        jobData.brand_info,
        jobData.sales_page_url,
        jobData.template_id,
        jobData.advertorial_type,
        jobData.target_approach,
        JSON.stringify(jobData.avatars || []),
        jobData.execution_id,
        jobData.parent_job_id || null,
        jobData.avatar_persona_name || null,
        jobData.is_avatar_job || false,
        jobData.screenshot || null, // screenshot from avatar extraction (product_image)
        jobData.research_requirements || null,
        jobData.target_gender || null,
        jobData.target_location || null,
        jobData.form_advertorial_type || null
      ]
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
      AND j.parent_job_id IS NULL
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
      AND j.parent_job_id IS NULL
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

export const updateJobAvatars = async (id: string, avatars: any[]): Promise<void> => {
  await query(
    'UPDATE jobs SET avatars = $2, updated_at = NOW() WHERE id = $1',
    [id, JSON.stringify(avatars)]
  )
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
        updates.push('completed_at = COALESCE(completed_at, NOW())')
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

export const updateJobScreenshot = async (id: string, screenshot: string): Promise<void> => {
  await query('UPDATE jobs SET screenshot = $2, updated_at = NOW() WHERE id = $1', [id, screenshot])
}

export const updateJob = async (id: string, userId: string, updates: Partial<Pick<Job, 'title' | 'brand_info' | 'sales_page_url'>>): Promise<Job | null> => {
  const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined)
  if (fields.length === 0) return null

  const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ')
  const values = fields.map(field => updates[field as keyof typeof updates])

  const result = await query(
    `UPDATE jobs SET ${setClause}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId, ...values]
  )
  return result.rows[0] || null
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
  updates: Partial<Pick<InjectableTemplate, 'name' | 'html_content' | 'description' | 'advertorial_type' | 'is_active'>>
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
  return (result.rowCount ?? 0) > 0
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
  return (result.rowCount ?? 0) > 0
}

// Injected templates queries
export const createInjectedTemplate = async (
  jobId: string,
  angleName: string,
  templateId: string,
  htmlContent: string,
  angleIndex?: number,
  configData?: any
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
      config_data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  // Add config_data column if it doesn't exist (for existing tables)
  try {
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'injected_templates' 
          AND column_name = 'config_data'
        ) THEN
          ALTER TABLE injected_templates 
          ADD COLUMN config_data JSONB;
        END IF;
      END $$;
    `)
  } catch (error) {
    console.log('Error adding config_data column (may already exist):', error)
  }

  // Use provided angleIndex or default to 1
  const finalAngleIndex = angleIndex || 1

  // Prepare config_data - if it's an object, stringify it; if it's already a string, use as-is; otherwise null
  let configDataValue: string | null = null
  if (configData !== undefined && configData !== null) {
    if (typeof configData === 'string') {
      configDataValue = configData
    } else if (typeof configData === 'object') {
      configDataValue = JSON.stringify(configData)
    }
  }

  const result = await query(
    'INSERT INTO injected_templates (job_id, angle_index, angle_name, html_content, template_id, config_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [jobId, finalAngleIndex, angleName, htmlContent, templateId, configDataValue]
  )
  return result.rows[0]
}

export const getInjectedTemplatesByJob = async (jobId: string): Promise<any[]> => {
  // First get all injected templates
  const injectedTemplates = await query(
    'SELECT * FROM injected_templates WHERE job_id = $1 ORDER BY angle_index, created_at DESC',
    [jobId]
  )
  
  // Then for each template, get the swipe file name from injectable_templates
  const result = await Promise.all(
    injectedTemplates.rows.map(async (row) => {
      let swipe_file_name = null
      
      if (row.template_id) {
        try {
          const templateIdParam = String(row.template_id).trim()
          const nameResult = await query(
            'SELECT name FROM injectable_templates WHERE id::text = $1::text',
            [templateIdParam]
          )
          
          if (nameResult.rows.length > 0) {
            swipe_file_name = nameResult.rows[0].name
          }
        } catch (error) {
          console.error(`Error fetching swipe_file_name for template_id "${row.template_id}":`, error)
        }
      }
      
      return {
        ...row,
        swipe_file_name
      }
    })
  )
  
  return result
}

export const getGeneratedAnglesForJob = async (jobId: string): Promise<string[]> => {
  const result = await query(
    'SELECT DISTINCT angle_name FROM injected_templates WHERE job_id = $1',
    [jobId]
  )
  return result.rows.map(row => row.angle_name)
}

// Invite Link queries
export const createInviteLink = async (data: {
  created_by: string
  invite_type: InviteType
  waitlist_email?: string | null
  organization_id?: string | null
  expires_at: Date
}): Promise<InviteLink> => {
  const token = crypto.randomUUID()
  const result = await query(
    `INSERT INTO invite_links (token, created_by, invite_type, waitlist_email, organization_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [token, data.created_by, data.invite_type, data.waitlist_email || null, data.organization_id || null, data.expires_at]
  )
  return result.rows[0]
}

export const getInviteLinkByToken = async (token: string): Promise<InviteLink | null> => {
  const result = await query(
    'SELECT * FROM invite_links WHERE token = $1',
    [token]
  )
  return result.rows[0] || null
}

export const markInviteLinkAsUsed = async (token: string, used_by: string): Promise<boolean> => {
  console.log('[MARK_INVITE_USED] Starting', { token, used_by, timestamp: new Date().toISOString() })
  
  try {
    const result = await query(
      'UPDATE invite_links SET used_at = NOW(), used_by = $2, updated_at = NOW() WHERE token = $1 RETURNING id',
      [token, used_by]
    )
    
    console.log('[MARK_INVITE_USED] Query executed', { 
      token, 
      used_by, 
      rowsAffected: result.rowCount || result.rows.length,
      returnedIds: result.rows.map(r => r.id)
    })
    
    if (result.rows.length === 0) {
      console.error('[MARK_INVITE_USED] No rows updated - checking current state', { token, used_by })
      // Try to fetch the invite to see its current state
      const currentInvite = await getInviteLinkByToken(token)
      console.error('[MARK_INVITE_USED] Current invite state', { 
        token, 
        currentInvite: currentInvite ? {
          id: currentInvite.id,
          usedAt: currentInvite.used_at,
          usedBy: currentInvite.used_by,
          token: currentInvite.token
        } : null
      })
      return false
    }
    
    console.log('[MARK_INVITE_USED] Successfully marked invite as used', { 
      token, 
      used_by, 
      inviteId: result.rows[0].id 
    })
    return true
  } catch (error) {
    console.error('[MARK_INVITE_USED] Exception caught', { 
      token, 
      used_by, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

export const getInviteLinksByCreator = async (created_by: string): Promise<InviteLink[]> => {
  const result = await query(
    'SELECT * FROM invite_links WHERE created_by = $1 ORDER BY created_at DESC',
    [created_by]
  )
  return result.rows
}

export const getInviteLinksByOrganization = async (organization_id: string): Promise<InviteLink[]> => {
  const result = await query(
    'SELECT * FROM invite_links WHERE organization_id = $1 ORDER BY created_at DESC',
    [organization_id]
  )
  return result.rows
}

export const deleteInviteLink = async (id: string): Promise<boolean> => {
  const result = await query(
    'DELETE FROM invite_links WHERE id = $1',
    [id]
  )
  return (result.rowCount ?? 0) > 0
}

// Organization queries
export const createOrganization = async (name: string, created_by: string): Promise<Organization> => {
  console.log('[CREATE_ORG] Starting createOrganization', { name, created_by, timestamp: new Date().toISOString() })
  
  console.log('[CREATE_ORG] Calling ensureUsageLimitsTables')
  await ensureUsageLimitsTables()
  console.log('[CREATE_ORG] ensureUsageLimitsTables completed')
  
  console.log('[CREATE_ORG] Inserting organization into database', { name, created_by })
  const result = await query(
    'INSERT INTO organizations (name, created_by) VALUES ($1, $2) RETURNING *',
    [name, created_by]
  )
  console.log('[CREATE_ORG] Organization inserted', { orgId: result.rows[0]?.id })
  
  const organization = result.rows[0]
  
  // Automatically create default usage limits for the new organization
  console.log('[CREATE_ORG] Setting organization usage limits', { orgId: organization.id })
  await setOrganizationUsageLimits(organization.id, {
    deep_research_limit: 3,
    pre_lander_limit: 30,
    static_ads_limit: 30,
    templates_images_limit: 30
  })
  console.log('[CREATE_ORG] Usage limits set successfully', { orgId: organization.id })
  
  console.log('[CREATE_ORG] createOrganization completed', { orgId: organization.id, name: organization.name })
  return organization
}

export const getOrganizationById = async (id: string): Promise<Organization | null> => {
  const result = await query(
    'SELECT * FROM organizations WHERE id = $1',
    [id]
  )
  return result.rows[0] || null
}

export const getUserOrganizations = async (userId: string): Promise<Organization[]> => {
  const result = await query(
    `SELECT o.* FROM organizations o
     INNER JOIN organization_members om ON o.id = om.organization_id
     WHERE om.user_id = $1 AND om.status = 'approved'
     ORDER BY o.created_at DESC`,
    [userId]
  )
  return result.rows
}

// Organization Member queries
export const createOrganizationMember = async (data: {
  organization_id: string
  user_id: string
  role: UserRole
  status: MemberStatus
  invited_by?: string | null
}): Promise<OrganizationMember> => {
  const result = await query(
    `INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.organization_id, data.user_id, data.role, data.status, data.invited_by || null]
  )
  return result.rows[0]
}

export const getOrganizationMembers = async (organizationId: string): Promise<(OrganizationMember & { user: User })[]> => {
  const result = await query(
    `SELECT om.*, u.id as user_id, u.email, u.name, u.username, u.created_at as user_created_at
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1
     ORDER BY om.created_at DESC`,
    [organizationId]
  )
  return result.rows.map(row => ({
    id: row.id,
    organization_id: row.organization_id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    invited_by: row.invited_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      username: row.username,
      password_hash: '',
      created_at: row.user_created_at,
      updated_at: row.user_created_at
    }
  }))
}

export const updateOrganizationMemberStatus = async (
  memberId: string,
  status: MemberStatus,
  role: UserRole
): Promise<OrganizationMember | null> => {
  const result = await query(
    'UPDATE organization_members SET status = $2, role = $3, updated_at = NOW() WHERE id = $1 RETURNING *',
    [memberId, status, role]
  )
  return result.rows[0] || null
}

export const getOrganizationMember = async (organizationId: string, userId: string): Promise<OrganizationMember | null> => {
  const result = await query(
    'SELECT * FROM organization_members WHERE organization_id = $1 AND user_id = $2',
    [organizationId, userId]
  )
  return result.rows[0] || null
}

export const checkUserPermission = async (userId: string, organizationId: string, action: 'read' | 'write' | 'create' | 'delete'): Promise<boolean> => {
  const member = await getOrganizationMember(organizationId, userId)
  if (!member || member.status !== 'approved') {
    return false
  }
  
  if (action === 'delete') {
    return member.role === 'admin'
  }
  
  // read, write, create are allowed for both admin and normal_user
  return true
}

export const createUserWithUsername = async (email: string, password: string, name: string, username?: string): Promise<User> => {
  const passwordHash = await bcrypt.hash(password, 10)
  const result = await query(
    'INSERT INTO users (email, password_hash, name, username) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, passwordHash, name, username || null]
  )
  return result.rows[0]
}

// Usage Limits Schema Setup
export const ensureUsageLimitsTables = async (client?: any): Promise<void> => {
  const runner = client || { query };
  console.log('[ENSURE_TABLES] Starting ensureUsageLimitsTables', { timestamp: new Date().toISOString() })
  
  // Create organization_usage_limits table
  console.log('[ENSURE_TABLES] Creating organization_usage_limits table')
  await runner.query(`
    CREATE TABLE IF NOT EXISTS organization_usage_limits (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      deep_research_limit INTEGER NOT NULL DEFAULT 3,
      pre_lander_limit INTEGER NOT NULL DEFAULT 30,
      static_ads_limit INTEGER NOT NULL DEFAULT 30,
      templates_images_limit INTEGER NOT NULL DEFAULT 30,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('[ENSURE_TABLES] organization_usage_limits table ensured')
  
  // Add static_ads_limit column if it doesn't exist (for existing tables)
  try {
    await runner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organization_usage_limits' 
          AND column_name = 'static_ads_limit'
        ) THEN
          ALTER TABLE organization_usage_limits 
          ADD COLUMN static_ads_limit INTEGER NOT NULL DEFAULT 30;
        END IF;
      END $$;
    `)
    console.log('[ENSURE_TABLES] static_ads_limit column ensured')
  } catch (error) {
    console.log('[ENSURE_TABLES] Error adding static_ads_limit column (may already exist):', error)
  }

  // Add templates_images_limit column if it doesn't exist (for existing tables)
  try {
    await runner.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'organization_usage_limits' 
          AND column_name = 'templates_images_limit'
        ) THEN
          ALTER TABLE organization_usage_limits 
          ADD COLUMN templates_images_limit INTEGER NOT NULL DEFAULT 30;
        END IF;
      END $$;
    `)
    console.log('[ENSURE_TABLES] templates_images_limit column ensured')
  } catch (error) {
    console.log('[ENSURE_TABLES] Error adding templates_images_limit column (may already exist):', error)
  }

  // Create organization_usage_tracking table
  console.log('[ENSURE_TABLES] Creating organization_usage_tracking table')
  await runner.query(`
    CREATE TABLE IF NOT EXISTS organization_usage_tracking (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      usage_type TEXT NOT NULL CHECK (usage_type IN ('deep_research', 'pre_lander', 'static_ads', 'templates_images')),
      week_start_date DATE NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(organization_id, usage_type, week_start_date)
    )
  `)
  console.log('[ENSURE_TABLES] organization_usage_tracking table ensured')
  
  // Update CHECK constraint to include 'static_ads' if table exists with old constraint
  try {
    await runner.query(`
      DO $$ 
      BEGIN
        -- Drop old constraint if it exists
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'organization_usage_tracking_usage_type_check'
        ) THEN
          ALTER TABLE organization_usage_tracking 
          DROP CONSTRAINT organization_usage_tracking_usage_type_check;
        END IF;
        
        -- Add new constraint with static_ads and templates_images
        ALTER TABLE organization_usage_tracking 
        ADD CONSTRAINT organization_usage_tracking_usage_type_check 
        CHECK (usage_type IN ('deep_research', 'pre_lander', 'static_ads', 'templates_images'));
      END $$;
    `)
    console.log('[ENSURE_TABLES] usage_type CHECK constraint updated')
  } catch (error) {
    console.log('[ENSURE_TABLES] Error updating CHECK constraint (may already be correct):', error)
  }

  // Create index for faster lookups
  console.log('[ENSURE_TABLES] Creating index')
  await runner.query(`
    CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_type_date 
    ON organization_usage_tracking(organization_id, usage_type, week_start_date)
  `)
  console.log('[ENSURE_TABLES] Index created')
  console.log('[ENSURE_TABLES] ensureUsageLimitsTables completed')
}

// Usage Limits Queries
export const getOrganizationUsageLimits = async (organizationId: string): Promise<OrganizationUsageLimits | null> => {
  console.log('[GET_LIMITS] Starting getOrganizationUsageLimits', { organizationId, timestamp: new Date().toISOString() })
  
  console.log('[GET_LIMITS] Calling ensureUsageLimitsTables')
  await ensureUsageLimitsTables()
  console.log('[GET_LIMITS] ensureUsageLimitsTables completed')
  
  console.log('[GET_LIMITS] Querying organization_usage_limits', { organizationId })
  const result = await query(
    'SELECT * FROM organization_usage_limits WHERE organization_id = $1',
    [organizationId]
  )
  console.log('[GET_LIMITS] Query completed', { organizationId, found: result.rows.length > 0 })
  
  if (result.rows.length === 0) {
    console.log('[GET_LIMITS] No limits found, creating default limits', { organizationId })
    // Create default limits if they don't exist
    await setOrganizationUsageLimits(organizationId, { deep_research_limit: 3, pre_lander_limit: 30, static_ads_limit: 30, templates_images_limit: 30 })
    console.log('[GET_LIMITS] Default limits created, querying again', { organizationId })
    const newResult = await query(
      'SELECT * FROM organization_usage_limits WHERE organization_id = $1',
      [organizationId]
    )
    console.log('[GET_LIMITS] Second query completed', { organizationId, found: newResult.rows.length > 0 })
    return newResult.rows[0] || null
  }
  
  console.log('[GET_LIMITS] Returning existing limits', { organizationId })
  return result.rows[0]
}

export const setOrganizationUsageLimits = async (
  organizationId: string,
  limits: { deep_research_limit?: number; pre_lander_limit?: number; static_ads_limit?: number; templates_images_limit?: number, job_credits_limit?: number },
  client?: any
): Promise<OrganizationUsageLimits> => {
  const runner = client || { query };
  console.log('[SET_LIMITS] Starting setOrganizationUsageLimits', { organizationId, limits, timestamp: new Date().toISOString() })

  await ensureUsageLimitsTables()

  const existingResult = await query(
    'SELECT * FROM organization_usage_limits WHERE organization_id = $1',
    [organizationId]
  )
  const existing = existingResult.rows[0] || null

  if (existing) {
    const updates: string[] = ['updated_at = NOW()']
    const params: any[] = [organizationId]

    if (limits.deep_research_limit !== undefined) {
      updates.push(`deep_research_limit = $${params.length + 1}`)
      params.push(limits.deep_research_limit)
    }
    if (limits.pre_lander_limit !== undefined) {
      updates.push(`pre_lander_limit = $${params.length + 1}`)
      params.push(limits.pre_lander_limit)
    }
    if (limits.static_ads_limit !== undefined) {
      updates.push(`static_ads_limit = $${params.length + 1}`)
      params.push(limits.static_ads_limit)
    }
    
    if (limits.templates_images_limit !== undefined) {
      updates.push(`templates_images_limit = $${params.length + 1}`)
      params.push(limits.templates_images_limit)
    }
    
    console.log('[SET_LIMITS] Executing UPDATE query', { organizationId, updates })
    if (limits.job_credits_limit !== undefined) {
      updates.push(`job_credits_limit = $${params.length + 1}`)
      params.push(limits.job_credits_limit)
    }

    const result = await query(
      `UPDATE organization_usage_limits SET ${updates.join(', ')} WHERE organization_id = $1 RETURNING *`,
      params
    )
    return result.rows[0]
  }

  const result = await runner.query(
    `INSERT INTO organization_usage_limits (
      organization_id, 
      deep_research_limit, 
      pre_lander_limit, 
      static_ads_limit,
      templates_images_limit,
      job_credits_limit
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (organization_id) 
    DO UPDATE SET 
      deep_research_limit = COALESCE($2, organization_usage_limits.deep_research_limit),
      pre_lander_limit = COALESCE($3, organization_usage_limits.pre_lander_limit),
      static_ads_limit = COALESCE($4, organization_usage_limits.static_ads_limit),
      templates_images_limit = COALESCE($5, organization_usage_limits.templates_images_limit),
      job_credits_limit = COALESCE($6, organization_usage_limits.job_credits_limit),
      updated_at = NOW()
    RETURNING *`,
    [
      organizationId,
      limits.deep_research_limit ?? null,
      limits.pre_lander_limit ?? null,
      limits.static_ads_limit ?? null,
      limits.templates_images_limit ?? null,
      limits.job_credits_limit ?? null
    ]
  )
  return result.rows[0]
}

export const getOrganizationUsage = async (
  organizationId: string,
  usageType: UsageType,
  weekStartDate: string,
  client?: any
): Promise<OrganizationUsageTracking | null> => {
  const runner = client || { query };
  await ensureUsageLimitsTables(client)
  
  const result = await runner.query(
    'SELECT * FROM organization_usage_tracking WHERE organization_id = $1 AND usage_type = $2 AND week_start_date = $3',
    [organizationId, usageType, weekStartDate]
  )
  
  return result.rows[0] || null
}

export const incrementOrganizationUsage = async (
  organizationId: string,
  usageType: UsageType,
  client?: any
): Promise<OrganizationUsageTracking> => {
  const runner = client || { query };
  await ensureUsageLimitsTables(client)
  
  const today = new Date().toISOString().split('T')[0]
  
  // Check if there's an existing tracking within the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
  
  const existingResult = await runner.query(
    `SELECT * FROM organization_usage_tracking 
     WHERE organization_id = $1 AND usage_type = $2 
     AND week_start_date >= $3 
     ORDER BY week_start_date DESC 
     LIMIT 1`,
    [organizationId, usageType, sevenDaysAgoStr]
  )
  
  if (existingResult.rows.length > 0) {
    // Check if we're still within the 7-day window
    const existing = existingResult.rows[0]
    const weekStartDate = new Date(existing.week_start_date)
    const todayDate = new Date(today)
    const daysDiff = Math.floor((todayDate.getTime() - weekStartDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff < 7) {
      // Still within window, increment existing count
      const result = await runner.query(
        `UPDATE organization_usage_tracking 
         SET count = count + 1, updated_at = NOW() 
         WHERE id = $1 RETURNING *`,
        [existing.id]
      )
      return result.rows[0]
    } else {
      // Outside window, create new entry with today's date
      const result = await runner.query(
        `INSERT INTO organization_usage_tracking (organization_id, usage_type, week_start_date, count) 
         VALUES ($1, $2, $3, 1) RETURNING *`,
        [organizationId, usageType, today]
      )
      return result.rows[0]
    }
  } else {
    // No existing usage, create new tracking entry
    const result = await runner.query(
      `INSERT INTO organization_usage_tracking (organization_id, usage_type, week_start_date, count) 
       VALUES ($1, $2, $3, 1) RETURNING *`,
      [organizationId, usageType, today]
    )
    return result.rows[0]
  }
}

export const getAllOrganizationsWithLimits = async (client?: any): Promise<Array<OrganizationUsageLimits & {
  organization: Organization
  current_deep_research_usage: number
  current_pre_lander_usage: number
  current_static_ads_usage: number
  current_templates_images_usage: number
  current_job_credits_usage: number
  deep_research_week_start: string | null
  pre_lander_week_start: string | null
  static_ads_week_start: string | null
  templates_images_week_start: string | null
}>> => {
  const runner = client || { query };
  await ensureUsageLimitsTables(client)
  
  // First, ensure all organizations have limits (create defaults if missing) in a single query
  await runner.query(`
    INSERT INTO organization_usage_limits (organization_id, deep_research_limit, pre_lander_limit, static_ads_limit, templates_images_limit, job_credits_limit)
    SELECT id, 3, 30, 30, 30, 19
    FROM organizations
    WHERE id NOT IN (SELECT organization_id FROM organization_usage_limits)
    ON CONFLICT (organization_id) DO NOTHING
  `)
  
  // Now get all organizations with their limits
  const result = await runner.query(`
    SELECT 
      oul.*,
      o.id as org_id,
      o.name as org_name,
      o.created_by as org_created_by,
      o.created_at as org_created_at,
      o.updated_at as org_updated_at,
      COALESCE((
        SELECT SUM(count)
        FROM organization_usage_tracking
        WHERE organization_id = oul.organization_id
        AND usage_type = 'deep_research'
      ), 0) as current_deep_research_usage,
      COALESCE((
        SELECT SUM(count)
        FROM organization_usage_tracking
        WHERE organization_id = oul.organization_id
        AND usage_type = 'pre_lander'
      ), 0) as current_pre_lander_usage,
      COALESCE((
        SELECT SUM(count)
        FROM organization_usage_tracking
        WHERE organization_id = oul.organization_id
        AND usage_type = 'static_ads'
      ), 0) as current_static_ads_usage,
      COALESCE((
        SELECT SUM(count) 
        FROM organization_usage_tracking 
        WHERE organization_id = oul.organization_id 
        AND usage_type = 'templates_images'
      ), 0) as current_templates_images_usage,
      0 as current_job_credits_usage,
      (
        SELECT MAX(week_start_date)
        FROM organization_usage_tracking
        WHERE organization_id = oul.organization_id
        AND usage_type = 'deep_research'
      ) as deep_research_week_start,
      (
        SELECT MAX(week_start_date)
        FROM organization_usage_tracking
        WHERE organization_id = oul.organization_id
        AND usage_type = 'pre_lander'
      ) as pre_lander_week_start,
      (
        SELECT MAX(week_start_date)
        FROM organization_usage_tracking
        WHERE organization_id = oul.organization_id
        AND usage_type = 'static_ads'
      ) as static_ads_week_start
      ,
      (
        SELECT MAX(week_start_date)
        FROM organization_usage_tracking
        WHERE organization_id = oul.organization_id
        AND usage_type = 'templates_images'
      ) as templates_images_week_start
    FROM organization_usage_limits oul
    INNER JOIN organizations o ON oul.organization_id = o.id
    ORDER BY o.name
  `)
  
  return result.rows.map((row: any) => ({
    organization_id: row.organization_id,
    deep_research_limit: row.deep_research_limit,
    pre_lander_limit: row.pre_lander_limit,
    static_ads_limit: row.static_ads_limit || 30,
    templates_images_limit: row.templates_images_limit || 30,
    job_credits_limit: row.job_credits_limit || 19,
    created_at: row.created_at,
    updated_at: row.updated_at,
    organization: {
      id: row.org_id,
      name: row.org_name,
      created_by: row.org_created_by,
      created_at: row.org_created_at,
      updated_at: row.org_updated_at
    },
    current_deep_research_usage: parseInt(row.current_deep_research_usage) || 0,
    current_pre_lander_usage: parseInt(row.current_pre_lander_usage) || 0,
    current_static_ads_usage: parseInt(row.current_static_ads_usage) || 0,
    current_templates_images_usage: parseInt(row.current_templates_images_usage) || 0,
    current_job_credits_usage: parseInt(row.current_job_credits_usage) || 0,
    deep_research_week_start: row.deep_research_week_start,
    pre_lander_week_start: row.pre_lander_week_start,
    static_ads_week_start: row.static_ads_week_start,
    templates_images_week_start: row.templates_images_week_start
  }))
}

// ==================== STATIC ADS QUERIES ====================

export interface StaticAdJob {
  id: string
  original_job_id: string
  external_job_id: string
  user_id: string
  status: string
  progress: number
  error_message: string | null
  selected_angles: string | null
  created_at: string
  updated_at: string
}

export interface GeneratedStaticAd {
  id: string
  static_ad_job_id: string
  original_job_id: string
  image_url: string
  angle_index: number
  variation_number: number
  angle_name: string
  status: string
  created_at: string
  updated_at: string
}

export interface ImageLibraryItem {
  id: number
  library_id: string
  url: string
  created_at: string
}

// Ensure static ads tables exist
const ensureStaticAdsTables = async (client?: any): Promise<void> => {
  const runner = client || { query };
  // Create static_ad_jobs table
  await runner.query(`
    CREATE TABLE IF NOT EXISTS static_ad_jobs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      original_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      external_job_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      selected_angles TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  // Add selected_angles column if it doesn't exist (for existing tables)
  await runner.query(`
    ALTER TABLE static_ad_jobs 
    ADD COLUMN IF NOT EXISTS selected_angles TEXT
  `).catch(() => {
    // Column might already exist, ignore error
  })
  
  // Create generated_static_ads table
  await runner.query(`
    CREATE TABLE IF NOT EXISTS generated_static_ads (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      static_ad_job_id TEXT NOT NULL REFERENCES static_ad_jobs(id) ON DELETE CASCADE,
      original_job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      angle_index INTEGER NOT NULL,
      variation_number INTEGER NOT NULL,
      angle_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generating',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  // Create image_library table
  await runner.query(`
    CREATE TABLE IF NOT EXISTS image_library (
      id SERIAL PRIMARY KEY,
      library_id TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  
  // Create indexes
  await runner.query(`
    CREATE INDEX IF NOT EXISTS idx_static_ad_jobs_original_job 
    ON static_ad_jobs(original_job_id)
  `)
  
  await runner.query(`
    CREATE INDEX IF NOT EXISTS idx_static_ad_jobs_user 
    ON static_ad_jobs(user_id)
  `)
  
  await runner.query(`
    CREATE INDEX IF NOT EXISTS idx_generated_static_ads_job 
    ON generated_static_ads(static_ad_job_id)
  `)
  
  await runner.query(`
    CREATE INDEX IF NOT EXISTS idx_generated_static_ads_original_job 
    ON generated_static_ads(original_job_id)
  `)
}

export const getImageLibrary = async (client?: any): Promise<ImageLibraryItem[]> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const result = await runner.query('SELECT * FROM image_library ORDER BY id ASC')
  return result.rows
}

export const createStaticAdJob = async (data: {
  original_job_id: string
  external_job_id: string
  user_id: string
  selected_angles?: string[]
}, client?: any): Promise<StaticAdJob> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const selectedAnglesJson = data.selected_angles ? JSON.stringify(data.selected_angles) : null
  const result = await runner.query(
    `INSERT INTO static_ad_jobs (original_job_id, external_job_id, user_id, status, progress, selected_angles)
     VALUES ($1, $2, $3, 'pending', 0, $4) RETURNING *`,
    [data.original_job_id, data.external_job_id, data.user_id, selectedAnglesJson]
  )
  return result.rows[0]
}

export const getStaticAdJob = async (id: string, client?: any): Promise<StaticAdJob | null> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const result = await runner.query('SELECT * FROM static_ad_jobs WHERE id = $1', [id])
  return result.rows[0] || null
}

export const getStaticAdJobByExternalId = async (externalJobId: string, client?: any): Promise<StaticAdJob | null> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const result = await runner.query('SELECT * FROM static_ad_jobs WHERE external_job_id = $1', [externalJobId])
  return result.rows[0] || null
}

export const updateStaticAdJobStatus = async (
  id: string,
  status: string,
  progress?: number,
  errorMessage?: string | null,
  client?: any
): Promise<void> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const updates: string[] = ['status = $2', 'updated_at = NOW()']
  const params: any[] = [id, status]

  if (progress !== undefined) {
    updates.push('progress = $' + (params.length + 1))
    params.push(progress)
  }

  if (errorMessage !== undefined) {
    updates.push('error_message = $' + (params.length + 1))
    params.push(errorMessage)
  }

  await runner.query(`UPDATE static_ad_jobs SET ${updates.join(', ')} WHERE id = $1`, params)
}

export const getStaticAdJobsByOriginalJob = async (originalJobId: string, client?: any): Promise<StaticAdJob[]> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const result = await runner.query(
    'SELECT * FROM static_ad_jobs WHERE original_job_id = $1 ORDER BY created_at DESC',
    [originalJobId]
  )
  return result.rows
}

// Ensure unique index exists on generated_static_ads to prevent duplicates
const ensureGeneratedStaticAdsUniqueConstraint = async (client?: any): Promise<boolean> => {
  const runner = client || { query };
  try {
    // Check if unique index already exists
    const indexCheck = await runner.query(`
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'generated_static_ads_job_url_unique'
      LIMIT 1
    `)
    
    if (indexCheck.rows.length > 0) {
      // Index already exists
      return true
    }
    
    // Index doesn't exist, check if we have duplicates that would prevent creation
    const duplicateCheck = await runner.query(`
      SELECT static_ad_job_id, image_url, COUNT(*) as count
      FROM generated_static_ads
      GROUP BY static_ad_job_id, image_url
      HAVING COUNT(*) > 1
      LIMIT 1
    `)
    
    if (duplicateCheck.rows.length > 0) {
      // We have duplicates, clean them up first (keep the oldest record for each job+url)
      console.log('[ENSURE_INDEX] Cleaning up duplicates before creating unique index...')
      await runner.query(`
        DELETE FROM generated_static_ads
        WHERE id NOT IN (
          SELECT DISTINCT ON (static_ad_job_id, image_url) id
          FROM generated_static_ads
          ORDER BY static_ad_job_id, image_url, created_at ASC
        )
      `)
      console.log('[ENSURE_INDEX] Duplicates cleaned up')
    }
    
    // Now create unique index to prevent duplicate images per job
    // This will be used by ON CONFLICT clause
    await runner.query(`
      CREATE UNIQUE INDEX generated_static_ads_job_url_unique 
      ON generated_static_ads(static_ad_job_id, image_url)
    `)
    console.log('[ENSURE_INDEX] Unique index created successfully')
    return true
  } catch (error: any) {
    // If index creation fails, log but don't throw
    // Common reasons: already exists, permission issues, or still has duplicates
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      // Index might exist with different name or was just created
      return true
    }
    console.log('[ENSURE_INDEX] Error ensuring unique index:', error.message)
    return false
  }
}

export const createGeneratedStaticAd = async (data: {
  static_ad_job_id: string
  original_job_id: string
  image_url: string
  angle_index: number
  variation_number: number
  angle_name: string
  status?: string
}, client?: any): Promise<{ record: GeneratedStaticAd | null; isNew: boolean }> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  // Ensure unique constraint exists (idempotent)
  // Returns true if index exists/created, false otherwise
  const indexExists = await ensureGeneratedStaticAdsUniqueConstraint(client)
  
  // Try using ON CONFLICT first (if index exists)
  if (indexExists) {
    try {
      const result = await runner.query(
        `INSERT INTO generated_static_ads 
         (static_ad_job_id, original_job_id, image_url, angle_index, variation_number, angle_name, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (static_ad_job_id, image_url) DO NOTHING
         RETURNING *`,
        [
          data.static_ad_job_id,
          data.original_job_id,
          data.image_url,
          data.angle_index,
          data.variation_number,
          data.angle_name,
          data.status || 'generating'
        ]
      )
      
      // If INSERT returned a row, it's a new image
      if (result.rows.length > 0) {
        return { record: result.rows[0], isNew: true }
      }
      
      // If no row returned, the image already exists (ON CONFLICT prevented insert)
      // Fetch and return the existing record
      const existing = await runner.query(
        `SELECT * FROM generated_static_ads 
         WHERE static_ad_job_id = $1 AND image_url = $2 
         LIMIT 1`,
        [data.static_ad_job_id, data.image_url]
      )
      
      if (existing.rows.length > 0) {
        return { record: existing.rows[0], isNew: false }
      }
      
      return { record: null, isNew: false }
    } catch (error: any) {
      // If ON CONFLICT fails (index doesn't actually exist), fall back to WHERE NOT EXISTS
      if (error.code === '42P10' || error.message?.includes('no unique or exclusion constraint')) {
        console.log('[CREATE_STATIC_AD] ON CONFLICT failed, falling back to WHERE NOT EXISTS')
        // Fall through to fallback logic below
      } else {
        // Re-throw other errors
        throw error
      }
    }
  }
  
  // Fallback: Use WHERE NOT EXISTS (atomic but works without unique index)
  // This handles cases where the index doesn't exist or couldn't be created
  const result = await runner.query(
    `INSERT INTO generated_static_ads 
     (static_ad_job_id, original_job_id, image_url, angle_index, variation_number, angle_name, status)
     SELECT $1, $2, $3, $4, $5, $6, $7
     WHERE NOT EXISTS (
       SELECT 1 FROM generated_static_ads 
       WHERE static_ad_job_id = $1 AND image_url = $3
     )
     RETURNING *`,
    [
      data.static_ad_job_id,
      data.original_job_id,
      data.image_url,
      data.angle_index,
      data.variation_number,
      data.angle_name,
      data.status || 'generating'
    ]
  )
  
  // If INSERT returned a row, it's a new image
  if (result.rows.length > 0) {
    return { record: result.rows[0], isNew: true }
  }
  
  // If no row returned, the image already exists (WHERE NOT EXISTS prevented insert)
  // Fetch and return the existing record
  const existing = await runner.query(
    `SELECT * FROM generated_static_ads 
     WHERE static_ad_job_id = $1 AND image_url = $2 
     LIMIT 1`,
    [data.static_ad_job_id, data.image_url]
  )
  
  if (existing.rows.length > 0) {
    return { record: existing.rows[0], isNew: false }
  }
  
  // This shouldn't happen, but handle edge case
  return { record: null, isNew: false }
}

export const updateGeneratedStaticAdStatus = async (
  id: string,
  status: string,
  client?: any
): Promise<void> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  await runner.query(
    'UPDATE generated_static_ads SET status = $2, updated_at = NOW() WHERE id = $1',
    [id, status]
  )
}

export const getGeneratedStaticAds = async (
  staticAdJobId: string,
  client?: any
): Promise<GeneratedStaticAd[]> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const result = await runner.query(
    'SELECT * FROM generated_static_ads WHERE static_ad_job_id = $1 ORDER BY angle_index, variation_number',
    [staticAdJobId]
  )
  return result.rows
}

export const getGeneratedStaticAdsByOriginalJob = async (
  originalJobId: string,
  client?: any
): Promise<GeneratedStaticAd[]> => {
  const runner = client || { query };
  await ensureStaticAdsTables(client)
  const result = await runner.query(
    `SELECT gsa.* FROM generated_static_ads gsa
     INNER JOIN static_ad_jobs saj ON gsa.static_ad_job_id = saj.id
     WHERE saj.original_job_id = $1
     ORDER BY gsa.angle_index, gsa.variation_number`,
    [originalJobId]
  )
  return result.rows
}

// ==================== STRIPE / BILLING QUERIES ====================

export interface DbCustomer {
  id: string
  organization_id: string
  stripe_customer_id: string
  email: string
  created_at: string
}

export interface DbSubscription {
  id: string
  organization_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  plan_id: string
  status: string
  current_period_end: string
  last_event_created_at: number
  created_at: string
  updated_at: string
}

export interface DbWebhookLog {
  id: string
  stripe_event_id: string
  event_type: string
  payload: any
  status: 'pending' | 'processed' | 'failed'
  error_message: string | null
  created_at: string
}

/**
 * Creates or updates a customer record
 */
export const upsertCustomer = async (data: {
  organization_id: string
  stripe_customer_id: string
  email: string
}, client?: any): Promise<DbCustomer> => {
  const runner = client || { query };
  const result = await runner.query(
    `INSERT INTO customers (organization_id, stripe_customer_id, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (stripe_customer_id) 
     DO UPDATE SET 
       email = CASE 
         WHEN EXCLUDED.email != '' THEN EXCLUDED.email 
         ELSE customers.email 
       END
     RETURNING *`,
    [data.organization_id, data.stripe_customer_id, data.email]
  )
  return result.rows[0];
}

/**
 * Logs a webhook event to the database
 */
export const logWebhookEvent = async (data: {
  stripe_event_id: string
  event_type: string
  payload: any
}, client?: any): Promise<DbWebhookLog> => {
  const runner = client || { query };
  const result = await runner.query(
    `INSERT INTO stripe_webhook_logs (stripe_event_id, event_type, payload)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.stripe_event_id, data.event_type, JSON.stringify(data.payload)]
  )
  return result.rows[0];
}

/**
 * Updates the status of a logged webhook event
 */
export const updateWebhookLogStatus = async (
  stripeEventId: string, 
  status: 'processed' | 'failed', 
  errorMessage?: string,
  client?: any
): Promise<void> => {
  const runner = client || { query };
  await runner.query(
    `UPDATE stripe_webhook_logs 
     SET status = $2, error_message = $3 
     WHERE stripe_event_id = $1`,
    [stripeEventId, status, errorMessage || null]
  )
}

/**
 * Updates an organization's subscription
 */
export const updateSubscription = async (data: {
  stripe_subscription_id: string
  stripe_customer_id: string
  plan_id?: string
  status?: string
  current_period_end: Date
  last_event_created_at: number
  organization_id?: string
}, client?: any): Promise<DbSubscription> => {
  const runner = client || { query };
  const result = await runner.query(
    `INSERT INTO subscriptions (organization_id, stripe_subscription_id, stripe_customer_id, plan_id, status, current_period_end, last_event_created_at)
     VALUES (
       COALESCE($1, (SELECT organization_id FROM customers WHERE stripe_customer_id = $3)),
       $2, $3, 
       COALESCE($4, 'free'), 
       COALESCE($5, 'active'), 
       $6, $7
     )
     ON CONFLICT (stripe_subscription_id) 
     DO UPDATE SET 
       status = COALESCE($5, subscriptions.status),
       plan_id = COALESCE($4, subscriptions.plan_id),
       current_period_end = EXCLUDED.current_period_end,
       last_event_created_at = EXCLUDED.last_event_created_at,
       updated_at = NOW()
     RETURNING *`,
    [
      data.organization_id || null,
      data.stripe_subscription_id,
      data.stripe_customer_id,
      data.plan_id || null,
      data.status || null,
      data.current_period_end,
      data.last_event_created_at
    ]
  )
  
  const subscription = result.rows[0]
  
  // If plan changed, update organization usage limits
  if (subscription && subscription.organization_id) {
    const limits = {
      starter: { deep: 10, pre: 10, static: 10 },
      business: { deep: 50, pre: 50, static: 50 },
      'scale-up': { deep: 200, pre: 200, static: 200 }
    }[subscription.plan_id as 'starter' | 'business' | 'scale-up'] || { deep: 3, pre: 30, static: 30 }

    await setOrganizationUsageLimits(subscription.organization_id, {
      deep_research_limit: limits.deep,
      pre_lander_limit: limits.pre,
      static_ads_limit: limits.static
    }, client)
  }
  
  return subscription
}

/**
 * Fetches subscription by Stripe ID with a row-level lock
 */
export const getSubscriptionByStripeIdForUpdate = async (stripeSubscriptionId: string, client: any): Promise<DbSubscription | null> => {
  const result = await client.query(
    'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 FOR UPDATE',
    [stripeSubscriptionId]
  )
  return result.rows[0] || null
}

/**
 * Fetches subscription by Stripe ID
 */
export const getSubscriptionByStripeId = async (stripeSubscriptionId: string): Promise<DbSubscription | null> => {
  const result = await query(
    'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
    [stripeSubscriptionId]
  )
  return result.rows[0] || null
}

/**
 * Fetches the active subscription for an organization.
 * Prefers active/past_due so we return the current subscription when an org has multiple rows (e.g. canceled then resubscribed).
 */
export const getSubscriptionByOrganizationId = async (organizationId: string): Promise<DbSubscription | null> => {
  const result = await query(
    `SELECT * FROM subscriptions
     WHERE organization_id = $1 AND status IN ('active', 'past_due')
     ORDER BY current_period_end DESC NULLS LAST
     LIMIT 1`,
    [organizationId]
  )
  return result.rows[0] || null
}

/**
 * Fetches customer info by org ID
 */
export const getCustomerByOrganizationId = async (organizationId: string): Promise<DbCustomer | null> => {
  const result = await query(
    'SELECT * FROM customers WHERE organization_id = $1',
    [organizationId]
  )
  return result.rows[0] || null
}

/**
 * Resolve organization_id from Stripe customer ID (for invoice webhooks when metadata is missing)
 */
export const getOrganizationIdByStripeCustomerId = async (stripeCustomerId: string): Promise<string | null> => {
  const result = await query(
    'SELECT organization_id FROM customers WHERE stripe_customer_id = $1 LIMIT 1',
    [stripeCustomerId]
  )
  return result.rows[0]?.organization_id ?? null
}

// ==================== BILLING INVOICES & NOTIFICATIONS ====================

export interface DbBillingInvoice {
  id: string
  organization_id: string
  stripe_invoice_id: string
  amount_due: number
  amount_paid: number | null
  currency: string
  status: string
  period_start: string | null
  period_end: string | null
  billing_reason: string | null
  hosted_invoice_url: string | null
  created_at: string
  updated_at: string
}

export interface DbBillingNotification {
  id: string
  organization_id: string
  type: string
  title: string
  message: string | null
  payload: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export const upsertBillingInvoice = async (data: {
  organization_id: string
  stripe_invoice_id: string
  amount_due: number
  amount_paid?: number | null
  currency: string
  status: 'upcoming' | 'open' | 'paid' | 'failed'
  period_start?: Date | null
  period_end?: Date | null
  billing_reason?: string | null
  hosted_invoice_url?: string | null
}, client?: any): Promise<DbBillingInvoice> => {
  const runner = client || { query }
  const result = await runner.query(
    `INSERT INTO billing_invoices (
      organization_id, stripe_invoice_id, amount_due, amount_paid, currency,
      status, period_start, period_end, billing_reason, hosted_invoice_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (stripe_invoice_id) DO UPDATE SET
      amount_due = EXCLUDED.amount_due,
      amount_paid = COALESCE(EXCLUDED.amount_paid, billing_invoices.amount_paid),
      currency = EXCLUDED.currency,
      status = CASE WHEN billing_invoices.status = 'paid' THEN 'paid' ELSE EXCLUDED.status END,
      period_start = COALESCE(EXCLUDED.period_start, billing_invoices.period_start),
      period_end = COALESCE(EXCLUDED.period_end, billing_invoices.period_end),
      billing_reason = COALESCE(EXCLUDED.billing_reason, billing_invoices.billing_reason),
      hosted_invoice_url = COALESCE(EXCLUDED.hosted_invoice_url, billing_invoices.hosted_invoice_url),
      updated_at = NOW()
    RETURNING *`,
    [
      data.organization_id,
      data.stripe_invoice_id,
      data.amount_due,
      data.amount_paid ?? null,
      data.currency,
      data.status,
      data.period_start ?? null,
      data.period_end ?? null,
      data.billing_reason ?? null,
      data.hosted_invoice_url ?? null,
    ]
  )
  return result.rows[0]
}

export const getBillingInvoicesByOrganizationId = async (
  organizationId: string,
  options: { status?: string[]; limit?: number; offset?: number } = {}
): Promise<DbBillingInvoice[]> => {
  const { status: statuses, limit = 50, offset = 0 } = options
  let sql = 'SELECT * FROM billing_invoices WHERE organization_id = $1'
  const params: unknown[] = [organizationId]
  if (statuses && statuses.length > 0) {
    sql += ` AND status = ANY($${params.length + 1})`
    params.push(statuses)
  }
  sql += ' ORDER BY COALESCE(period_end, created_at) DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
  params.push(limit, offset)
  const result = await query(sql, params)
  return result.rows
}

export const getUpcomingInvoiceByOrganizationId = async (organizationId: string): Promise<DbBillingInvoice | null> => {
  const result = await query(
    `SELECT * FROM billing_invoices
     WHERE organization_id = $1 AND status = $2
     ORDER BY period_end DESC NULLS LAST
     LIMIT 1`,
    [organizationId, 'upcoming']
  )
  return result.rows[0] || null
}

/**
 * Returns the current open (unpaid) invoice for the organization, if any.
 * Used to show "Payment due" and Pay Now in the billing UI.
 */
export const getOpenInvoiceByOrganizationId = async (organizationId: string): Promise<DbBillingInvoice | null> => {
  const result = await query(
    `SELECT * FROM billing_invoices
     WHERE organization_id = $1 AND status = $2 AND amount_due > 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId, 'open']
  )
  return result.rows[0] || null
}

export const insertBillingNotification = async (data: {
  organization_id: string
  type: 'upcoming_invoice' | 'payment_success' | 'payment_failed'
  title: string
  message?: string | null
  payload?: Record<string, unknown> | null
}, client?: any): Promise<DbBillingNotification> => {
  const runner = client || { query }
  const result = await runner.query(
    `INSERT INTO billing_notifications (organization_id, type, title, message, payload)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.organization_id,
      data.type,
      data.title,
      data.message ?? null,
      data.payload ? JSON.stringify(data.payload) : null,
    ]
  )
  return result.rows[0]
}

export const getUnreadBillingNotificationsByOrganizationId = async (
  organizationId: string,
  limit = 20
): Promise<DbBillingNotification[]> => {
  const result = await query(
    `SELECT * FROM billing_notifications
     WHERE organization_id = $1 AND read_at IS NULL
     ORDER BY created_at DESC
     LIMIT $2`,
    [organizationId, limit]
  )
  return result.rows.map((row: Record<string, unknown> & { payload?: string | null }) => ({
    ...row,
    payload: row.payload != null ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : null,
  })) as DbBillingNotification[]
}

export const getBillingNotificationById = async (id: string): Promise<DbBillingNotification | null> => {
  const result = await query('SELECT * FROM billing_notifications WHERE id = $1', [id])
  const row = result.rows[0]
  if (!row) return null
  return {
    ...row,
    payload: row.payload != null ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : null,
  }
}

export const markBillingNotificationRead = async (notificationId: string, client?: any): Promise<void> => {
  const runner = client || { query }
  await runner.query('UPDATE billing_notifications SET read_at = NOW() WHERE id = $1', [notificationId])
}

export const hasUnpaidFailedInvoice = async (organizationId: string): Promise<boolean> => {
  const result = await query(
    `SELECT 1 FROM billing_invoices
     WHERE organization_id = $1 AND status = $2
     LIMIT 1`,
    [organizationId, 'failed']
  )
  return result.rows.length > 0
}

// ==================== USAGE TRACKING FOR BILLING ====================

/**
 * Gets used credits for the current billing period (single source: job_credit_events)
 */
export const getMonthlyUsedCredits = async (userId: string): Promise<number> => {
  const userResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
    [userId, 'approved']
  )
  if (userResult.rows.length === 0) return 0
  const organizationId = userResult.rows[0].organization_id
  const period = await getCurrentBillingPeriodForOrganization(organizationId)
  return getUsedCreditsInPeriod(organizationId, period.start)
}

/**
 * Gets plan credits for an organization (from subscription plan or free tier)
 */
export const getPlanCredits = async (organizationId: string): Promise<number> => {
  const { getJobCreditLimitByPlanId } = await import('@/lib/constants/job-credits')
  const subResult = await query(
    'SELECT plan_id FROM subscriptions WHERE organization_id = $1 AND status IN ($2, $3) LIMIT 1',
    [organizationId, 'active', 'past_due']
  )
  if (subResult.rows.length > 0 && subResult.rows[0].plan_id) {
    return getJobCreditLimitByPlanId(subResult.rows[0].plan_id)
  }
  const limitResult = await query(
    'SELECT job_credits_limit FROM organization_usage_limits WHERE organization_id = $1',
    [organizationId]
  )
  if (limitResult.rows.length > 0 && limitResult.rows[0].job_credits_limit !== null) {
    return parseInt(limitResult.rows[0].job_credits_limit)
  }
  return getJobCreditLimitByPlanId('free')
}

/**
 * Gets admin bonus credits for an organization
 */
export const getAdminBonusCredits = async (organizationId: string): Promise<number> => {
  const result = await query(
    'SELECT COALESCE(admin_bonus_credits, 0)::integer AS bonus FROM organizations WHERE id = $1',
    [organizationId]
  )
  return parseInt(result.rows[0]?.bonus) || 0
}

/**
 * Gets total available credits (plan + admin bonus) for an organization
 */
export const getTotalAvailableCredits = async (organizationId: string): Promise<number> => {
  const [planCredits, adminBonusCredits] = await Promise.all([
    getPlanCredits(organizationId),
    getAdminBonusCredits(organizationId)
  ])
  return planCredits + adminBonusCredits
}

/**
 * Gets remaining credits for an organization (total available - used in current period)
 */
export const getRemainingCredits = async (organizationId: string): Promise<number> => {
  const [totalAvailable, period] = await Promise.all([
    getTotalAvailableCredits(organizationId),
    getCurrentBillingPeriodForOrganization(organizationId)
  ])
  const usedCredits = await getUsedCreditsInPeriod(organizationId, period.start)
  return totalAvailable - usedCredits
}

/**
 * Gets organization job credit limit (paid = plan constant, free = organization_usage_limits)
 * @deprecated Use getTotalAvailableCredits instead for new logic
 */
export const getOrganizationJobCreditLimit = async (userId: string): Promise<number> => {
  const { getJobCreditLimitByPlanId } = await import('@/lib/constants/job-credits')
  const userResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
    [userId, 'approved']
  )
  if (userResult.rows.length === 0) return getJobCreditLimitByPlanId('free')
  const organizationId = userResult.rows[0].organization_id
  return await getPlanCredits(organizationId)
}

/**
 * Gets job credit limit for an organization (for billing status; paid = plan, free = usage_limits)
 * @deprecated Use getPlanCredits instead for new logic
 */
export const getOrganizationJobCreditLimitByOrg = async (organizationId: string): Promise<number> => {
  return await getPlanCredits(organizationId)
}

/**
 * Current billing period for an org (Stripe period for paid, calendar month for free)
 */
export const getCurrentBillingPeriodForOrganization = async (organizationId: string): Promise<{ start: Date; end: Date }> => {
  const subResult = await query(
    'SELECT current_period_end FROM subscriptions WHERE organization_id = $1 AND status IN ($2, $3) LIMIT 1',
    [organizationId, 'active', 'past_due']
  )
  if (subResult.rows.length > 0 && subResult.rows[0].current_period_end) {
    const endRaw = subResult.rows[0].current_period_end
    const end = endRaw instanceof Date ? endRaw : new Date(endRaw)
    const start = new Date(end)
    start.setMonth(start.getMonth() - 1)
    return { start, end }
  }
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

/**
 * Sum of credits consumed in a billing period (from job_credit_events)
 */
export const getUsedCreditsInPeriod = async (organizationId: string, billingPeriodStart: Date): Promise<number> => {
  const result = await query(
    `SELECT COALESCE(SUM(credits), 0)::integer AS total
     FROM job_credit_events
     WHERE organization_id = $1 AND billing_period_start = $2`,
    [organizationId, billingPeriodStart]
  )
  return parseInt(result.rows[0]?.total) || 0
}

/**
 * Insert one job credit event (idempotent by job_id + stripe_meter_event_identifier)
 */
export const insertJobCreditEvent = async (params: {
  organizationId: string
  userId: string
  jobId: string
  jobType: 'deep_research' | 'pre_lander' | 'static_ads' | 'templates_images'
  credits: number
  billingPeriodStart: Date
  subscriptionId?: string | null
  isOverage?: boolean
  stripeMeterEventIdentifier?: string
}): Promise<void> => {
  const identifier = params.stripeMeterEventIdentifier ?? 'job_credits_used'
  await query(
    `INSERT INTO job_credit_events (
       user_id, job_id, credits, organization_id, billing_period_start, job_type, is_overage, stripe_meter_event_identifier, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     ON CONFLICT (job_id, stripe_meter_event_identifier) DO NOTHING`,
    [
      params.userId,
      params.jobId,
      params.credits,
      params.organizationId,
      params.billingPeriodStart,
      params.jobType,
      params.isOverage ?? false,
      identifier,
    ]
  )
}

export const hasActiveSubscription = async (userId: string): Promise<boolean> => {
  // First get user's organization
  const userResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
    [userId, 'approved']
  )
  
  if (userResult.rows.length === 0) {
    return false // User not in any organization
  }
  
  const organizationId = userResult.rows[0].organization_id
  
  // Check for active subscription
  const subscriptionResult = await query(
    'SELECT * FROM subscriptions WHERE organization_id = $1 AND status IN ($2, $3) LIMIT 1',
    [organizationId, 'active', 'past_due']
  )
  
  return subscriptionResult.rows.length > 0
}

/**
 * Update admin bonus credits for an organization
 */
export const updateAdminBonusCredits = async (organizationId: string, bonusCredits: number): Promise<number> => {
  const result = await query(
    'UPDATE organizations SET admin_bonus_credits = $1 WHERE id = $2 RETURNING admin_bonus_credits',
    [bonusCredits, organizationId]
  )
  return parseInt(result.rows[0]?.admin_bonus_credits) || 0
}

/**
 * Gets Stripe customer ID for a user (if they have active subscription)
 */
export const getStripeCustomerId = async (userId: string): Promise<string | null> => {
  // First get user's organization
  const userResult = await query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
    [userId, 'approved']
  )
  
  if (userResult.rows.length === 0) {
    return null
  }
  
  const organizationId = userResult.rows[0].organization_id
  
  // Get customer info
  const customerResult = await query(
    'SELECT stripe_customer_id FROM customers WHERE organization_id = $1 LIMIT 1',
    [organizationId]
  )
  
  return customerResult.rows[0]?.stripe_customer_id || null
}

/**
 * Gets detailed job credit events for an organization with optional filtering
 */
export const getJobCreditEvents = async (
  organizationId: string, 
  filters: {
    limit?: number
    offset?: number
    jobType?: UsageType
    isOverage?: boolean
    startDate?: Date
    endDate?: Date
  } = {}
): Promise<JobCreditEvent[]> => {
  let sql = `
    SELECT jce.*, u.name as user_name, u.email as user_email, j.created_at as job_created_at
    FROM job_credit_events jce
    LEFT JOIN jobs j ON jce.job_id::text = j.id::text
    LEFT JOIN users u ON jce.user_id::text = u.id::text
    WHERE jce.organization_id = $1
  `
  const params: any[] = [organizationId]
  const conditions: string[] = []

  if (filters.jobType) {
    conditions.push('jce.job_type = $' + (params.length + 1))
    params.push(filters.jobType)
  }

  if (filters.isOverage !== undefined) {
    conditions.push('jce.is_overage = $' + (params.length + 1))
    params.push(filters.isOverage)
  }

  if (filters.startDate) {
    conditions.push('j.created_at >= $' + (params.length + 1))
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push('j.created_at <= $' + (params.length + 1))
    params.push(filters.endDate)
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY j.created_at DESC'

  if (filters.limit) {
    sql += ' LIMIT $' + (params.length + 1)
    params.push(filters.limit)
  }

  if (filters.offset) {
    sql += ' OFFSET $' + (params.length + 1)
    params.push(filters.offset)
  }

  const result = await query(sql, params)
  console.log('Raw job credit events query result:', result.rows)
  return result.rows
}

/**
 * Gets count of job credit events for pagination
 */
export const getJobCreditEventsCount = async (
  organizationId: string,
  filters: {
    jobType?: UsageType
    isOverage?: boolean
    startDate?: Date
    endDate?: Date
  } = {}
): Promise<number> => {
  let sql = `
    SELECT COUNT(*) as count 
    FROM job_credit_events jce
    LEFT JOIN jobs j ON jce.job_id::text = j.id::text
    WHERE jce.organization_id = $1
  `
  const params: any[] = [organizationId]
  const conditions: string[] = []

  if (filters.jobType) {
    conditions.push('jce.job_type = $' + (params.length + 1))
    params.push(filters.jobType)
  }

  if (filters.isOverage !== undefined) {
    conditions.push('jce.is_overage = $' + (params.length + 1))
    params.push(filters.isOverage)
  }

  if (filters.startDate) {
    conditions.push('j.created_at >= $' + (params.length + 1))
    params.push(filters.startDate)
  }

  if (filters.endDate) {
    conditions.push('j.created_at <= $' + (params.length + 1))
    params.push(filters.endDate)
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ')
  }

  const result = await query(sql, params)
  return parseInt(result.rows[0]?.count) || 0
}

// Editable Product Details queries
export const getEditableProductDetails = async (jobId: string): Promise<EditableProductDetails | null> => {
  const result = await query(
    'SELECT editable_product_details FROM jobs WHERE id = $1',
    [jobId]
  )
  const details = result.rows[0]?.editable_product_details
  return details || null
}

export const updateEditableProductDetails = async (jobId: string, productDetails: EditableProductDetails): Promise<boolean> => {
  const result = await query(
    'UPDATE jobs SET editable_product_details = $2, updated_at = NOW() WHERE id = $1',
    [jobId, JSON.stringify({ ...productDetails, updated_at: new Date().toISOString() })]
  )
  return (result.rowCount ?? 0) > 0
}

export const confirmEditableProductDetails = async (jobId: string): Promise<boolean> => {
  const result = await query(
    'UPDATE jobs SET editable_product_details = jsonb_set(editable_product_details, \'{is_confirmed}\', \'true\'), updated_at = NOW() WHERE id = $1',
    [jobId]
  )
  return (result.rowCount ?? 0) > 0
}

// Automatically populate editable_product_details from V2 API response
export const populateEditableProductDetailsFromV2 = async (jobId: string, v2Result: any): Promise<boolean> => {
  try {
    const offerBrief = v2Result?.results?.offer_brief;
    const product = offerBrief?.product;
    
    if (!product) {
      return false; // No product data in V2 response
    }

    const editableDetails: EditableProductDetails = {
      product_name: product.name,
      product_format: product.format,
      price: product.price,
      subscription_price: product.subscription_price,
      guarantee: product.guarantee,
      shipping: product.shipping,
      description: product.description,
      details: product.details,
      key_differentiator: product.key_differentiator,
      compliance_notes: product.compliance_notes,
      is_confirmed: false,
      updated_at: new Date().toISOString()
    };

    // Only update if editable_product_details is empty or null
    const result = await query(
      `UPDATE jobs 
       SET editable_product_details = CASE 
         WHEN editable_product_details IS NULL OR editable_product_details = '{}'::jsonb 
         THEN $2 
         ELSE editable_product_details 
       END, 
       updated_at = NOW() 
       WHERE id = $1 AND (editable_product_details IS NULL OR editable_product_details = '{}'::jsonb)`,
      [jobId, JSON.stringify(editableDetails)]
    );
    
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Error populating editable product details from V2:', error);
    return false;
  }
}

// Prompt version queries
export const getLatestPromptVersion = async (promptName: string) => {
  const result = await query(`
    SELECT pv.content, pv.placeholders, pv.version_number, p.name, p.category
    FROM prompt_versions pv
    JOIN prompts p ON p.id = pv.prompt_id
    WHERE p.name = $1
    ORDER BY pv.version_number DESC
    LIMIT 1
  `, [promptName])
  return result.rows[0]
}

export function extractPlaceholders(content: string): string[] {
  const regex = /\{([^}]+)\}/g
  const matches = content.matchAll(regex)
  const placeholders = Array.from(matches, m => m[1])
  return [...new Set(placeholders)]
}

export function validatePlaceholders(content: string, requiredParams: string[]): {
  valid: boolean
  found: string[]
  missing: string[]
  extra: string[]
} {
  const found = extractPlaceholders(content)
  const missing = requiredParams.filter(p => !found.includes(p))
  const extra = found.filter(p => !requiredParams.includes(p))
  return { valid: missing.length === 0 && extra.length === 0, found, missing, extra }
}

export const getAllPrompts = async (category?: string) => {
  let sql = `
    SELECT p.*, pv.version_number as latest_version_number
    FROM prompts p
    LEFT JOIN LATERAL (
      SELECT version_number
      FROM prompt_versions
      WHERE prompt_id = p.id
      ORDER BY version_number DESC
      LIMIT 1
    ) pv ON true
  `
  const params: string[] = []
  if (category) {
    sql += ' WHERE p.category = $1'
    params.push(category)
  }
  sql += ' ORDER BY p.category, p.name'
  const result = await query(sql, params)
  return result.rows
}

export const getPromptById = async (id: string) => {
  const result = await query('SELECT * FROM prompts WHERE id = $1', [id])
  return result.rows[0] || null
}

export const getPromptVersions = async (promptId: string) => {
  const result = await query(
    'SELECT * FROM prompt_versions WHERE prompt_id = $1 ORDER BY version_number DESC',
    [promptId]
  )
  return result.rows
}

export const createPromptVersion = async (
  promptId: string,
  content: string,
  createdBy: string,
  notes?: string
) => {
  return withTransaction(async (client) => {
    await client.query('SELECT id FROM prompts WHERE id = $1 FOR UPDATE', [promptId])

    const maxResult = await client.query(
      'SELECT COALESCE(MAX(version_number), 0) as max_version FROM prompt_versions WHERE prompt_id = $1',
      [promptId]
    )
    const nextVersion = parseInt(maxResult.rows[0].max_version, 10) + 1
    const placeholders = extractPlaceholders(content)

    const result = await client.query(
      `INSERT INTO prompt_versions (prompt_id, version_number, content, placeholders, created_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [promptId, nextVersion, content, JSON.stringify(placeholders), createdBy, notes || null]
    )

    await client.query('UPDATE prompts SET updated_at = NOW() WHERE id = $1', [promptId])

    return result.rows[0]
  })
}

// ==================== ACTIVITY LOG ====================

export interface ActivityLogItem {
  id: string
  user_id: string
  job_type: 'deep_research' | 'pre_lander_images' | 'template_images' | 'static_ads' | 'avatar_research'
  title?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  completed_at?: string
  request_body: Record<string, any>
  output?: Record<string, any>
  error_message?: string
  metadata?: Record<string, any>
}

export const getUserActivityLog = async (userId: string, limit = 100): Promise<ActivityLogItem[]> => {
  // Main jobs (deep research, marketing angles, avatar research)
  const mainJobsQuery = `
    SELECT 
      j.id,
      j.user_id,
      j.title,
      j.status,
      j.created_at,
      j.updated_at,
      j.completed_at,
      j.research_requirements,
      j.target_gender,
      j.target_location,
      j.form_advertorial_type,
      j.advertorial_type,
      j.target_approach,
      j.brand_info,
      j.sales_page_url,
      j.avatar_persona_name,
      j.parent_job_id,
      j.is_avatar_job,
      r.metadata as result_metadata,
      CASE 
        WHEN j.parent_job_id IS NOT NULL THEN 'avatar_research'
        WHEN j.target_approach = 'v2' THEN 'deep_research'
        ELSE 'static_ads'
      END as job_type
    FROM jobs j
    LEFT JOIN results r ON j.id = r.job_id
    WHERE j.user_id = $1
  `

  // Image generation jobs
  const imageJobsQuery = `
    SELECT 
      ig.id,
      ig.user_id,
      NULL as title,
      ig.status,
      ig.created_at,
      ig.updated_at,
      ig.completed_at,
      ig.prompts as request_data,
      ig.result_images,
      ig.error_message,
      ig.injected_template_id,
      'pre_lander_images' as job_type
    FROM image_generation_jobs ig
    WHERE ig.user_id = $1
  `

  // Execute both queries
  const [mainJobsResult, imageJobsResult] = await Promise.all([
    query(mainJobsQuery, [userId]),
    query(imageJobsQuery, [userId])
  ])

  // Transform main jobs
  const mainJobs = mainJobsResult.rows.map(row => {
    const requestBody: Record<string, any> = {
      title: row.title,
      brand_info: row.brand_info,
      sales_page_url: row.sales_page_url
    }

    // Add V2 form fields if present
    if (row.research_requirements) requestBody.research_requirements = row.research_requirements
    if (row.target_gender) requestBody.target_gender = row.target_gender
    if (row.target_location) requestBody.target_location = row.target_location
    if (row.form_advertorial_type) requestBody.form_advertorial_type = row.form_advertorial_type
    if (row.advertorial_type) requestBody.advertorial_type = row.advertorial_type
    if (row.target_approach) requestBody.target_approach = row.target_approach
    if (row.avatar_persona_name) requestBody.avatar_persona_name = row.avatar_persona_name

    return {
      id: row.id,
      user_id: row.user_id,
      job_type: row.job_type,
      title: row.title,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
      request_body: requestBody,
      output: row.result_metadata ? {
        full_result: row.result_metadata.full_result,
        project_name: row.result_metadata.project_name,
        generated_at: row.result_metadata.generated_at
      } : undefined,
      metadata: {
        parent_job_id: row.parent_job_id,
        is_avatar_job: row.is_avatar_job,
        avatar_persona_name: row.avatar_persona_name
      }
    }
  })

  // Transform image generation jobs
  const imageJobs = imageJobsResult.rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    job_type: 'pre_lander_images' as const,
    title: `Image Generation (${row.injected_template_id})`,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    request_body: row.request_data || {},
    output: row.result_images || undefined,
    error_message: row.error_message,
    metadata: {
      injected_template_id: row.injected_template_id
    }
  }))

  // Combine and sort by created_at desc
  const allActivities = [...mainJobs, ...imageJobs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)

  return allActivities
}
