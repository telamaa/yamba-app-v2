/**
 * analytics.spec.ts — la mesure n'existe qu'avec le consentement (A224, lot 2).
 * ==============================================================================
 * Ce module décide de ce qui PART du navigateur d'un visiteur vers un tiers.
 * C'est de la **vie privée** : une erreur ici ne produit aucun symptôme
 * visible, et c'est précisément ce qui la rend coûteuse.
 *
 * Trois promesses à tenir (D66 2A/3A) : rien avant « accepter », l'oubli au
 * bout de six mois, et aucune panne de stockage qui fasse tomber la page.
 *
 * Le harnais tourne en `node` : `localStorage` n'existe pas. C'est une
 * CHANCE — le premier bloc vérifie le comportement réel d'un navigateur en
 * navigation privée, où l'accès au stockage lève.
 */
import { readConsent, writeConsent } from "@/lib/analytics";

const CLE = "yamba.analytics.consent";
const SIX_MOIS_MS = 180 * 86_400_000;

/** Un stockage de navigateur, en mémoire. Aucune dépendance. */
function poserUnStockage(): Map<string, string> {
  const memoire = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memoire.get(k) ?? null,
      setItem: (k: string, v: string) => void memoire.set(k, v),
      removeItem: (k: string) => void memoire.delete(k),
    },
  });
  return memoire;
}

function retirerLeStockage(): void {
  Reflect.deleteProperty(globalThis as object, "localStorage");
}

afterEach(retirerLeStockage);

describe("sans stockage — navigation privée, stockage bloqué", () => {
  it("lire ne lève pas : la bannière reviendra, la page tient", () => {
    // `readConsent` est appelé au rendu de chaque page. S'il levait, la
    // navigation privée casserait le site entier.
    expect(() => readConsent()).not.toThrow();
    expect(readConsent()).toBeNull();
  });

  it("écrire ne lève pas non plus", () => {
    expect(() => writeConsent("granted")).not.toThrow();
  });

  it("et surtout : pas de stockage ⇒ pas de consentement présumé", () => {
    // Le défaut qu'on ne veut jamais : un échec de lecture interprété comme
    // « il avait accepté ». Le silence vaut refus.
    expect(readConsent()).not.toBe("granted");
  });
});

describe("avec stockage — le choix se relit", () => {
  it("un accord se relit", () => {
    poserUnStockage();
    writeConsent("granted");
    expect(readConsent()).toBe("granted");
  });

  it("un refus se relit AUSSI — il doit tenir", () => {
    // Un refus qui ne se relit pas fait revenir la bannière à chaque page :
    // c'est harceler quelqu'un qui a déjà dit non.
    poserUnStockage();
    writeConsent("denied");
    expect(readConsent()).toBe("denied");
  });

  it("rien de stocké ⇒ rien de présumé", () => {
    poserUnStockage();
    expect(readConsent()).toBeNull();
  });
});

describe("l’oubli au bout de six mois", () => {
  it("un choix de la veille tient", () => {
    const memoire = poserUnStockage();
    memoire.set(CLE, JSON.stringify({ choice: "granted", at: Date.now() - 86_400_000 }));
    expect(readConsent()).toBe("granted");
  });

  it("un choix plus vieux que six mois est OUBLIÉ", () => {
    const memoire = poserUnStockage();
    memoire.set(CLE, JSON.stringify({ choice: "granted", at: Date.now() - SIX_MOIS_MS - 1000 }));
    expect(readConsent()).toBeNull();
  });

  it("l’oubli vaut aussi pour un REFUS périmé — on redemande", () => {
    const memoire = poserUnStockage();
    memoire.set(CLE, JSON.stringify({ choice: "denied", at: Date.now() - SIX_MOIS_MS - 1000 }));
    expect(readConsent()).toBeNull();
  });
});

describe("un stockage abîmé ne vaut jamais un accord", () => {
  // Trois formes vues en vrai : une extension qui réécrit la valeur, une
  // version antérieure du format, un JSON tronqué par une coupure.
  const abimes = [
    ["du texte brut", "granted"],
    ["un JSON tronqué", '{"choice":"gran'],
    ["un objet sans date", '{"choice":"granted"}'],
    ["une date vide", '{"choice":"granted","at":0}'],
    ["un choix absent", '{"at":1}'],
    ["un tableau", "[]"],
    ["une chaîne vide", ""],
  ] as const;

  it.each(abimes)("%s ⇒ aucun consentement", (_nom, brut) => {
    const memoire = poserUnStockage();
    memoire.set(CLE, brut);
    expect(readConsent()).not.toBe("granted");
  });

  it.each(abimes)("%s ⇒ aucune exception", (_nom, brut) => {
    const memoire = poserUnStockage();
    memoire.set(CLE, brut);
    expect(() => readConsent()).not.toThrow();
  });
});

describe("ce que le module NE fait pas, et c’est le sujet", () => {
  it("il ne charge rien tant que la clé n’est pas posée", async () => {
    // `analyticsConfigured()` est faux sans `NEXT_PUBLIC_POSTHOG_KEY` : en
    // développement, aucun paquet tiers n'est importé, même après « accepter ».
    const { analyticsConfigured } = await import("@/lib/analytics");
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      expect(analyticsConfigured()).toBe(false);
    }
  });

  it("le SDK est importé DYNAMIQUEMENT, jamais en haut du module", () => {
    // Un import statique chargerait posthog-js pour tout visiteur, y compris
    // celui qui refuse — la promesse serait rompue avant toute question.
    const source = require("node:fs").readFileSync(
      require("node:path").resolve(__dirname, "analytics.ts"),
      "utf8"
    ) as string;
    expect(source).toContain('import("posthog-js")');
    expect(source).not.toMatch(/^import .*posthog/m);
  });
});
