/** D70 2A — santé du front (un Next.js tombé alors que l'API vit est une panne pour l'utilisateur). */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ status: "ok", app: "user-ui", at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
