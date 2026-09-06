/**
 * layout.ts — LE gabarit transactionnel de Yamba (D44 ④)
 * =======================================================
 * Un seul HTML pour tous les emails de tous les services : les emails
 * deviennent des DONNÉES (`EmailContent`) et ce gabarit les met en page.
 * Source EJS embarquée dans le bundle (chaîne TS, pas de fichier lu sur le
 * disque) : fonctionne quel que soit le `cwd` du service (nx serve depuis
 * la racine, `node dist/main.js` depuis apps/<service>, jest).
 *
 * Charte §3.4 : mango #FF9900 = avancer (CTA), teal #0F766E = engager
 * (bandeau), slate = neutre. Pas d'emoji dans les sujets ni les titres.
 * Tables imbriquées + styles inline : c'est ce que les clients mail
 * (Outlook, Gmail) rendent de façon prévisible.
 */

export type EmailNoticeTone = "info" | "warning" | "success";

export type EmailContent = {
  /** Texte caché en tête (aperçu boîte de réception). */
  preheader: string;
  /** Titre du bandeau. */
  title: string;
  /** « Bonjour Awa, » — déjà localisé, déjà avec le prénom. */
  greeting: string;
  /** Paragraphes du corps, dans l'ordre. */
  paragraphs: string[];
  /** Bloc code (OTP) : gros chiffres espacés. */
  code?: { label: string; value: string };
  /** Encadré (expiration, sécurité, confirmation). */
  notice?: { tone: EmailNoticeTone; text: string };
  /** Bouton principal. */
  cta?: { label: string; url: string };
  /** Petits paragraphes sous le CTA (conseil, contact). */
  footnotes?: string[];
  /** Pied : pourquoi tu reçois cet email. */
  reason: string;
  /** Pied : lien d'aide (« Besoin d'aide ? »). */
  help?: { label: string; url: string };
};

export const NOTICE_STYLES: Record<EmailNoticeTone, { bg: string; border: string; color: string }> = {
  info: { bg: "#f0fdfa", border: "#99f6e4", color: "#115e59" },
  warning: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
  success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
};

/** Source EJS du gabarit. Variables : locale, subject, content, noticeStyle, year. */
export const LAYOUT_EJS = `<!DOCTYPE html>
<html lang="<%= locale %>">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title><%= subject %></title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;"><%= content.preheader %></div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px -4px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#0F766E 0%,#14b8a6 100%);padding:28px 24px;text-align:center;">
            <p style="margin:0 0 6px 0;color:#ccfbf1;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Yamba</p>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;line-height:1.3;"><%= content.title %></h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 24px 8px 24px;">
            <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;"><%= content.greeting %></p>
<% content.paragraphs.forEach(function (p) { %>
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#334155;"><%= p %></p>
<% }); %>
<% if (content.code) { %>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px 0;">
              <tr>
                <td align="center">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;">
                    <tr>
                      <td style="padding:20px 40px;text-align:center;">
                        <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;"><%= content.code.label %></p>
                        <p style="margin:0;font-size:36px;font-weight:800;color:#0f172a;letter-spacing:8px;font-family:'Courier New',Courier,monospace;"><%= content.code.value %></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
<% } %>
<% if (content.notice) { %>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;background-color:<%= noticeStyle.bg %>;border:1px solid <%= noticeStyle.border %>;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-size:14px;line-height:1.5;color:<%= noticeStyle.color %>;"><%= content.notice.text %></p>
                </td>
              </tr>
            </table>
<% } %>
<% if (content.cta) { %>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:4px auto 24px auto;">
              <tr>
                <td style="background-color:#FF9900;border-radius:12px;">
                  <a href="<%= content.cta.url %>" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0f172a;text-decoration:none;"><%= content.cta.label %></a>
                </td>
              </tr>
            </table>
<% } %>
<% (content.footnotes || []).forEach(function (f) { %>
            <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#64748b;"><%= f %></p>
<% }); %>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px 24px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#94a3b8;"><%= content.reason %></p>
<% if (content.help) { %>
            <p style="margin:0 0 6px 0;font-size:12px;"><a href="<%= content.help.url %>" style="color:#0F766E;text-decoration:underline;"><%= content.help.label %></a></p>
<% } %>
            <p style="margin:0;font-size:12px;color:#cbd5e1;">&copy; <%= year %> Yamba</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
