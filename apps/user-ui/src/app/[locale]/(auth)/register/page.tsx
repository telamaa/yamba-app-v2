import RegisterForm from "@/components/auth/forms/RegisterForm";
import { pickRandomHeroVisual } from "@/lib/auth/hero-visuals";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const heroVisual = pickRandomHeroVisual();
  return <RegisterForm heroVisual={heroVisual} />;
}
