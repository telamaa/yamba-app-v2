import { pickRandomHeroVisual } from "@/lib/auth/hero-visuals";
import ForgotPasswordForm from "@/components/auth/forms/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const heroVisual = pickRandomHeroVisual();
  return <ForgotPasswordForm heroVisual={heroVisual} />;
}
