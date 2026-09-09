/**
 * photos.ts — les photos que le harnais « prend » (prise en charge, remise)
 * =========================================================================
 * Le front téléverse chaque photo **directement chez ImageKit** (jeton signé par trip-service,
 * puis `POST https://upload.imagekit.io/...`), et n'envoie au deal-service que les URL rendues.
 * Le harnais **intercepte cet appel tiers** par défaut : une recette qui dépose trois vraies
 * images dans la médiathèque de production à chaque exécution n'est pas une recette, c'est une
 * fuite. Le reste de la chaîne — jeton d'authentification ImageKit demandé à trip-service,
 * validation des types et des tailles côté client, URL transmises au deal-service et
 * enregistrées sur le deal — est traversé tel quel.
 *
 * `E2E_IMAGEKIT=real` laisse passer le vrai téléversement (recette du fournisseur, chapitre 5.9).
 */
import type { Page } from "@playwright/test";

/** Un PNG 1×1 valide (pixel mango), suffisant pour `image/png` et pour ImageKit. */
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5/hPwAIAgL/4d1j8wAAAABJRU5ErkJggg==",
  "base64"
);

let compteur = 0;

/** Une photo à donner à `setInputFiles` — nom unique, type accepté par le front. */
export function photo(nom = "colis"): { name: string; mimeType: string; buffer: Buffer } {
  compteur += 1;
  return { name: `${nom}-${compteur}.png`, mimeType: "image/png", buffer: PNG_1x1 };
}

/**
 * Intercepte ImageKit sur cette page : chaque téléversement répond une URL plausible et unique,
 * sans quitter le poste. À poser AVANT d'ouvrir l'écran qui téléverse.
 */
export async function intercepterImageKit(page: Page): Promise<void> {
  if (process.env.E2E_IMAGEKIT === "real") return;
  await page.route("https://upload.imagekit.io/**", async (route) => {
    compteur += 1;
    const url = `https://ik.imagekit.io/yamba-e2e/deals/photo-${Date.now()}-${compteur}.png`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ fileId: `e2e-${compteur}`, name: `photo-${compteur}.png`, url, thumbnailUrl: url, filePath: `/deals/photo-${compteur}.png` }),
    });
  });
}
