import { pickRandomHeroVisual } from "@/lib/auth/hero-visuals";
import ResetVerifyForm from "@/components/auth/forms/ResetVerifyForm";

export const dynamic = "force-dynamic";

export default function VerifyResetOtpPage() {
  const heroVisual = pickRandomHeroVisual();
  return <ResetVerifyForm heroVisual={heroVisual} />;
}
