/** Singleton branché sur le PrismaClient partagé — un lecteur par processus (C-PR8a, D62 4A). */
import prisma from "../prisma";
import { makeSettingsReader, type SettingsReader } from "./index";

let reader: SettingsReader | null = null;

export function platformSettings(): SettingsReader {
  if (!reader) {
    reader = makeSettingsReader({
      db: prisma as unknown as Parameters<typeof makeSettingsReader>[0]["db"],
      onError: (err) => console.warn("[settings] lecture impossible, valeurs par défaut conservées :", err instanceof Error ? err.message : err),
    });
  }
  return reader;
}
