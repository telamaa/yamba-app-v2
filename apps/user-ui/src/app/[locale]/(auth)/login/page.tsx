import LoginForm from "@/components/auth/forms/LoginForm";
import { pickRandomHeroVisual } from "@/lib/auth/hero-visuals";

// Force le rendu dynamique : on veut un random frais à chaque requête,
// pas un random figé au build time.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const heroVisual = pickRandomHeroVisual();
  return <LoginForm heroVisual={heroVisual} />;
}
