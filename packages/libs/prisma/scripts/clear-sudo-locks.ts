import redis from "../../redis/index";
const email = (process.argv[2] ?? "aminata.shipper@seed.yamba.dev").toLowerCase();
(async () => {
  const keys = ["otp_spam_lock", "otp_cooldown", "otp_request_count", "otp_lock"].map((k) => `${k}:sudo:${email}`);
  const n = await redis.del(...keys);
  console.log(`verrous sudo supprimés pour ${email} : ${n}`);
  await redis.quit();
})();
