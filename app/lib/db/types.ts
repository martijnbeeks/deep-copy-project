export interface User {
  id: string
  email: string
  name: string
  username?: string | null
  password_hash: string
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  name: string
  description?: string
  html_content: string
  category?: string
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  user_id: string
  organization_id?: string | null
  title: string
  brand_info: string
  sales_page_url?: string
  template_id?: string
  advertorial_type: string
  target_approach?: string
  avatars?: any[]  // Single source of truth - all avatars with is_researched flag
  status: 'pending' | 'processing' | 'completed' | 'failed'
  execution_id?: string
  progress: number
  created_at: string
  updated_at: string
  completed_at?: string
  // Avatar job fields
  parent_job_id?: string
  avatar_persona_name?: string
  is_avatar_job?: boolean
  screenshot?: string // Base64 screenshot of sales_page_url
}

export interface Result {
  id: string
  job_id: string
  html_content: string
  metadata?: Record<string, any>
  created_at: string
}

export interface JobWithTemplate extends Job {
  template?: Template
}

export interface JobWithResult extends Job {
  result?: Result
  template?: Template
}

export interface InjectableTemplate {
  id: string
  name: string
  advertorial_type: 'listicle' | 'advertorial'
  html_content: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type UserRole = 'admin' | 'normal_user'
export type MemberStatus = 'pending' | 'approved'
export type InviteType = 'organization_creator' | 'staff_member'

export interface InviteLink {
  id: string
  token: string
  created_by: string
  invite_type: InviteType
  waitlist_email?: string | null
  organization_id?: string | null
  expires_at: string
  used_at?: string | null
  used_by?: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: UserRole
  status: MemberStatus
  invited_by?: string | null
  created_at: string
  updated_at: string
}