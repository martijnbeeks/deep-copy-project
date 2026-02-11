"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { PricingCards } from "@/components/billing/pricing-cards";
import { UnifiedPlanSection } from "@/components/billing/unified-plan-section";
import { UsageSection } from "@/components/billing/usage-section";
import { UsageBreakdown } from "@/components/billing/usage-breakdown";
import { UserSubscription, MOCK_NO_SUBSCRIPTION, type BillingStatusResponse } from "@/lib/constants/billing";
import { CreditCard, Rocket, ShieldCheck, Loader2, AlertCircle, Calendar, ExternalLink, DollarSign, Receipt, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useBillingStore } from "@/stores/billing-store";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function BillingPageFallback() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center ml-16">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </main>
    </div>
  );
}

function BillingPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { organizationId, currentUsage, creditLimit, planId, fetchBillingStatus, isLoading: isStoreLoading } = useBillingStore();
  
  const [billing, setBilling] = useState<BillingStatusResponse>({ ...MOCK_NO_SUBSCRIPTION });
  const subscription: UserSubscription = {
    ...billing,
    currentUsage,
    creditLimit,
    planCredits: billing.planCredits,
    adminBonusCredits: billing.adminBonusCredits,
    planId: planId || 'free'
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initBilling = async () => {
      if (!user?.email) return;

      try {
        setIsLoading(true);
        // Sync with global store which handles the fetching logic
        await fetchBillingStatus(user.email, true);
        
        // We still need the full billing data for history and other sections
        // The store currently only holds the key metrics for global display
        const storeOrgId = useBillingStore.getState().organizationId;
        if (storeOrgId) {
          const statusResponse = await fetch(`/api/billing/status?organizationId=${storeOrgId}`, {
            headers: { 'Authorization': `Bearer ${user.email}` }
          });
          
          if (statusResponse.ok) {
            const data = await statusResponse.json();
            setBilling(data);
          }
        }
      } catch (err: any) {
        console.error('Billing initialization error:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    initBilling();
  }, [user, fetchBillingStatus]);

  // Handle Stripe Success Toast
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({
        title: "Subscription Successful!",
        description: "Your plan has been activated. It may take a few seconds to update your status.",
      });
      // Clear URL params
      router.replace('/billing');
    }
  }, [searchParams, toast, router]);

  const handleSubscribe = async (priceId: string) => {
    if (!organizationId || !user?.email) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        },
        body: JSON.stringify({ priceId, organizationId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManage = async (options?: { updatePaymentMethod?: boolean }) => {
    if (!organizationId || !user?.email) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.email}`
        },
        body: JSON.stringify({
          organizationId,
          updatePaymentMethod: options?.updatePaymentMethod ?? false,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create portal session');
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}-${d.toLocaleDateString("en", { month: "short" })}-${d.getFullYear()}`;
  };

  const hasPlan = subscription.planId !== null && subscription.planId !== 'free';

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center ml-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto ml-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="px-6 py-8 border-b">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
              <p className="text-muted-foreground mt-1">
                {hasPlan 
                  ? "Manage your subscription and monitor usage"
                  : "Choose the perfect plan for your needs"
                }
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {error && (
              <Alert variant="destructive" className="mx-auto max-w-6xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!hasPlan ? (
              <div className="max-w-6xl mx-auto space-y-12">
                {/* Pricing Section */}
                <section>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-semibold mb-3">Choose Your Plan</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                      Select the plan that best fits your needs. Upgrade or downgrade anytime.
                    </p>
                  </div>
                  <PricingCards onSubscribe={handleSubscribe} isLoading={isProcessing} />
                </section>

                {/* Features Grid */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <div className="text-center p-6 rounded-xl border bg-card">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Rocket className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Instant Activation</h3>
                    <p className="text-sm text-muted-foreground">Start generating content immediately after subscribing</p>
                  </div>
                  <div className="text-center p-6 rounded-xl border bg-card">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <ShieldCheck className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Secure Billing</h3>
                    <p className="text-sm text-muted-foreground">Industry-standard security with Stripe</p>
                  </div>
                  <div className="text-center p-6 rounded-xl border bg-card">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Flexible Plans</h3>
                    <p className="text-sm text-muted-foreground">No long-term contracts, cancel anytime</p>
                  </div>
                </section>
              </div>
            ) : (
              <div className="max-w-6xl mx-auto space-y-8">
                {/* Payment failed alert – redirect to Stripe portal to update card */}
                {billing.paymentFailed && (
                  <Alert variant="destructive" className="max-w-6xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
                      <span>
                        Your last payment failed. Please update your payment method to avoid service interruption.
                      </span>
                      <button
                        onClick={() => handleManage({ updatePaymentMethod: true })}
                        disabled={isProcessing}
                        className="shrink-0 font-medium underline underline-offset-4 hover:no-underline"
                      >
                        Update payment method
                      </button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Payment due — open/unpaid invoice */}
                {billing.openInvoice && (
                  <section>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold">Payment due</h2>
                    </div>
                    <div className="bg-card rounded-xl border-2 border-amber-500/50 dark:border-amber-500/30 p-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium">
                            € {(billing.openInvoice.amountDue / 100).toFixed(2)}{" "}
                            {billing.openInvoice.currency.toUpperCase()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {billing.openInvoice.periodEnd
                              ? `Due: ${formatDate(billing.openInvoice.periodEnd)}`
                              : "Invoice awaiting payment"}
                          </p>
                        </div>
                      </div>
                      {billing.openInvoice.hostedInvoiceUrl ? (
                        <Button asChild>
                          <a
                            href={billing.openInvoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2"
                          >
                            Pay now
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <Button disabled variant="secondary">
                            Pay now
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Link will be available when the invoice is ready
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Unified Plan & Credit Section */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Subscription & Pricing</h2>
                  </div>
                  <UnifiedPlanSection subscription={subscription} onManage={handleManage} />
                </section>

                {/* Upcoming invoice */}
                {billing.upcomingInvoice && (
                  <section>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold">Upcoming charge</h2>
                    </div>
                    <div className="bg-card rounded-xl border p-6 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <Calendar className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            € {(billing.upcomingInvoice.amountDue / 100).toFixed(2)}{" "}
                            {billing.upcomingInvoice.currency.toUpperCase()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {billing.upcomingInvoice.periodEnd
                              ? `Billing date: ${formatDate(billing.upcomingInvoice.periodEnd)}`
                              : "Next billing cycle"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Redesigned Invoice history */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10 shadow-sm">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold tracking-tight">Invoice history</h2>
                        <p className="text-xs text-muted-foreground font-medium">Download and view your past billing statements</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-left p-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Billing period</th>
                            <th className="text-left p-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Amount</th>
                            <th className="text-left p-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Status</th>
                            <th className="text-right p-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {billing.invoiceHistory && billing.invoiceHistory.length > 0 ? (
                            billing.invoiceHistory.map((inv) => (
                              <tr key={inv.id} className="hover:bg-muted/30 transition-colors group">
                                <td className="p-4">
                                  <div className="flex items-center gap-2.5">
                                    <Calendar className="h-4 w-4 text-muted-foreground/50" />
                                    <span className="font-medium">
                                      {inv.periodStart || inv.periodEnd
                                        ? `${formatDate(inv.periodStart)} to ${formatDate(inv.periodEnd)}`
                                        : "—"}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4 font-bold">
                                  € {((inv.amountPaid ?? inv.amountDue) / 100).toFixed(2)}{" "}
                                  {/* <span className="text-[10px] text-muted-foreground uppercase">{inv.currency.toUpperCase()}</span> */}
                                </td>
                                <td className="p-4">
                                  {inv.status === "paid" ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200/50 dark:border-green-800/50 uppercase tracking-wider">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {inv.status}
                                    </span>
                                  ) : inv.status === "failed" ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wider">
                                      <XCircle className="h-3 w-3" />
                                      {inv.status}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 uppercase tracking-wider">
                                      <Clock className="h-3 w-3" />
                                      {inv.status}
                                    </span>
                                  )}
                                </td>
                                <td className="p-4 text-right">
                                  {inv.hostedInvoiceUrl ? (
                                    <Button variant="ghost" size="sm" asChild className="h-8 gap-2 hover:bg-primary/5 hover:text-primary transition-all group/btn">
                                      <a
                                        href={inv.hostedInvoiceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        Receipt
                                        <ExternalLink className="h-3.5 w-3.5 opacity-50 group-hover/btn:opacity-100 transition-opacity" />
                                      </a>
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground mr-4">—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="p-12 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <Receipt className="h-8 w-8 text-muted-foreground/20" />
                                  <p className="text-sm text-muted-foreground">No billing activity recorded yet.</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* Usage Overview Section */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Usage Overview</h2>
                  </div>
                  <UsageSection subscription={subscription} />
                </section>

                {/* Usage Breakdown Section */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Detailed Usage</h2>
                  </div>
                  <UsageBreakdown organizationId={organizationId!} />
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<BillingPageFallback />}>
      <BillingPageContent />
    </Suspense>
  );
}
