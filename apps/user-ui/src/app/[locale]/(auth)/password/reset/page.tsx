import { pickRandomHeroVisual } from "@/lib/auth/hero-visuals";
import ResetPasswordForm from "@/components/auth/forms/ResetPasswordForm";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const heroVisual = pickRandomHeroVisual();
  return <ResetPasswordForm heroVisual={heroVisual} />;
}
