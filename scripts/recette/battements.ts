/** Lit les battements de cron (cahier n° 4, §2.5). Usage : npx tsx --env-file=.env scripts/recette/battements.ts */
import redis from "../../packages/libs/redis";
import { listCronRuns } from "../../packages/libs/redis/cron-heartbeat";

(async () => {
  const runs = await listCronRuns(redis);
  runs.sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name));
  console.log(`${runs.length} battement(s)\n`);
  for (const r of runs) {
    const age = Math.round((Date.now() - new Date(r.ranAt).getTime()) / 60000);
    console.log(`${r.ok ? "OK " : "KO "} ${(r.service + ":" + r.name).padEnd(38)} il y a ${String(age).padStart(4)} min  (${(r.schedule ?? "?").padEnd(12)}) ${r.summary ?? r.error ?? ""}`);
  }
  process.exit(0);
})();
