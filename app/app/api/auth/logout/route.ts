import { NextResponse } from 'next/server'

export async function POST() {
  // In a real app, you might want to invalidate tokens here
  return NextResponse.json({ message: 'Logged out successfully' })
}
