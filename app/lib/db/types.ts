export interface User {
  id: string
  email: string
  name: string
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
  title: string
  brand_info: string
  sales_page_url?: string
  template_id?: string
  advertorial_type: string
  target_approach?: string
  customer_avatars?: any[]
  // Deprecated fields for backward compatibility
  persona?: string
  age_range?: string
  gender?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  execution_id?: string
  progress: number
  created_at: string
  updated_at: string
  completed_at?: string
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
