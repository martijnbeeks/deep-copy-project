export interface BillingPlan {
  id: string;
  name: string;
  priceId: string;
  price: number;
  currency: string;
  credits: number;
  overagePrice: number;
  description: string;
  features: string[];
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_starter_monthly',
    price: 29,
    currency: 'EUR',
    credits: 120,
    overagePrice: 0.50,
    description: 'Perfect for small projects and individuals.',
    features: [
      '120 Job Credits included',
      '€0.50 per overage credit',
      'Standard support',
      'Access to all templates',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || 'price_business_monthly',
    price: 99,
    currency: 'EUR',
    credits: 400,
    overagePrice: 0.50,
    description: 'Best for growing teams and agencies.',
    features: [
      '400 Job Credits included',
      '€0.50 per overage credit',
      'Priority support',
      'Advanced analytics',
      'Team collaboration',
    ],
  },
  {
    id: 'scale-up',
    name: 'Scale-up',
    priceId: process.env.NEXT_PUBLIC_STRIPE_SCALEUP_PRICE_ID || 'price_scale_up_monthly',
    price: 299,
    currency: 'EUR',
    credits: 900,
    overagePrice: 0.50,
    description: 'Enterprise-grade features for high-volume users.',
    features: [
      '900 Job Credits included',
      '€0.50 per overage credit',
      'Dedicated account manager',
      'Custom integrations',
      'White-label options',
    ],
  },
];

export interface UserSubscription {
  planId: string | null;
  status: 'active' | 'canceled' | 'incomplete' | 'none';
  currentUsage: number;
  creditLimit: number;
  planCredits?: number;
  adminBonusCredits?: number;
  billingCycle: 'monthly';
  projectedOverage: number;
}

export interface UpcomingInvoiceInfo {
  id: string;
  stripeInvoiceId: string;
  amountDue: number;
  currency: string;
  periodEnd: string | null;
}

export interface InvoiceHistoryItem {
  id: string;
  stripeInvoiceId: string;
  amountDue: number;
  amountPaid: number | null;
  currency: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
}

/** Open/unpaid invoice — shown as "Payment due" with Pay Now */
export interface OpenInvoiceInfo {
  id: string;
  stripeInvoiceId: string;
  amountDue: number;
  currency: string;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
}

export interface BillingNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface BillingStatusResponse extends UserSubscription {
  currentPeriodEnd?: string | null;
  upcomingInvoice?: UpcomingInvoiceInfo | null;
  openInvoice?: OpenInvoiceInfo | null;
  invoiceHistory?: InvoiceHistoryItem[];
  paymentFailed?: boolean;
  billingNotifications?: BillingNotificationItem[];
}

// Mock data for initial states
export const MOCK_NO_SUBSCRIPTION: UserSubscription = {
  planId: null,
  status: 'none',
  currentUsage: 0,
  creditLimit: 0,
  billingCycle: 'monthly',
  projectedOverage: 0,
};

export const MOCK_ACTIVE_SUBSCRIPTION: UserSubscription = {
  planId: 'business',
  status: 'active',
  currentUsage: 42,
  creditLimit: 50,
  billingCycle: 'monthly',
  projectedOverage: 0,
};

export const getPlanIdByPriceId = (priceId: string): string => {
  const plan = BILLING_PLANS.find(p => p.priceId === priceId);
  return plan ? plan.id : 'free';
};
