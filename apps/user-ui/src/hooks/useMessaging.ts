/**
 * useMessaging.ts — le chat côté client (chantier F, D61)
 * ========================================================
 * Pas de temps réel tant que le volume ne l'exige pas (D61) : un sondage COURT quand une
 * conversation est ouverte (3 s), un sondage lent sur la liste (20 s), rien en arrière-plan.
 * Le jour où les seuils gravés sont atteints, seul ce fichier change : les composants lisent
 * déjà un état, pas un transport.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  acceptMeetup,
  getConversations,
  getQuickReplies,
  getThread,
  getThreadByDeal,
  markConversationRead,
  postMessage,
  proposeMeetup,
  reportMessage,
  revealPhone,
  type ProposeMeetupInput,
  type ReportMessageInput,
} from "@/components/dashboard/messages/messaging.api";

export const CONVERSATIONS_QUERY_KEY = ["me", "conversations"] as const;
export const threadQueryKey = (id: string) => ["me", "conversations", id] as const;

/** Liste des fils : sondage lent, suffisant pour un badge et une liste. */
export function useConversations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: CONVERSATIONS_QUERY_KEY,
    queryFn: getConversations,
    enabled: options?.enabled ?? true,
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/** Fil ouvert : sondage court. `active` coupe le sondage quand la vue n'est pas visible. */
export function useThread(conversationId: string | null, options?: { active?: boolean }) {
  return useQuery({
    queryKey: threadQueryKey(conversationId ?? "none"),
    queryFn: () => getThread(conversationId as string),
    enabled: !!conversationId,
    staleTime: 1_000,
    refetchInterval: options?.active === false ? false : 3_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useQuickReplies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["me", "quick-replies"],
    queryFn: getQuickReplies,
    enabled: options?.enabled ?? true,
    staleTime: 60 * 60_000, // un catalogue, pas une donnée vivante
  });
}

/** Invalide le fil ET la liste : le dernier message et les non-lus vivent aux deux endroits. */
function useRefreshBoth(conversationId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: threadQueryKey(conversationId) });
    void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
  };
}

export function usePostMessage(conversationId: string) {
  const refresh = useRefreshBoth(conversationId);
  return useMutation({
    mutationFn: (input: { body: string; photoUrls?: string[] }) => postMessage(conversationId, input.body, input.photoUrls),
    onSuccess: refresh,
  });
}

export function useMarkConversationRead(conversationId: string) {
  const refresh = useRefreshBoth(conversationId);
  return useMutation({ mutationFn: () => markConversationRead(conversationId), onSuccess: refresh });
}

export function useProposeMeetup(conversationId: string) {
  const refresh = useRefreshBoth(conversationId);
  return useMutation({ mutationFn: (input: ProposeMeetupInput) => proposeMeetup(conversationId, input), onSuccess: refresh });
}

export function useAcceptMeetup(conversationId: string) {
  const refresh = useRefreshBoth(conversationId);
  return useMutation({ mutationFn: (meetupId: string) => acceptMeetup(conversationId, meetupId), onSuccess: refresh });
}

/** F-PR3 (D61 7A) — signaler un message : rien à rafraîchir, le fil ne change pas. */
export function useReportMessage(conversationId: string) {
  return useMutation({ mutationFn: (input: { messageId: string } & ReportMessageInput) => reportMessage(conversationId, input.messageId, { reason: input.reason, details: input.details }) });
}

export function useRevealPhone(conversationId: string) {
  const refresh = useRefreshBoth(conversationId);
  return useMutation({ mutationFn: () => revealPhone(conversationId), onSuccess: refresh });
}

/**
 * Point d'entrée depuis un écran de deal (A137) : ouvre — ou crée — le fil du deal puis
 * navigue vers la messagerie avec `?conversation=<id>`. Le fil reçu est déposé dans le cache
 * pour que la conversation s'affiche sans second aller-retour. `focus: "phone"` sert aux
 * boutons « Appeler » : la messagerie met alors le numéro (ou son heure d'ouverture) en avant,
 * car c'est LE serveur qui décide quand un numéro se voit (D61 3A), jamais un bouton.
 * En cas de refus (deal pas encore accepté, pas partie au deal), on reste sur la page et on
 * explique — un bouton qui ne fait rien est pire qu'un message d'erreur.
 */
export type OpenDealThreadFocus = "phone";

export function useOpenDealThread() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations("messaging");
  const mutation = useMutation({
    mutationFn: async (input: { bookingId: string; focus?: OpenDealThreadFocus }) => ({
      thread: await getThreadByDeal(input.bookingId),
      focus: input.focus,
    }),
    onSuccess: ({ thread, focus }) => {
      queryClient.setQueryData(threadQueryKey(thread.conversation.id), thread);
      const params = new URLSearchParams({ conversation: thread.conversation.id });
      if (focus) params.set("focus", focus);
      router.push(`/dashboard/messages?${params.toString()}`);
    },
    onError: (err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast({ type: "error", message: status === 403 ? t("open.notOpenYet") : t("open.failed") });
    },
  });
  return {
    open: (bookingId: string, focus?: OpenDealThreadFocus) => mutation.mutate({ bookingId, focus }),
    isPending: mutation.isPending,
  };
}
