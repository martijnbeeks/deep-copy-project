import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createAuthErrorResponse } from '@/lib/auth/user-auth';
import {
  getSubscriptionByOrganizationId,
  getCurrentBillingPeriodForOrganization,
  getUsedCreditsInPeriod,
  getPlanCredits,
  getAdminBonusCredits,
  getBillingInvoicesByOrganizationId,
  getOpenInvoiceByOrganizationId,
  hasUnpaidFailedInvoice,
  getUnreadBillingNotificationsByOrganizationId,
} from '@/lib/db/queries';
import { stripe } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) {
      return createAuthErrorResponse(authResult);
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }

    const period = await getCurrentBillingPeriodForOrganization(organizationId);
    const [
      subscription,
      currentUsage,
      planCredits,
      adminBonusCredits,
      openInvoice,
      invoiceHistory,
      paymentFailed,
      billingNotifications,
    ] = await Promise.all([
      getSubscriptionByOrganizationId(organizationId),
      getUsedCreditsInPeriod(organizationId, period.start),
      getPlanCredits(organizationId),
      getAdminBonusCredits(organizationId),
      getOpenInvoiceByOrganizationId(organizationId),
      getBillingInvoicesByOrganizationId(organizationId, { status: ['paid', 'open', 'failed'], limit: 20 }),
      hasUnpaidFailedInvoice(organizationId),
      getUnreadBillingNotificationsByOrganizationId(organizationId, 20),
    ]);

    const creditLimit = planCredits + adminBonusCredits;

    // Upcoming invoice: fetch live from Stripe when we have a subscription (no DB row for previews)
    let upcomingInvoice: { id: string; stripeInvoiceId: string | null; amountDue: number; currency: string; periodEnd: string | null } | null = null;
    if (subscription?.stripe_subscription_id) {
      try {
        // retrieveUpcoming exists at runtime; Stripe TS types for this API version may omit it
        const upcoming = await (stripe.invoices as any).retrieveUpcoming({
          subscription: subscription.stripe_subscription_id,
        });
        const lineItem = upcoming.lines?.data?.[0];
        const periodEnd = lineItem?.period?.end;
        upcomingInvoice = {
          id: upcoming.id ?? `upcoming_${subscription.stripe_subscription_id}`,
          stripeInvoiceId: upcoming.id ?? null,
          amountDue: upcoming.amount_due ?? 0,
          currency: (upcoming.currency ?? 'eur').toLowerCase(),
          periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        };
      } catch {
        // No upcoming invoice (e.g. canceled or no renewal)
      }
    }

    // If we have an open invoice but no hosted URL in DB, fetch from Stripe (URL appears after finalization)
    let openInvoiceHostedUrl: string | null = openInvoice?.hosted_invoice_url ?? null;
    if (openInvoice && !openInvoiceHostedUrl && openInvoice.stripe_invoice_id) {
      try {
        const stripeInvoice = await stripe.invoices.retrieve(openInvoice.stripe_invoice_id);
        openInvoiceHostedUrl = stripeInvoice.hosted_invoice_url ?? null;
      } catch {
        // Keep null if fetch fails
      }
    }

    // For invoice history: backfill hosted_invoice_url and amount from Stripe when DB has null/0 (e.g. row from invoice.created before finalized)
    const historyNeedingFetch = invoiceHistory.filter(
      (inv) => inv.stripe_invoice_id && (!inv.hosted_invoice_url || inv.amount_due === 0)
    );
    const stripeFetchByInvId: Record<string, { hosted_invoice_url: string | null; amount_due: number; amount_paid: number | null }> = {};
    if (historyNeedingFetch.length > 0) {
      await Promise.all(
        historyNeedingFetch.map(async (inv) => {
          try {
            const stripeInv = await stripe.invoices.retrieve(inv.stripe_invoice_id);
            stripeFetchByInvId[inv.id] = {
              hosted_invoice_url: stripeInv.hosted_invoice_url ?? null,
              amount_due: stripeInv.amount_due ?? inv.amount_due,
              amount_paid: stripeInv.amount_paid ?? inv.amount_paid,
            };
          } catch {
            stripeFetchByInvId[inv.id] = {
              hosted_invoice_url: inv.hosted_invoice_url,
              amount_due: inv.amount_due,
              amount_paid: inv.amount_paid,
            };
          }
        })
      );
    }
    const enrichedHistory = invoiceHistory.map((inv) => {
      const fromStripe = stripeFetchByInvId[inv.id];
      if (!fromStripe) return inv;
      return {
        ...inv,
        hosted_invoice_url: fromStripe.hosted_invoice_url ?? inv.hosted_invoice_url,
        amount_due: fromStripe.amount_due,
        amount_paid: fromStripe.amount_paid ?? inv.amount_paid,
      };
    });

    return NextResponse.json({
      planId: subscription?.plan_id || 'free',
      status: (subscription?.status as string) || 'none',
      currentPeriodEnd: subscription?.current_period_end || null,
      currentUsage,
      creditLimit,
      planCredits,
      adminBonusCredits,
      billingCycle: 'monthly',
      projectedOverage: 0,
      upcomingInvoice,
      openInvoice: openInvoice && openInvoice.amount_due > 0
        ? {
            id: openInvoice.id,
            stripeInvoiceId: openInvoice.stripe_invoice_id,
            amountDue: openInvoice.amount_due,
            currency: openInvoice.currency,
            periodEnd: openInvoice.period_end,
            hostedInvoiceUrl: openInvoiceHostedUrl,
          }
        : null,
      invoiceHistory: enrichedHistory.map((inv) => ({
        id: inv.id,
        stripeInvoiceId: inv.stripe_invoice_id,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        status: inv.status,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        hostedInvoiceUrl: inv.hosted_invoice_url,
      })),
      paymentFailed: !!paymentFailed,
      billingNotifications: billingNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        payload: n.payload,
        createdAt: n.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching billing status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
