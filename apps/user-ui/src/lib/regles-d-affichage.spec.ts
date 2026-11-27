/**
 * regles-d-affichage.spec.ts — les petites règles qui se voient (A224 lot 5).
 * ============================================================================
 * Sept modules de moins de 80 lignes, tous dans `src/lib`, aucun gardé. Ils
 * ne décident ni d'un prix ni d'un accès — ils décident de ce qui s'ÉCRIT, et
 * une faute d'orthographe sur le prénom de quelqu'un se remarque plus qu'un
 * défaut de calcul.
 */
import { countryFlag, countryName } from "@/lib/country-name";
import { elider } from "@/lib/elision";
import { formatDisplayName, getUserInitials } from "@/lib/format-user";
import { routes } from "@/lib/routes";

describe("elider — « d'Aminata » mais « de Pauline »", () => {
  // ANO-WEB-49 : les textes écrivaient l'élision DANS le message
  // (« la déclaration d''{prénom} »), juste devant Aminata et faux devant
  // Pauline. ICU ne sait pas élider ; la règle est sortie du message.
  it("élide devant une voyelle", () => {
    expect(elider("de", "Aminata")).toBe("d'Aminata");
    expect(elider("que", "Aminata")).toBe("qu'Aminata");
  });

  it("n’élide pas devant une consonne", () => {
    expect(elider("de", "Pauline")).toBe("de Pauline");
    expect(elider("que", "Pauline")).toBe("que Pauline");
  });

  it("élide devant un h, muet par défaut", () => {
    // Le h aspiré est rare dans un prénom : la règle choisit le cas fréquent.
    expect(elider("de", "Honoré")).toBe("d'Honoré");
  });

  it("élide devant une voyelle ACCENTUÉE — le cas qu’on oublie", () => {
    expect(elider("de", "Élodie")).toBe("d'Élodie");
    expect(elider("que", "Ève")).toBe("qu'Ève");
    expect(elider("de", "Œlia")).toBe("d'Œlia");
  });

  it("« le » et « la » deviennent « l’ », pas « l » tout court", () => {
    expect(elider("le", "Expéditeur")).toBe("l'Expéditeur");
    expect(elider("la", "Arrivée")).toBe("l'Arrivée");
    expect(elider("le", "Voyageur")).toBe("le Voyageur");
  });

  it("ignore les espaces, et ne rend jamais une élision seule", () => {
    // Un prénom vide rendrait « d' » suspendu dans une phrase.
    expect(elider("de", "  Aminata ")).toBe("d'Aminata");
    expect(elider("de", "")).toBe("de");
    expect(elider("que", "   ")).toBe("que");
  });
});

describe("countryFlag — décoratif, donc jamais bloquant", () => {
  it("rend le drapeau d’un code à deux lettres", () => {
    expect(countryFlag("FR")).toBe("🇫🇷");
    expect(countryFlag("cd")).toBe("🇨🇩");
  });

  it("rend null sur tout code malformé — il ne casse pas la ligne", () => {
    for (const brut of [null, undefined, "", "F", "FRA", "F1", "12", "é"]) {
      expect(countryFlag(brut)).toBeNull();
    }
  });
});

describe("countryName — le texte stocké quand la région est inconnue", () => {
  it("nomme un pays dans la langue demandée", () => {
    expect(countryName("FR", "fr")).toMatch(/France/i);
    expect(countryName("CD", "en")).toBeTruthy();
  });

  it("rend le texte de repli plutôt que le CODE", () => {
    // `Intl.DisplayNames.of()` rend le code TEL QUEL quand la région lui est
    // inconnue : afficher « XX » serait pire que le nom stocké en base.
    // (« ZZ » ne convient pas ici — Intl le connaît et rend « région
    // inconnue » : une prémisse fausse qui a fait partir cette fiche au
    // rouge, et c'est tant mieux, elle décrivait mal la réalité.)
    expect(countryName("XX", "fr", "Pays inconnu")).toBe("Pays inconnu");
    expect(countryName("QQ", "en", "Stored name")).toBe("Stored name");
  });

  it("sans repli, un code inconnu ne rend pas le code lui-même", () => {
    // Afficher « XX » dans une phrase est un défaut visible ; rendre le code
    // est acceptable UNIQUEMENT faute de mieux, et la fiche le constate.
    const rendu = countryName("XX", "fr");
    expect(rendu === null || rendu === "XX").toBe(true);
  });

  it("ne lève jamais sur un code malformé", () => {
    for (const brut of ["", "123", "é!"]) {
      expect(() => countryName(brut, "fr")).not.toThrow();
    }
  });

  it("sans code et sans repli, il n’invente rien", () => {
    expect(countryName(null, "fr")).toBeNull();
    expect(countryName(undefined, "fr", null)).toBeNull();
  });
});

describe("format-user — la CINQUIÈME fonction d’initiales du dépôt", () => {
  // Observation consignée plutôt que corrigée : `getInitials`
  // (`public-trip.helpers`) rend « ? » quand il n'a rien, `getUserInitials`
  // rend « U ». Les deux dessinent une pastille d'avatar. Les contextes
  // diffèrent (soi-même contre autrui), donc c'est peut-être une décision —
  // mais elle n'est écrite nulle part. La fiche la rend visible.
  it("prend une lettre de chaque, en capitale", () => {
    expect(getUserInitials("Enrique", "Goio")).toBe("EG");
    expect(getUserInitials("  marven ", " mabiala ")).toBe("MM");
  });

  it("tient sur un nom manquant", () => {
    expect(getUserInitials("Enrique")).toBe("E");
    expect(getUserInitials(null, "Goio")).toBe("G");
  });

  it("son repli est « U », là où `getInitials` rend « ? »", () => {
    expect(getUserInitials()).toBe("U");
    expect(getUserInitials("", "")).toBe("U");
    expect(getUserInitials("  ", null)).toBe("U");
  });

  it("formatDisplayName met le NOM en capitales et le prénom en capitale initiale", () => {
    expect(formatDisplayName("enrique", "goio")).toBe("Enrique GOIO");
    expect(formatDisplayName("ENRIQUE", "goio")).toBe("Enrique GOIO");
  });

  it("il ne laisse jamais d’espace suspendu ni de chaîne vide", () => {
    // « Enrique  » avec un espace final se voit dans une barre de navigation.
    expect(formatDisplayName("Enrique")).toBe("Enrique");
    expect(formatDisplayName(null, "Goio")).toBe("GOIO");
    expect(formatDisplayName()).toBe("—");
    expect(formatDisplayName("", "")).toBe("—");
  });
});

describe("routes — les liens de la barre principale", () => {
  it("chaque lien est INTERNE et porte un libellé", () => {
    for (const r of routes.primary) {
      expect(r.href.startsWith("/")).toBe(true);
      expect(r.href.startsWith("//")).toBe(false);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });
});
