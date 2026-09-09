/**
 * mailpit.ts — l'onglet Mailpit du cahier, en code
 * ================================================
 * Les parcours du cahier 01-WEB gardent Mailpit ouvert en permanence et vérifient, à chaque
 * étape, **qui** reçoit **quoi**. Deux vérifications reviennent sans cesse et méritent leurs
 * propres fonctions :
 *
 * - `attendreEmail` — un email arrive, avec le bon destinataire et le bon sujet. L'attente est
 *   nécessaire : l'email est produit par un événement d'outbox relayé puis consommé, donc il
 *   arrive **quelques secondes** après le geste, jamais pendant.
 * - `aucunEmailPour` — personne d'autre ne reçoit rien. C'est la moitié qu'on oublie : la
 *   campagne « tâches planifiées » a montré qu'un email de trop est aussi grave qu'un email
 *   manquant (le code de livraison ne doit JAMAIS partir par email, l'autre partie ne doit
 *   jamais lire le montant qui ne la concerne pas).
 */

const BASE = process.env.MAILPIT_URL ?? "http://localhost:8026";

export interface EmailResume {
  id: string;
  destinataire: string;
  sujet: string;
  recuLe: string;
}

export interface EmailComplet extends EmailResume {
  texte: string;
  html: string;
}

interface CritereEmail {
  /** Adresse exacte du destinataire. */
  pour?: string;
  /** Fragment de sujet (insensible à la casse). */
  sujet?: string | RegExp;
}

const correspond = (e: EmailResume, c: CritereEmail): boolean => {
  if (c.pour && e.destinataire.toLowerCase() !== c.pour.toLowerCase()) return false;
  if (typeof c.sujet === "string" && !e.sujet.toLowerCase().includes(c.sujet.toLowerCase())) return false;
  if (c.sujet instanceof RegExp && !c.sujet.test(e.sujet)) return false;
  return true;
};

export class Mailpit {
  constructor(private readonly base: string = BASE) {}

  /** Vérifie que Mailpit répond — un parcours qui compte sur les emails ne doit pas partir sans lui. */
  async disponible(): Promise<boolean> {
    try {
      const r = await fetch(`${this.base}/api/v1/messages?limit=1`);
      return r.ok;
    } catch {
      return false;
    }
  }

  /** § 3.6 du cahier : on vide la boîte avant chaque étape qui l'observe. */
  async vider(): Promise<void> {
    const r = await fetch(`${this.base}/api/v1/messages`, { method: "DELETE" });
    if (!r.ok) throw new Error(`Mailpit : vidage impossible (${r.status})`);
  }

  async lister(limite = 200): Promise<EmailResume[]> {
    const r = await fetch(`${this.base}/api/v1/messages?limit=${limite}`);
    if (!r.ok) throw new Error(`Mailpit : lecture impossible (${r.status})`);
    const corps = (await r.json()) as { messages: Array<{ ID: string; To: Array<{ Address: string }>; Subject: string; Created: string }> };
    return corps.messages.map((m) => ({
      id: m.ID,
      destinataire: m.To?.[0]?.Address ?? "",
      sujet: m.Subject,
      recuLe: m.Created,
    }));
  }

  async ouvrir(id: string): Promise<EmailComplet> {
    const r = await fetch(`${this.base}/api/v1/message/${id}`);
    if (!r.ok) throw new Error(`Mailpit : message ${id} illisible (${r.status})`);
    const m = (await r.json()) as { ID: string; To: Array<{ Address: string }>; Subject: string; Date: string; Text?: string; HTML?: string };
    return {
      id: m.ID,
      destinataire: m.To?.[0]?.Address ?? "",
      sujet: m.Subject,
      recuLe: m.Date,
      texte: m.Text ?? "",
      html: m.HTML ?? "",
    };
  }

  /**
   * Attend qu'un email correspondant arrive, et le rend **ouvert** (corps compris) : la moitié
   * des vérifications du cahier portent sur le contenu (un montant présent, un code absent).
   */
  async attendreEmail(critere: CritereEmail, delaiMs = 45_000): Promise<EmailComplet> {
    const fin = Date.now() + delaiMs;
    let vus: EmailResume[] = [];
    while (Date.now() < fin) {
      vus = await this.lister();
      const trouve = vus.find((e) => correspond(e, critere));
      if (trouve) return this.ouvrir(trouve.id);
      await new Promise((r) => setTimeout(r, 1_000));
    }
    const inventaire = vus.map((e) => `  · ${e.destinataire} — ${e.sujet}`).join("\n") || "  (boîte vide)";
    throw new Error(
      `Mailpit : aucun email ${JSON.stringify(critere)} après ${Math.round(delaiMs / 1000)} s.\nCe que la boîte contient :\n${inventaire}`
    );
  }

  /** Tous les emails reçus par une adresse, du plus ancien au plus récent. */
  async emailsPour(adresse: string): Promise<EmailResume[]> {
    const tous = await this.lister();
    return tous.filter((e) => e.destinataire.toLowerCase() === adresse.toLowerCase()).reverse();
  }

  /**
   * Vérifie qu'une adresse n'a **rien** reçu. Laisse au flux le temps d'arriver avant de
   * conclure : affirmer une absence sans attendre, c'est affirmer qu'on n'a pas regardé.
   */
  async aucunEmailPour(adresse: string, attenteMs = 8_000): Promise<void> {
    await new Promise((r) => setTimeout(r, attenteMs));
    const recus = await this.emailsPour(adresse);
    if (recus.length > 0) {
      throw new Error(`Mailpit : ${adresse} a reçu ${recus.length} email(s) alors qu'il ne devait rien recevoir :\n` + recus.map((e) => `  · ${e.sujet}`).join("\n"));
    }
  }

  /** Le nombre d'emails portant ce sujet — pour « un SEUL email de jalon » (WEB-E2E-1 § 20). */
  async compter(critere: CritereEmail): Promise<number> {
    const tous = await this.lister();
    return tous.filter((e) => correspond(e, critere)).length;
  }
}
