import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/connection'

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
    console.log('Waitlist table check:', error)
  }
}

// POST - Add email to waitlist
export async function POST(request: NextRequest) {
  try {
    // Ensure table exists
    await ensureWaitlistTable()

    const { email, name, company } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await query(
      'SELECT id FROM waitlist WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { 
          error: 'This email is already on the waitlist',
          message: 'You\'re already on our waitlist! We\'ll notify you when we launch.'
        },
        { status: 409 }
      )
    }

    // Insert into waitlist
    const result = await query(
      `INSERT INTO waitlist (email, name, company) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, name, company, created_at`,
      [email.toLowerCase().trim(), name.trim(), company?.trim() || null]
    )

    return NextResponse.json({
      success: true,
      message: 'Successfully added to waitlist',
      waitlist: result.rows[0]
    })
  } catch (error) {
    console.error('Error adding to waitlist:', error)
    
    // Check if it's a unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json(
        { 
          error: 'This email is already on the waitlist',
          message: 'You\'re already on our waitlist! We\'ll notify you when we launch.'
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to add to waitlist. Please try again.' },
      { status: 500 }
    )
  }
}

// GET - Get waitlist entries (optional, for admin use)
export async function GET(request: NextRequest) {
  try {
    await ensureWaitlistTable()

    const result = await query(
      'SELECT id, email, name, company, created_at FROM waitlist ORDER BY created_at DESC'
    )

    return NextResponse.json({
      waitlist: result.rows,
      count: result.rows.length
    })
  } catch (error) {
    console.error('Error fetching waitlist:', error)
    return NextResponse.json(
      { error: 'Failed to fetch waitlist' },
      { status: 500 }
    )
  }
}

