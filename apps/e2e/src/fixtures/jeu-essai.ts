/**
 * jeu-essai.ts — la remise à zéro du § 3.6, et la carte des identifiants
 * ======================================================================
 * Le cahier ouvre chaque chapitre par « rejoue le jeu d'essai ». Le seed (`seed-deals.ts`)
 * efface et recrée trajets et réservations des comptes du seed, puis écrit `seed-output.json` :
 * la correspondance entre les **repères du cahier** (`bzv-pending`, `gru`, `thomas`) et les
 * identifiants réels de la base.
 *
 * Deux règles de discipline, apprises en recette :
 *
 * 1. **Un parcours ne dépend jamais d'un identifiant écrit en dur.** Il demande `deal("bzv-pending")`
 *    et le seed lui répond. Un identifiant recopié devient faux au prochain seed — c'est ce qui
 *    a coûté deux mesures pendant la campagne « tâches planifiées ».
 * 2. **La remise à zéro est explicite, jamais implicite.** Un parcours qui remet la base à zéro
 *    sans le dire fait échouer celui qui tourne à côté. C'est pourquoi le harnais est en
 *    `workers: 1` et que le seed se demande, fichier de parcours par fichier de parcours.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "../../../..");
const SORTIE_SEED = join(RACINE, "packages/libs/prisma/scripts/seed-output.json");

export interface DealSeed {
  cle: string;
  id: string;
  statut: string;
  corridor: string;
  expediteur: string;
  voyageur: string;
}

interface SortieSeed {
  generatedAt: string;
  users: Record<string, string>;
  trips: Record<string, string>;
  bookings: Array<{ key: string; id: string; status: string; corridor: string; shipper: string; carrier: string }>;
}

export class JeuEssai {
  private cache: SortieSeed | null = null;

  /**
   * Rejoue `seed-deals.ts` (§ 3.6). Long — une vingtaine de secondes — donc appelé une fois par
   * fichier de parcours, dans un `beforeAll`, jamais entre deux étapes.
   */
  rejouer(): void {
    execFileSync("npx", ["tsx", "--env-file=.env", "packages/libs/prisma/scripts/seed-deals.ts"], {
      cwd: RACINE,
      stdio: "pipe",
      timeout: 180_000,
    });
    this.cache = null;
  }

  private lire(): SortieSeed {
    if (!this.cache) this.cache = JSON.parse(readFileSync(SORTIE_SEED, "utf-8")) as SortieSeed;
    return this.cache;
  }

  /** L'identifiant d'un membre du seed (`thomas`, `aminata`…). */
  membre(cle: string): string {
    const id = this.lire().users[cle];
    if (!id) throw new Error(`Jeu d'essai : aucun membre « ${cle} » (${Object.keys(this.lire().users).join(", ")})`);
    return id;
  }

  /** L'identifiant d'un trajet du seed (`bzv-perkg`, `fih`…). */
  trajet(cle: string): string {
    const id = this.lire().trips[cle];
    if (!id) throw new Error(`Jeu d'essai : aucun trajet « ${cle} » (${Object.keys(this.lire().trips).join(", ")})`);
    return id;
  }

  /** Un deal du seed avec tout ce que le cahier en dit (`bzv-accepted`, `sgn-picked`…). */
  deal(cle: string): DealSeed {
    const b = this.lire().bookings.find((x) => x.key === cle);
    if (!b) throw new Error(`Jeu d'essai : aucun deal « ${cle} »`);
    return { cle: b.key, id: b.id, statut: b.status, corridor: b.corridor, expediteur: b.shipper, voyageur: b.carrier };
  }

  /**
   * Une manœuvre de base — vieillir une date, forcer un statut. Le cahier en autorise
   * explicitement quelques-unes (« si le départ est plus lointain, avance-le en base et note la
   * manœuvre », WEB-E2E-3 § 1) ; chaque appel doit dire POURQUOI, parce qu'une manœuvre non
   * consignée transforme une recette en illusion.
   */
  manoeuvre(raison: string, script: string): string {
    process.stdout.write(`   ↳ manœuvre en base : ${raison}\n`);
    return execFileSync("npx", ["tsx", "--env-file=.env", "-e", script], {
      cwd: RACINE,
      encoding: "utf-8",
      timeout: 60_000,
    });
  }
}
