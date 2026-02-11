import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { 
  updateSubscription, 
  logWebhookEvent, 
  updateWebhookLogStatus, 
  upsertCustomer,
  getSubscriptionByStripeIdForUpdate,
  getSubscriptionByStripeId,
  upsertBillingInvoice,
  insertBillingNotification,
  getOrganizationIdByStripeCustomerId,
} from '@/lib/db/queries';
import { getPlanIdByPriceId } from '@/lib/constants/billing';
import { withTransaction } from '@/lib/db/connection';
import { logger } from '@/lib/logger';
import { logContextStorage } from '@/lib/logger/context';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  // Generate or extract request ID (duplicate of withLogger logic for standard export)
  const requestId = request.headers.get('x-request-id') || uuidv4();
  
  return logContextStorage.run({ requestId }, async () => {
    logger.info(`Incoming request: ${request.method} ${request.url}`);

    const body = await request.text();
    const signature = request.headers.get('stripe-signature') as string;

    logger.info('Verifying webhook signature...');
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
      
      // Extract metadata early for logging context
      const obj = event.data.object as any;
      const organizationId = obj.metadata?.organizationId || obj.client_reference_id || obj.subscription_details?.metadata?.organizationId;
      const userId = obj.metadata?.userId || obj.subscription_details?.metadata?.userId;

      if (!organizationId) {
        const isInvoiceEvent = event.type.startsWith('invoice.');
        if (isInvoiceEvent) {
          logger.warn('OrganizationId not in event metadata; will resolve from customer/subscription in handler.', {
            eventId: event.id,
            eventType: event.type
          });
        } else {
          logger.error('CRITICAL: OrganizationId not found in Stripe event! This will block database updates.', {
            eventId: event.id,
            eventType: event.type
          });
        }
      }

      // Update the log context dynamically
      const activeContext = logContextStorage.getStore();
      if (activeContext) {
        activeContext.organizationId = organizationId;
        activeContext.userId = userId;
        activeContext.eventId = event.id;
        activeContext.eventType = event.type;
      }

      logger.info('Stripe event verified successfully');
    } catch (error: any) {
      logger.error(`Webhook signature verification failed: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    try {
      logger.info('Logging event for idempotency and audit...');
      await logWebhookEvent({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event,
      });
      logger.info('Event logged successfully');
    } catch (error: any) {
      if (error.code === '23505') {
        logger.info('Webhook event already processed. Skipping.', { eventId: event.id });
        return NextResponse.json({ received: true });
      }
      logger.error('Failed to log webhook event', { error: error.message });
      throw error;
    }

    const eventCreated = event.created;

    try {
      logger.info('Starting database transaction for event processing...');
      await withTransaction(async (client) => {
        const checkOrderingAndLock = async (stripeSubscriptionId: string) => {
          logger.info('Checking event ordering and acquiring row lock...', { 
            subscriptionId: stripeSubscriptionId, 
            eventTimestamp: eventCreated 
          });
          const existingSub = await getSubscriptionByStripeIdForUpdate(stripeSubscriptionId, client);
          if (existingSub && eventCreated < existingSub.last_event_created_at) {
            logger.info('Ignoring stale event', { 
              eventType: event.type, 
              subscriptionId: stripeSubscriptionId, 
              currentCreated: eventCreated, 
              lastCreated: existingSub.last_event_created_at 
            });
            return { stale: true, existingSub };
          }
          return { stale: false, existingSub };
        };

        const getOrganizationIdFromInvoice = async (invoice: any): Promise<string | null> => {
          const fromMeta = invoice.subscription_details?.metadata?.organizationId || invoice.metadata?.organizationId;
          if (fromMeta) return fromMeta;
          if (invoice.customer) {
            const fromCustomer = await getOrganizationIdByStripeCustomerId(invoice.customer as string);
            if (fromCustomer) return fromCustomer;
          }
          if (invoice.subscription) {
            const sub = await getSubscriptionByStripeId(invoice.subscription as string);
            if (sub?.organization_id) return sub.organization_id;
            // First subscription / clock: subscription row may not exist yet; resolve from Stripe
            try {
              const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string) as { metadata?: { organizationId?: string } };
              if (stripeSub?.metadata?.organizationId) return stripeSub.metadata.organizationId;
            } catch {
              // ignore
            }
          }
          return null;
        };

        const getInvoicePeriod = (invoice: any) => {
          const lineItem = invoice.lines?.data?.[0];
          const periodStart = lineItem?.period?.start ? new Date((lineItem.period.start as number) * 1000) : null;
          const periodEnd = lineItem?.period?.end ? new Date((lineItem.period.end as number) * 1000) : null;
          return { periodStart, periodEnd };
        };

        const mapInvoiceStatusToDb = (stripeStatus: string): 'open' | 'paid' | 'failed' => {
          if (stripeStatus === 'paid') return 'paid';
          if (stripeStatus === 'uncollectible' || stripeStatus === 'void') return 'failed';
          return 'open'; // draft, open → open (so Payment due can show)
        };

        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as any;
            const organizationId = session.client_reference_id;
            const stripeSubscriptionId = session.subscription;
            const stripeCustomerId = session.customer;
            const customerEmail = session.customer_details?.email || session.customer_email;

            logger.info('Processing checkout.session.completed', {
              organizationId,
              stripeSubscriptionId,
              stripeCustomerId,
              customerEmail
            });

            if (organizationId && stripeCustomerId) {
              await upsertCustomer({
                organization_id: organizationId,
                stripe_customer_id: stripeCustomerId,
                email: customerEmail,
              }, client);
              logger.info('Customer mapping updated');

              if (stripeSubscriptionId) {
                const { stale } = await checkOrderingAndLock(stripeSubscriptionId);
                if (stale) break;

                const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any;
                const priceId = subscription.items.data[0].price.id;
                const periodEnd = subscription.current_period_end;
                const planId = getPlanIdByPriceId(priceId);

                logger.info('Retrieved subscription details for update', { planId, status: subscription.status });

                await updateSubscription({
                  organization_id: organizationId,
                  stripe_subscription_id: stripeSubscriptionId,
                  stripe_customer_id: stripeCustomerId,
                  plan_id: planId,
                  status: subscription.status,
                  current_period_end: new Date(periodEnd ? periodEnd * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000),
                  last_event_created_at: eventCreated,
                }, client);
                logger.info('Subscription initialized successfully');
              }
            }
            break;
          }

          case 'customer.subscription.created':
          case 'customer.subscription.updated': {
            const subscription = event.data.object as any;
            const { stale } = await checkOrderingAndLock(subscription.id);
            if (stale) break;

            const organizationId = subscription.metadata?.organizationId;
            const priceId = subscription.items.data[0].price.id;
            const planId = getPlanIdByPriceId(priceId);

            logger.info(`Processing ${event.type}`, {
              subscriptionId: subscription.id,
              organizationId,
              planId,
              status: subscription.status
            });
            
            if (organizationId) {
              await upsertCustomer({
                organization_id: organizationId,
                stripe_customer_id: subscription.customer,
                email: '', 
              }, client);
            }

            let periodEnd = subscription.current_period_end;
            if (!periodEnd) {
              const fullSub = await stripe.subscriptions.retrieve(subscription.id) as any;
              periodEnd = fullSub.current_period_end;
            }

            await updateSubscription({
              organization_id: organizationId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: subscription.customer,
              plan_id: planId,
              status: subscription.status,
              current_period_end: new Date(periodEnd ? periodEnd * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000),
              last_event_created_at: eventCreated,
            }, client);
            logger.info('Subscription updated successfully');
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as any;
            const { stale } = await checkOrderingAndLock(subscription.id);
            if (stale) break;

            const organizationId = subscription.metadata?.organizationId;
            logger.info('Processing customer.subscription.deleted', { subscriptionId: subscription.id, organizationId });

            await updateSubscription({
              organization_id: organizationId,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: subscription.customer,
              plan_id: 'free',
              status: 'canceled',
              current_period_end: new Date(),
              last_event_created_at: eventCreated,
            }, client);
            logger.info('Subscription canceled successfully');
            break;
          }

          case 'invoice.upcoming': {
            // Preview only — often no invoice.id; do not write to billing_invoices.
            const invoice = event.data.object as any;
            const organizationId = await getOrganizationIdFromInvoice(invoice);
            if (!organizationId) {
              logger.warn('invoice.upcoming: could not resolve organizationId', { invoiceId: invoice.id });
            } else {
              const { periodEnd } = getInvoicePeriod(invoice);
              const amountDue = invoice.amount_due ?? 0;
              const currency = (invoice.currency ?? 'eur').toLowerCase();
              const amountFormatted = (amountDue / 100).toFixed(2);
              await insertBillingNotification({
                organization_id: organizationId,
                type: 'upcoming_invoice',
                title: 'Upcoming charge',
                message: `Your next invoice of €${amountFormatted} (${currency.toUpperCase()}) will be charged soon.`,
                payload: {
                  ...(invoice.id && { stripe_invoice_id: invoice.id }),
                  amount_due: amountDue,
                  ...(periodEnd && { period_end: periodEnd.toISOString() }),
                },
              }, client);
              logger.info('Processed invoice.upcoming', { organizationId, amountDue });
            }
            break;
          }

          case 'invoice.created': {
            const invoice = event.data.object as any;
            const organizationId = await getOrganizationIdFromInvoice(invoice);
            if (!organizationId) {
              logger.warn('invoice.created: could not resolve organizationId', { invoiceId: invoice.id });
            } else {
              const { periodStart, periodEnd } = getInvoicePeriod(invoice);
              const dbStatus = mapInvoiceStatusToDb(invoice.status ?? 'draft');
              await upsertBillingInvoice({
                organization_id: organizationId,
                stripe_invoice_id: invoice.id,
                amount_due: invoice.amount_due ?? 0,
                amount_paid: invoice.amount_paid ?? null,
                currency: (invoice.currency ?? 'eur').toLowerCase(),
                status: dbStatus,
                period_start: periodStart ?? undefined,
                period_end: periodEnd ?? undefined,
                billing_reason: invoice.billing_reason ?? null,
                hosted_invoice_url: invoice.hosted_invoice_url ?? null,
              }, client);
              logger.info('Processed invoice.created', { organizationId, invoiceId: invoice.id, status: dbStatus });
            }
            break;
          }

          case 'invoice.updated': {
            const invoice = event.data.object as any;
            const organizationId = await getOrganizationIdFromInvoice(invoice);
            if (!organizationId) {
              logger.warn('invoice.updated: could not resolve organizationId', { invoiceId: invoice.id });
            } else {
              const { periodStart, periodEnd } = getInvoicePeriod(invoice);
              const dbStatus = mapInvoiceStatusToDb(invoice.status ?? 'open');
              await upsertBillingInvoice({
                organization_id: organizationId,
                stripe_invoice_id: invoice.id,
                amount_due: invoice.amount_due ?? 0,
                amount_paid: invoice.amount_paid ?? null,
                currency: (invoice.currency ?? 'eur').toLowerCase(),
                status: dbStatus,
                period_start: periodStart ?? undefined,
                period_end: periodEnd ?? undefined,
                billing_reason: invoice.billing_reason ?? null,
                hosted_invoice_url: invoice.hosted_invoice_url ?? null,
              }, client);
              logger.info('Processed invoice.updated', { organizationId, invoiceId: invoice.id, status: dbStatus });
            }
            break;
          }

          case 'invoice.finalized': {
            const invoice = event.data.object as any;
            const organizationId = await getOrganizationIdFromInvoice(invoice);
            if (!organizationId) {
              logger.warn('invoice.finalized: could not resolve organizationId', { invoiceId: invoice.id });
            } else {
              const { periodStart, periodEnd } = getInvoicePeriod(invoice);
              await upsertBillingInvoice({
                organization_id: organizationId,
                stripe_invoice_id: invoice.id,
                amount_due: invoice.amount_due ?? 0,
                amount_paid: invoice.amount_paid ?? null,
                currency: (invoice.currency ?? 'eur').toLowerCase(),
                status: 'open',
                period_start: periodStart ?? undefined,
                period_end: periodEnd ?? undefined,
                billing_reason: invoice.billing_reason ?? null,
                hosted_invoice_url: invoice.hosted_invoice_url ?? null,
              }, client);
              logger.info('Processed invoice.finalized', { organizationId, invoiceId: invoice.id });
            }
            break;
          }

          case 'invoice.payment_succeeded':
          case 'invoice.paid': {
            const invoice = event.data.object as any;
            const organizationId = await getOrganizationIdFromInvoice(invoice);
            if (invoice.subscription) {
              const { stale } = await checkOrderingAndLock(invoice.subscription);
              if (!stale) {
                const lineItem = invoice.lines?.data?.[0];
                const periodEnd = lineItem?.period?.end;

                logger.info(`Processing ${event.type}`, { subscriptionId: invoice.subscription, organizationId, periodEnd });

                if (periodEnd) {
                  await updateSubscription({
                    organization_id: organizationId ?? undefined,
                    stripe_subscription_id: invoice.subscription,
                    stripe_customer_id: invoice.customer as string,
                    current_period_end: new Date(periodEnd * 1000),
                    last_event_created_at: eventCreated,
                  }, client);
                } else {
                  const subscription = await stripe.subscriptions.retrieve(invoice.subscription) as any;
                  await updateSubscription({
                    organization_id: organizationId || subscription.metadata?.organizationId,
                    stripe_subscription_id: subscription.id,
                    stripe_customer_id: subscription.customer as string,
                    current_period_end: new Date(subscription.current_period_end * 1000),
                    last_event_created_at: eventCreated,
                  }, client);
                }
                logger.info('Subscription period end updated via invoice');
              }
            }
            // Always mark invoice as paid when we have org (so Pay now disappears even if event was stale for subscription)
            if (organizationId) {
              const { periodStart, periodEnd } = getInvoicePeriod(invoice);
              await upsertBillingInvoice({
                organization_id: organizationId,
                stripe_invoice_id: invoice.id,
                amount_due: invoice.amount_due ?? 0,
                amount_paid: invoice.amount_paid ?? invoice.amount_due ?? 0,
                currency: (invoice.currency ?? 'eur').toLowerCase(),
                status: 'paid',
                period_start: periodStart ?? undefined,
                period_end: periodEnd ?? undefined,
                billing_reason: invoice.billing_reason ?? null,
                hosted_invoice_url: invoice.hosted_invoice_url ?? null,
              }, client);
              const amountFormatted = ((invoice.amount_paid ?? invoice.amount_due ?? 0) / 100).toFixed(2);
              await insertBillingNotification({
                organization_id: organizationId,
                type: 'payment_success',
                title: 'Payment successful',
                message: `Your payment of €${amountFormatted} was successful.`,
                payload: { stripe_invoice_id: invoice.id },
              }, client);
            }
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as any;
            const organizationId = await getOrganizationIdFromInvoice(invoice);
            if (invoice.subscription) {
              const { stale } = await checkOrderingAndLock(invoice.subscription);
              if (stale) break;

              const lineItem = invoice.lines?.data?.[0];
              const periodEnd = lineItem?.period?.end;

              logger.info('Processing invoice.payment_failed', { subscriptionId: invoice.subscription, organizationId, periodEnd });

              if (periodEnd) {
                await updateSubscription({
                  organization_id: organizationId ?? undefined,
                  stripe_subscription_id: invoice.subscription,
                  stripe_customer_id: invoice.customer as string,
                  current_period_end: new Date(periodEnd * 1000),
                  last_event_created_at: eventCreated,
                }, client);
              } else {
                const subscription = await stripe.subscriptions.retrieve(invoice.subscription) as any;
                await updateSubscription({
                  organization_id: organizationId || subscription.metadata?.organizationId,
                  stripe_subscription_id: subscription.id,
                  stripe_customer_id: subscription.customer as string,
                  current_period_end: new Date(subscription.current_period_end * 1000),
                  last_event_created_at: eventCreated,
                }, client);
              }
              logger.info('Subscription period end updated via failed invoice');
            }
            if (organizationId) {
              const { periodStart, periodEnd } = getInvoicePeriod(invoice);
              await upsertBillingInvoice({
                organization_id: organizationId,
                stripe_invoice_id: invoice.id,
                amount_due: invoice.amount_due ?? 0,
                amount_paid: null,
                currency: (invoice.currency ?? 'eur').toLowerCase(),
                status: 'failed',
                period_start: periodStart ?? undefined,
                period_end: periodEnd ?? undefined,
                billing_reason: invoice.billing_reason ?? null,
                hosted_invoice_url: invoice.hosted_invoice_url ?? null,
              }, client);
              const amountFormatted = ((invoice.amount_due ?? 0) / 100).toFixed(2);
              await insertBillingNotification({
                organization_id: organizationId,
                type: 'payment_failed',
                title: 'Payment failed',
                message: `Your payment of €${amountFormatted} failed. Please update your payment method to avoid service interruption.`,
                payload: { stripe_invoice_id: invoice.id, amount_due: invoice.amount_due },
              }, client);
            }
            break;
          }

          default:
            logger.info('Skipping unhandled event type', { eventType: event.type });
            break;
        }

        await updateWebhookLogStatus(event.id, 'processed', undefined, client);
        logger.info('Audit log status updated to processed');
      });

      logger.info('Webhook processing completed successfully');
      const response = NextResponse.json({ received: true });
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (error: any) {
      logger.error('Webhook processing failed', { error: error.message, stack: error.stack });
      await updateWebhookLogStatus(event.id, 'failed', error.message).catch(() => {});
      const response = NextResponse.json({ error: error.message }, { status: 500 });
      response.headers.set('X-Request-Id', requestId);
      return response;
    }
  });
}
