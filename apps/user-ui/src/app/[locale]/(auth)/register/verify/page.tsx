import RegisterVerifyForm from "@/components/auth/forms/RegisterVerifyForm";
import { pickRandomHeroVisual } from "@/lib/auth/hero-visuals";


export const dynamic = "force-dynamic";

export default function RegisterVerifyPage() {
  const heroVisual = pickRandomHeroVisual();
  return <RegisterVerifyForm heroVisual={heroVisual} />;
}
