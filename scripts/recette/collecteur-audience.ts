/**
 * collecteur-audience.ts — un faux PostHog, local, pour la recette 5.27 (WEB-ANA)
 * ================================================================================
 * Le chapitre 5.27 doit voir **ce que le navigateur enverrait vraiment** à la mesure d'audience.
 * Intercepter les requêtes dans le harnais ne suffit pas : le SDK PostHog commence par demander
 * sa configuration distante, et sans réponse crédible il n'envoie jamais le moindre événement —
 * on prouverait alors une absence qu'on a soi-même fabriquée.
 *
 * Ce script écoute donc sur `127.0.0.1:9977` (`NEXT_PUBLIC_POSTHOG_HOST` du poste de recette) et
 * répond comme PostHog : une configuration minimale (aucune capture automatique, aucun sondage,
 * aucun enregistrement de session), des drapeaux vides, et `{"status":1}` sur les points d'entrée
 * d'événements — dont il écrit le contenu, une ligne de JSON par événement, dans un fichier que la
 * fiche relit. Rien ne sort du poste.
 *
 *   npx tsx scripts/recette/collecteur-audience.ts [--port 9977] [--out /tmp/audience.jsonl] [--clear]
 */
import { createServer, type ServerResponse } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const argument = (nom: string, defaut: string) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};
const PORT = Number(argument("port", "9977"));
const SORTIE = argument("out", "/tmp/yamba-audience.jsonl");
if (process.argv.includes("--clear")) writeFileSync(SORTIE, "");

/** La configuration distante : tout ce qui capture de lui-même est coupé. */
const configuration = (cle: string) => ({
  token: cle,
  supportedCompression: ["base64"],
  hasFeatureFlags: false,
  autocapture_opt_out: true,
  autocaptureExceptions: false,
  captureDeadClicks: false,
  capturePerformance: false,
  sessionRecording: false,
  surveys: false,
  heatmaps: false,
  defaultIdentifiedOnly: true,
  errorTracking: { autocaptureExceptions: false },
});

const drapeaux = {
  featureFlags: {},
  featureFlagPayloads: {},
  errorsWhileComputingFlags: false,
  sessionRecording: false,
  supportedCompression: ["base64"],
  config: { enable_collect_everything: false },
  quotaLimited: [],
  toolbarParams: {},
  isAuthenticated: false,
  siteApps: [],
  surveys: false,
  heatmaps: false,
  captureDeadClicks: false,
  autocapture_opt_out: true,
};

/** Les formes qu'un corps PostHog peut prendre : JSON nu, `data=<json>`, `data=<base64>`, gzip. */
function lireLeCorps(brut: Buffer, typeContenu: string): unknown[] {
  const textes: string[] = [];
  try {
    textes.push(gunzipSync(brut).toString("utf-8"));
  } catch {
    /* pas du gzip */
  }
  const texte = brut.toString("utf-8");
  textes.push(texte);
  if (/application\/x-www-form-urlencoded/.test(typeContenu) || texte.startsWith("data=")) {
    const parametre = /(?:^|&)data=([^&]*)/.exec(texte);
    if (parametre) {
      const decode = decodeURIComponent(parametre[1]);
      textes.push(decode);
      try {
        textes.push(Buffer.from(decode, "base64").toString("utf-8"));
      } catch {
        /* pas du base64 */
      }
    }
  }
  for (const t of textes) {
    try {
      const parsed = JSON.parse(t) as unknown;
      const lot = (parsed as { batch?: unknown[] }).batch;
      return Array.isArray(lot) ? lot : Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      /* forme suivante */
    }
  }
  return [{ illisible: texte.slice(0, 400) }];
}

/** Une extension PostHog inerte : elle s'enregistre comme le vrai script, et ne fait rien. */
const extensionInerte = `(function () {
  var e = (window.__PosthogExtensions__ = window.__PosthogExtensions__ || {});
  var rien = function () {};
  var faux = function () { return { loadIfEnabled: rien, start: rien, stop: rien, onRemoteConfig: rien, reset: rien, capture: rien }; };
  e.generateSurveys = e.generateSurveys || faux;
  e.initSurveys = e.initSurveys || faux;
  e.parseErrorAsProperties = e.parseErrorAsProperties || function () { return {}; };
  e.errorWrappingFunctions = e.errorWrappingFunctions || { wrapOnError: rien, wrapUnhandledRejection: rien, wrapConsoleError: rien };
  e.initWebVitals = e.initWebVitals || faux;
  e.tracingHeadersPatchFns = e.tracingHeadersPatchFns || { _patchFetch: rien, _patchXHR: rien };
  e.postHogWebVitalsCallbacks = e.postHogWebVitalsCallbacks || {};
  e.rrweb = e.rrweb || { record: rien, version: "inerte" };
  e.rrwebPlugins = e.rrwebPlugins || {};
  e.canRecordCanvas = e.canRecordCanvas || function () { return false; };
})();`;

const json = (reponse: ServerResponse, corps: unknown) => {
  reponse.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
  });
  reponse.end(JSON.stringify(corps));
};

createServer((requete, reponse) => {
  const url = requete.url ?? "/";
  if (requete.method === "OPTIONS") {
    reponse.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    });
    return reponse.end();
  }
  const morceaux: Buffer[] = [];
  requete.on("data", (m: Buffer) => morceaux.push(m));
  requete.on("end", () => {
    const corps = Buffer.concat(morceaux);
    // La configuration en JavaScript : on la refuse, le SDK retombe sur la variante JSON.
    if (/\/array\/[^/]+\/config\.js/.test(url)) {
      reponse.writeHead(404, { "access-control-allow-origin": "*" });
      return reponse.end("");
    }
    const cle = /\/array\/([^/]+)\/config/.exec(url);
    if (cle) return json(reponse, configuration(cle[1]));
    if (/^\/flags/.test(url) || /^\/decide/.test(url)) return json(reponse, drapeaux);
    if (/\.js(\?|$)/.test(url)) {
      reponse.writeHead(200, { "content-type": "text/javascript", "access-control-allow-origin": "*" });
      // Les « extensions » que le SDK va chercher en JavaScript (sondages, capture d'exceptions…).
      // Un corps VIDE les fait échouer, et cet échec casse la fin de `init()` : plus aucun
      // événement n'est alors capturé — on croirait la mesure silencieuse alors que c'est le faux
      // collecteur qui l'a cassée. On rend donc des extensions inertes, mais bien formées.
      return reponse.end(extensionInerte);
    }
    if (corps.length) {
      for (const evenement of lireLeCorps(corps, String(requete.headers["content-type"] ?? ""))) {
        appendFileSync(SORTIE, `${JSON.stringify({ url, evenement })}\n`);
      }
    }
    return json(reponse, { status: 1 });
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`collecteur d'audience : http://127.0.0.1:${PORT} → ${SORTIE}`);
});
