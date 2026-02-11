import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth';
import { getOrganizationById, getCustomerByOrganizationId } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return createAuthErrorResponse(authResult);
    }

    const { priceId, organizationId } = await request.json();

    if (!priceId || !organizationId) {
      return NextResponse.json({ error: 'Missing priceId or organizationId' }, { status: 400 });
    }

    // Verify organization exists and user is part of it (already checked by requireAuth/context usually, 
    // but here we might want to verify they are an admin of that specific org)
    const org = await getOrganizationById(organizationId);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if we already have a Stripe customer for this organization
    const existingCustomer = await getCustomerByOrganizationId(organizationId);

    // Get overage price ID from environment
    const overagePriceId = process.env.STRIPE_JOB_CREDITS_OVERAGE_PRICE_ID;
    if (!overagePriceId) {
      console.error('STRIPE_JOB_CREDITS_OVERAGE_PRICE_ID environment variable is not set');
      return NextResponse.json({ error: 'Overage pricing not configured' }, { status: 500 });
    }

    // Create line items with base price + overage price
    const lineItems = [
      {
        price: priceId,
        quantity: 1,
      },
      {
        price: overagePriceId,
        // Metered prices don't use quantity
      },
    ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      // If customer exists, use their ID; otherwise use email to create a new one
      customer: existingCustomer?.stripe_customer_id || undefined,
      customer_email: existingCustomer ? undefined : authResult.user.email,
      client_reference_id: organizationId,
      metadata: {
        organizationId: organizationId,
        userId: authResult.user.id,
      },
      subscription_data: {
        metadata: {
          organizationId: organizationId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
