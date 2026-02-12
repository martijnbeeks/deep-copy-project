export interface UserOrganization {
  id: string
  name: string
  role: string
  status: string
}

export interface User {
  id: string
  email: string
  name: string
  created_at: string
  organizations: UserOrganization[] | string
}

export interface Job {
  id: string
  title: string
  status: string
  created_at: string
  user_email: string
  template_name: string | null
  template_id: string | null
}

export interface InjectableTemplate {
  id: string
  name: string
  type: 'listicle' | 'advertorial'
  html_content: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  name: string
  description: string | null
  category: string | null
  created_at: string
  content_length: number
  html_content: string
}

export interface DatabaseStats {
  users: number
  templates: number
  jobs: number
  results: number
}

export interface InviteLink {
  id: string
  token: string
  invite_type: string
  waitlist_email?: string | null
  expires_at: string
  used_at?: string | null
  created_at: string
}

export interface JobStatus {
  status: string
  count: string
}

export interface Prompt {
  id: string
  name: string
  description: string | null
  category: 'process_job_v2' | 'write_swipe' | 'image_gen_process'
  function_name: string
  required_params: string[]
  created_at: string
  updated_at: string
}

export interface PromptVersion {
  id: string
  prompt_id: string
  version_number: number
  content: string
  placeholders: string[]
  created_by: string
  created_at: string
  notes: string | null
}

export interface PromptWithVersions extends Prompt {
  versions: PromptVersion[]
  latest_version: PromptVersion | null
}
