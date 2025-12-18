import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'
import { handleApiError, createSuccessResponse, createValidationErrorResponse } from '@/lib/middleware/error-handler'
import { isValidEmail, isValidUrl } from '@/lib/utils/validation'
import { logger } from '@/lib/utils/logger'

// Create waitlist table if it doesn't exist
async function ensureWaitlistTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS waitlist (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Add company column if it doesn't exist (for existing tables)
    try {
      await query(`
        ALTER TABLE waitlist 
        ADD COLUMN IF NOT EXISTS company VARCHAR(255)
      `)
    } catch (error) {
      // Column might already exist, ignore error
    }

    // Add new columns for multi-step form
    const newColumns = [
      { name: 'company_website', type: 'VARCHAR(255)' },
      { name: 'platforms', type: 'TEXT[]' },
      { name: 'shopify_app_name', type: 'VARCHAR(255)' },
      { name: 'platform_other', type: 'VARCHAR(255)' },
      { name: 'monthly_volume', type: 'VARCHAR(50)' },
      { name: 'interest_reasons', type: 'TEXT[]' },
      { name: 'interest_other', type: 'VARCHAR(255)' },
    ]

    for (const column of newColumns) {
      try {
        await query(`
          ALTER TABLE waitlist 
          ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}
        `)
      } catch (error) {
        // Column might already exist, ignore error
      }
    }

    // Update name column to be NOT NULL if it's nullable (for existing tables)
    try {
      await query(`
        ALTER TABLE waitlist 
        ALTER COLUMN name SET NOT NULL
      `)
    } catch (error) {
      // Might fail if already NOT NULL or if column doesn't exist yet, ignore
    }
  } catch (error) {
    // Table might already exist, ignore error
    logger.log('Waitlist table check:', error)
  }
}

// POST - Add email to waitlist
export async function POST(request: NextRequest) {
  try {
    // Ensure table exists
    await ensureWaitlistTable()

    const {
      email,
      name,
      company,
      company_website,
      platforms,
      shopify_app_name,
      platform_other,
      monthly_volume,
      interest_reasons,
      interest_other
    } = await request.json()

    // Validate required fields
    if (!email) {
      return createValidationErrorResponse('Email is required')
    }

    if (!name || !name.trim()) {
      return createValidationErrorResponse('Name is required')
    }

    if (!company_website || !company_website.trim()) {
      return createValidationErrorResponse('Company website is required')
    }

    if (!monthly_volume) {
      return createValidationErrorResponse('Monthly pre-lander volume is required')
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return createValidationErrorResponse('Invalid email format')
    }

    // Validate URL format
    if (!isValidUrl(company_website)) {
      return createValidationErrorResponse('Invalid company website URL format')
    }

    // Validate monthly_volume value
    const validVolumes = ['below-10', '10-50', '50-plus']
    if (!validVolumes.includes(monthly_volume)) {
      return createValidationErrorResponse('Invalid monthly volume selection')
    }

    // Validate platforms array
    const validPlatforms = ['funnelish', 'checkoutchamp', 'shopify', 'none', 'other']
    if (platforms && Array.isArray(platforms)) {
      const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p))
      if (invalidPlatforms.length > 0) {
        return createValidationErrorResponse('Invalid platform selection')
      }

      // Validate conditional fields
      if (platforms.includes('shopify') && (!shopify_app_name || !shopify_app_name.trim())) {
        return createValidationErrorResponse('Shopify app name is required when Shopify is selected')
      }

      if (platforms.includes('other') && (!platform_other || !platform_other.trim())) {
        return createValidationErrorResponse('Platform other name is required when Other is selected')
      }
    } else if (!platforms || platforms.length === 0) {
      return createValidationErrorResponse('At least one platform option must be selected')
    }

    // Validate interest_reasons array
    const validReasons = ['autopilot', 'customer-insights', 'team-efficiency', 'other']
    if (interest_reasons && Array.isArray(interest_reasons)) {
      const invalidReasons = interest_reasons.filter(r => !validReasons.includes(r))
      if (invalidReasons.length > 0) {
        return createValidationErrorResponse('Invalid interest reason selection')
      }

      // Validate conditional field
      if (interest_reasons.includes('other') && (!interest_other || !interest_other.trim())) {
        return createValidationErrorResponse('Interest other reason is required when Other is selected')
      }
    } else if (!interest_reasons || interest_reasons.length === 0) {
      return createValidationErrorResponse('At least one interest reason must be selected')
    }

    // Check if email already exists
    const existing = await query(
      'SELECT id FROM waitlist WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    if (existing.rows.length > 0) {
      return createValidationErrorResponse(
        'This email is already on the waitlist',
        409
      )
    }

    // Insert into waitlist
    const result = await query(
      `INSERT INTO waitlist (
        email, name, company, company_website, platforms, 
        shopify_app_name, platform_other, monthly_volume, 
        interest_reasons, interest_other
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING id, email, name, company, company_website, platforms, 
                 shopify_app_name, platform_other, monthly_volume, 
                 interest_reasons, interest_other, created_at`,
      [
        email.toLowerCase().trim(),
        name.trim(),
        company?.trim() || null,
        company_website.trim(),
        platforms || [],
        shopify_app_name?.trim() || null,
        platform_other?.trim() || null,
        monthly_volume,
        interest_reasons || [],
        interest_other?.trim() || null
      ]
    )

    return createSuccessResponse({
      success: true,
      message: 'Successfully added to waitlist',
      waitlist: result.rows[0]
    })
  } catch (error) {
    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return createValidationErrorResponse(
        'This email is already on the waitlist',
        409
      )
    }
    return handleApiError(error)
  }
}

// GET - Get waitlist entries (optional, for admin use)
export async function GET(request: NextRequest) {
  try {
    await ensureWaitlistTable()

    const result = await query(
      `SELECT id, email, name, company, company_website, platforms, 
              shopify_app_name, platform_other, monthly_volume, 
              interest_reasons, interest_other, created_at, updated_at
       FROM waitlist ORDER BY created_at DESC`
    )

    return createSuccessResponse({
      waitlist: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    return handleApiError(error)
  }
}

