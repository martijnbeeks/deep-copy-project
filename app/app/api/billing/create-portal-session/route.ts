import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth';
import { getSubscriptionByOrganizationId } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return createAuthErrorResponse(authResult);
    }

    const { organizationId, updatePaymentMethod } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const subscription = await getSubscriptionByOrganizationId(organizationId);

    if (!subscription || !subscription.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription found for this organization' }, { status: 404 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
      ...(updatePaymentMethod && {
        flow_data: { type: 'payment_method_update' },
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
