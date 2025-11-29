import { NextRequest, NextResponse } from 'next/server'
import { getInviteLinkByToken } from '@/lib/db/queries'

// GET - Validate and get invite link details
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const inviteLink = await getInviteLinkByToken(token)

    if (!inviteLink) {
      return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
    }

    // Check if already used
    if (inviteLink.used_at) {
      return NextResponse.json({ error: 'This invite link has already been used' }, { status: 400 })
    }

    // Check if expired
    const now = new Date()
    const expiresAt = new Date(inviteLink.expires_at)
    if (now > expiresAt) {
      return NextResponse.json({ error: 'This invite link has expired' }, { status: 400 })
    }

    return NextResponse.json({
      invite_link: {
        id: inviteLink.id,
        invite_type: inviteLink.invite_type,
        waitlist_email: inviteLink.waitlist_email,
        expires_at: inviteLink.expires_at
      }
    })
  } catch (error) {
    console.error('Error validating invite link:', error)
    return NextResponse.json({ error: 'Failed to validate invite link' }, { status: 500 })
  }
}

