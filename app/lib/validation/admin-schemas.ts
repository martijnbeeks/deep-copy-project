import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
})

export const createTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  category: z.enum(['advertorial', 'listicle', 'review', 'other']).optional(),
  htmlContent: z.string().min(1, 'HTML content is required'),
})

export const createInjectableTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Template name is required'),
  type: z.enum(['listicle', 'advertorial']),
  description: z.string().optional(),
  htmlContent: z.string().min(1, 'HTML content is required'),
})

export const createInviteLinkSchema = z.object({
  waitlist_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  expiration_days: z.string().optional(),
  expiration_hours: z.string().optional(),
}).refine(
  (data) => {
    // At least one expiration field should be provided, or default to 7 days
    return true // Always valid, defaults to 7 days if both are empty
  },
  {
    message: 'Either expiration days or hours must be provided',
  }
)

export type CreateUserInput = z.infer<typeof createUserSchema>
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type CreateInjectableTemplateInput = z.infer<typeof createInjectableTemplateSchema>
export type CreateInviteLinkInput = z.infer<typeof createInviteLinkSchema>

