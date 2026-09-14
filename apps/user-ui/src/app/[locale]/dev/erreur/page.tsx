import { declencherLaPanneDeRecette } from "../panne";

/** Panne volontaire HORS tunnel de réservation (recette 5.29, `⏭` en production). */
export default async function PanneDeRecette({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  declencherLaPanneDeRecette(type);
}
