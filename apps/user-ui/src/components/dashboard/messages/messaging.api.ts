/**
 * messaging.api.ts — couche API du chat (chantier F, D61)
 * ========================================================
 * Backend : message-service (port 6005) via le gateway, sous /messages/*.
 * Frontière stable (D61) : le jour où ce service change de forme, ces chemins ne bougent pas.
 */
import apiClient from "@/lib/api-client";
import type { ChatMessage, ConversationList, ConversationThread, Meetup, QuickReply } from "./messaging.types";

export async function getConversations(): Promise<ConversationList> {
  const res = await apiClient.get<ConversationList>("/messages/conversations", { requireAuth: true });
  return res.data;
}

export async function getThread(conversationId: string, cursor?: string): Promise<ConversationThread> {
  const res = await apiClient.get<ConversationThread>(`/messages/conversations/${conversationId}`, {
    requireAuth: true,
    params: cursor ? { cursor } : undefined,
  });
  return res.data;
}

/** Ouvre (ou crée) le fil d'un deal : utilisé par les boutons « Message » des écrans de deal. */
export async function getThreadByDeal(bookingId: string): Promise<ConversationThread> {
  const res = await apiClient.get<ConversationThread>(`/messages/conversations/by-deal/${bookingId}`, { requireAuth: true });
  return res.data;
}

export async function postMessage(conversationId: string, body: string, photoUrls?: string[]): Promise<ChatMessage> {
  const res = await apiClient.post<ChatMessage>(`/messages/conversations/${conversationId}/messages`, { body, ...(photoUrls?.length ? { photoUrls } : {}) }, { requireAuth: true });
  return res.data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await apiClient.post(`/messages/conversations/${conversationId}/read`, {}, { requireAuth: true });
}

export type ProposeMeetupInput = { kind: "PICKUP" | "DELIVERY"; placeLabel: string; placeDetails?: string; startAt: string; endAt: string };

export async function proposeMeetup(conversationId: string, input: ProposeMeetupInput): Promise<Meetup> {
  const res = await apiClient.post<Meetup>(`/messages/conversations/${conversationId}/meetups`, input, { requireAuth: true });
  return res.data;
}

export async function acceptMeetup(conversationId: string, meetupId: string): Promise<Meetup> {
  const res = await apiClient.post<Meetup>(`/messages/conversations/${conversationId}/meetups/${meetupId}/accept`, {}, { requireAuth: true });
  return res.data;
}

export async function revealPhone(conversationId: string): Promise<{ phoneE164: string | null; firstName: string; revealedAt: string }> {
  const res = await apiClient.post<{ phoneE164: string | null; firstName: string; revealedAt: string }>(`/messages/conversations/${conversationId}/phone`, {}, { requireAuth: true });
  return res.data;
}

export async function getQuickReplies(): Promise<QuickReply[]> {
  const res = await apiClient.get<{ items: QuickReply[] }>("/messages/quick-replies", { requireAuth: true });
  return res.data.items;
}
