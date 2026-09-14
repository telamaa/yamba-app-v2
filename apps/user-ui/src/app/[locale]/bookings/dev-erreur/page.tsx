import { declencherLaPanneDeRecette } from "../../dev/panne";

/**
 * Panne volontaire DANS le tunnel de réservation (recette 5.29, `⏭` en production).
 * Le chemin compte : la frontière d'erreur n'ajoute la phrase « aucun paiement n'a été effectué »
 * que sous `/book` ou `/bookings` — c'est justement ce que cette route permet d'éprouver.
 */
export default async function PanneDeRecetteDansLeTunnel({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  declencherLaPanneDeRecette(type);
}
