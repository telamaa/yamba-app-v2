/**
 * Lève le verrou anti-spam OTP d'un compte (6 codes par heure, 1 minute entre deux — `auth.helper.ts`).
 * Manœuvre de RECETTE uniquement : elle sert à rejouer une fiche plusieurs fois dans la même heure ;
 * une campagne qui ne joue la fiche qu'une fois n'en a jamais besoin.
 */
import redis from "../../packages/libs/redis";
const SCOPES = ["signup", "login", "reset", "sudo", "email_change"];
(async () => {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("usage : otp-debloquer.ts <email>");
  const cles = SCOPES.flatMap((s) => [`otp:${s}:${email}`, `otp_cooldown:${s}:${email}`, `otp_spam_lock:${s}:${email}`, `otp_lock:${s}:${email}`, `otp_attempts:${s}:${email}`, `otp_request_count:${s}:${email}`, `otp_security_alerted:${s}:${email}`]);
  const supprimees = await redis.del(...cles);
  console.log(JSON.stringify({ email, clesSupprimees: supprimees }));
  process.exit(0);
})();
