/**
 * email-inline-image.spec.ts — le symbole dans les emails (D94).
 * ===============================================================
 * D85 avait REFUSÉ ce lot en nommant son risque : « l'affichage *inline*
 * dépend du support de `content_id` côté Resend ; mal câblé, l'image part en
 * pièce jointe attachée au lieu de s'afficher — pire que pas d'image ».
 *
 * C'est exactement le genre de défaut qu'aucun contrôle ne voit : le code
 * compile, l'email part, il arrive — et le destinataire voit un trombone au
 * lieu d'un logo. Ces fiches tiennent les trois points où cela se joue :
 *   ① le `cid` du gabarit et celui de la pièce jointe sont le MÊME ;
 *   ② Resend reçoit `content_id` en SNAKE (son SDK JavaScript dit `contentId`
 *     et convertit ; ce dépôt poste le JSON brut, donc il doit convertir
 *     lui-même) ;
 *   ③ Nodemailer reçoit `contentDisposition: "inline"` — sans quoi l'image
 *     s'affiche bien, mais le client mail montre EN PLUS un trombone.
 *
 * `jest.mock("nodemailer")` vit dans CE fichier et pas dans
 * `email-provider.spec.ts` : la simulation est globale au module, et le
 * voisin teste la vraie fabrique.
 */
import {
  FakeEmailProvider,
  ResendEmailProvider,
  SmtpEmailProvider,
  layoutInlineImages,
  renderTransactionalEmail,
} from "@packages/email";

const sendMail = jest.fn().mockResolvedValue({ messageId: "<smtp-1>" });
jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }) },
  createTransport: () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }),
}));

const CONTENU = {
  preheader: "Ton code : 167139",
  title: "Active ton compte Yamba",
  greeting: "Bonjour Charancelle,",
  paragraphs: ["Saisis le code ci-dessous."],
  code: { label: "Code d'activation", value: "167139" },
  reason: "Tu reçois cet email car un compte a été créé avec cette adresse.",
};

const rendu = (): string =>
  renderTransactionalEmail({ locale: "fr", subject: "Sujet", content: CONTENU });

const email = (): Parameters<FakeEmailProvider["send"]>[0] => ({
  to: "awa@example.com",
  from: "Yamba <no-reply@yamba.app>",
  subject: "Sujet",
  html: rendu(),
  inlineImages: layoutInlineImages(),
});

describe("① le gabarit et la pièce jointe désignent le même cid", () => {
  it("le `src` rendu est exactement le `cid` de la pièce", () => {
    const dansLeHtml = /src="cid:([^"]+)"/.exec(rendu())?.[1];
    expect(dansLeHtml).toBeDefined();
    expect(dansLeHtml).toBe(layoutInlineImages()[0].cid);
  });

  it("le cid tient sous les 128 caractères qu'impose Resend", () => {
    expect(layoutInlineImages()[0].cid.length).toBeLessThan(128);
  });

  it("la pièce est un PNG non vide, en base64", () => {
    const [img] = layoutInlineImages();
    expect(img.contentType).toBe("image/png");
    expect(img.base64.length).toBeGreaterThan(1000);
    // Les huit premiers octets d'un PNG : \x89PNG\r\n\x1a\n
    expect(Buffer.from(img.base64, "base64").subarray(0, 4).toString("latin1")).toBe("\x89PNG");
  });
});

describe("② Resend reçoit content_id, en SNAKE", () => {
  it("la charge utile porte content / filename / content_type / content_id", () => {
    const p = ResendEmailProvider.payload(email()) as {
      attachments?: Array<Record<string, string>>;
    };
    expect(p.attachments).toHaveLength(1);
    expect(p.attachments?.[0]).toEqual({
      content: layoutInlineImages()[0].base64,
      filename: "yamba.png",
      content_type: "image/png",
      content_id: layoutInlineImages()[0].cid,
    });
  });

  it("surtout PAS `contentId` : c'est le nom du SDK, pas celui de l'API", () => {
    // Le défaut que cette fiche empêche ne casse rien et ne se voit qu'en
    // ouvrant un vrai email : Resend ignorerait la clé inconnue et joindrait
    // l'image en pièce attachée.
    const brut = JSON.stringify(ResendEmailProvider.payload(email()));
    expect(brut).toContain('"content_id"');
    expect(brut).not.toContain('"contentId"');
  });

  it("sans image, aucune clé `attachments` n'est envoyée", () => {
    const p = ResendEmailProvider.payload({
      to: "a@b.c",
      from: "f",
      subject: "s",
      html: "<p>x</p>",
    });
    expect(p).not.toHaveProperty("attachments");
  });
});

describe("③ Nodemailer reçoit une pièce INLINE", () => {
  beforeEach(() => sendMail.mockClear());

  it("cid, Buffer et contentDisposition inline", async () => {
    await new SmtpEmailProvider({ SMTP_HOST: "localhost", SMTP_PORT: "1025" }).send(email());
    const envoye = sendMail.mock.calls[0][0] as {
      attachments: Array<{ cid: string; content: Buffer; contentDisposition: string }>;
    };
    expect(envoye.attachments).toHaveLength(1);
    expect(envoye.attachments[0].cid).toBe(layoutInlineImages()[0].cid);
    expect(Buffer.isBuffer(envoye.attachments[0].content)).toBe(true);
    expect(envoye.attachments[0].contentDisposition).toBe("inline");
  });

  it("sans image, aucune clé `attachments` — un tableau vide suffirait à créer une partie MIME", async () => {
    await new SmtpEmailProvider({ SMTP_HOST: "localhost", SMTP_PORT: "1025" }).send({
      to: "a@b.c",
      from: "f",
      subject: "s",
      html: "<p>x</p>",
    });
    expect(sendMail.mock.calls[0][0]).not.toHaveProperty("attachments");
  });
});

describe("le Faux garde les images, donc les fiches peuvent les compter", () => {
  it("l'envoi mémorisé porte la pièce", async () => {
    const faux = new FakeEmailProvider(() => undefined);
    await faux.send(email());
    expect(faux.sent[0].inlineImages).toHaveLength(1);
  });
});

describe("la mise en page, après D94 3A", () => {
  /**
   * Ces fiches lisent le HTML RENDU, pas la source du gabarit : c'est ce qui
   * part réellement dans la boîte du destinataire, et une variable EJS mal
   * nommée s'y verrait.
   */
  it("le mot « Yamba » en capitales a quitté le bandeau", () => {
    // Il était la TROISIÈME occurrence du nom à l'écran, après l'expéditeur
    // affiché par le client mail et le « © Yamba » du pied.
    expect(rendu()).not.toContain("uppercase;\">Yamba</p>");
  });

  it("aucune image DISTANTE : le gabarit ne charge rien depuis le réseau", () => {
    // Une image distante ne s'affiche que si le client accepte de la charger,
    // et le mandataire de Gmail ne peut pas atteindre un poste de dev.
    expect(rendu()).not.toMatch(/<img[^>]+src="https?:/);
  });

  it("le bloc de code est recentré : text-indent = letter-spacing", () => {
    // `letter-spacing` ajoute l'espace APRÈS chaque caractère, y compris le
    // dernier : sans compensation, un code de six chiffres est poussé de la
    // valeur entière vers la droite dans sa boîte. La fiche tient la RÈGLE
    // (les deux valeurs sont égales), pas le nombre.
    const ligne = /letter-spacing:(\d+)px;text-indent:(\d+)px;/.exec(rendu());
    expect(ligne).not.toBeNull();
    expect(ligne?.[1]).toBe(ligne?.[2]);
  });

  it("la bordure du code n'est plus en tirets — ce motif est celui du coupon à découper", () => {
    expect(rendu()).not.toContain("dashed");
  });

  it("le schéma de couleurs est déclaré, sinon Gmail inverse la carte et pas le bandeau", () => {
    expect(rendu()).toContain('name="color-scheme"');
    expect(rendu()).toContain('name="supported-color-schemes"');
  });
});
