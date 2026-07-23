import { PaymentStep } from "@/components/professional/payment-step"; import { ProfessionalStepShell } from "@/components/professional/step-shell";
export default function Page(){return <ProfessionalStepShell step="payment" kicker="Step 8" title="Prepare payout information" lead="This encrypted information prepares your account for a future payment phase."><PaymentStep/></ProfessionalStepShell>}
