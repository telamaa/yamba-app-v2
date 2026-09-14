import { redirect } from "@/i18n/navigation";

/**
 * ANO-WEB-11 — `/become/carrier` était un bouchon de la migration i18n (« Become a carrier
 * (UI only) »), pourtant visé par le bloc d'acquisition de la page destinataire et par l'appel
 * final de l'accueil. L'écran « Devenir Voyageur » du produit est l'assistant d'onboarding
 * (WEB-VOY-1) ; un visiteur y est envoyé à la porte de connexion, puis y revient.
 */
export default async function BecomeCarrierPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/carrier/onboarding", locale });
}
