import { CreditConsumptionInfo } from "./credit-consumption-info";

interface CreditBreakdownProps {
  totalUsage?: number;
  creditLimit?: number;
}

export function CreditBreakdown({ totalUsage, creditLimit }: CreditBreakdownProps) {
  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm">
      <CreditConsumptionInfo />
    </div>
  );
}
