import { redirect } from "@/i18n/navigation";

/** ANO-WEB-11 — même bouchon que `/become/carrier` : envoyer un colis commence par la recherche. */
export default async function BecomeShipperPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/search", locale });
}
