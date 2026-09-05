import type { Metadata } from "next";
import TrackingClient from "./TrackingClient";

/** D69 — page destinataire : publique, sans compte, indexation refusée. */
export const metadata: Metadata = { title: "Yamba — suivi du colis", robots: { index: false, follow: false } };

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TrackingClient token={token} />;
}
