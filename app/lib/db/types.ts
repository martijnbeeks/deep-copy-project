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

export type UsageType = 'deep_research' | 'pre_lander' | 'static_ads' | 'templates_images'

export interface OrganizationUsageLimits {
  organization_id: string
  deep_research_limit: number
  pre_lander_limit: number
  static_ads_limit: number
  templates_images_limit: number
  job_credits_limit?: number | null
  created_at: string
  updated_at: string
}

export interface OrganizationUsageTracking {
  id: string
  organization_id: string
  usage_type: UsageType
  week_start_date: string
  count: number
  created_at: string
  updated_at: string
}

export interface JobCreditEvent {
  id: string
  user_id: string
  job_id: string
  credits: number
  organization_id?: string | null
  billing_period_start?: string | null
  job_type?: UsageType | null
  is_overage: boolean
  stripe_meter_event_identifier?: string | null
  status: 'pending' | 'processed' | 'failed'
  created_at: string
  updated_at?: string | null
  // Joined fields from queries
  job_title?: string | null
  user_name?: string | null
  user_email?: string | null
  job_created_at?: string | null
}