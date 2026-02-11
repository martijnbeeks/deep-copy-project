import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth';
import { getBillingNotificationById, markBillingNotificationRead } from '@/lib/db/queries';
import { query } from '@/lib/db/connection';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return createAuthErrorResponse(authResult);
    }

    const { id: notificationId } = await params;
    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notification id' }, { status: 400 });
    }

    const notification = await getBillingNotificationById(notificationId);
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const userOrgResult = await query(
      'SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = $2 LIMIT 1',
      [authResult.user.id, 'approved']
    );
    const userOrganizationId = userOrgResult.rows[0]?.organization_id;
    if (userOrganizationId !== notification.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await markBillingNotificationRead(notificationId);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error marking notification read:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
