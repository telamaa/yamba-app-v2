import redis from "../../packages/libs/redis";
(async () => {
  const cles = await redis.keys("yamba:alerts:sent:*");
  console.log(cles.length, "verrou(s) :");
  for (const k of cles.sort()) console.log("  ", k, "| TTL", await redis.ttl(k), "s");
  if (process.argv[2] === "--purge") { for (const k of cles) await redis.del(k); console.log("purgés"); }
  process.exit(0);
})();
