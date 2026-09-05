/**
 * message.controller.ts — validation d'entrée et rien d'autre (chantier F, D61)
 * =============================================================================
 * Les règles vivent dans lib/ et services/ ; ici on valide au contrat et on traduit
 * les erreurs. La langue des réponses rapides vient du LECTEUR (D44).
 */
import type { NextFunction, Response } from "express";
import { ValidationError } from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ObjectIdSchema, PostMessageRequestSchema, ProposeMeetupRequestSchema, ReportMessageRequestSchema } from "@packages/api-contracts";
import { quickRepliesFor } from "../lib/quick-replies";
import type { ConversationService } from "../services/conversation.service";

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: Record<string, string> = {};
  for (const i of issues) errors[i.path.map(String).join(".") || "_"] = i.message;
  return errors;
}
function id(raw: unknown, what: string): string {
  const parsed = ObjectIdSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(`Invalid ${what}.`);
  return parsed.data;
}

export function makeMessageController(service: ConversationService) {
  return {
    async quickReplies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const locale = (req.user as { preferredLocale?: string | null } | undefined)?.preferredLocale ?? (req.headers["x-locale"] as string | undefined) ?? null;
        res.status(200).json({ items: quickRepliesFor(locale) });
      } catch (e) {
        next(e);
      }
    },
    /** F-PR3 (D61 7A) — signaler un message de l'autre partie. */
    async reportMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ReportMessageRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid report.", zodErrors(parsed.error.issues));
        res.status(201).json(await service.reportMessage(req.user.id, id(req.params.id, "conversation id"), id(req.params.messageId, "message id"), parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.list(req.user.id));
      } catch (e) {
        next(e);
      }
    },
    async byDeal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.threadByDeal(req.user.id, id(req.params.bookingId, "deal id")));
      } catch (e) {
        next(e);
      }
    },
    async thread(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const cursor = typeof req.query.cursor === "string" && req.query.cursor ? id(req.query.cursor, "cursor") : undefined;
        res.status(200).json(await service.thread(req.user.id, id(req.params.id, "conversation id"), cursor));
      } catch (e) {
        next(e);
      }
    },
    async postMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = PostMessageRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(201).json(await service.postMessage(req.user.id, id(req.params.id, "conversation id"), parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.markRead(req.user.id, id(req.params.id, "conversation id")));
      } catch (e) {
        next(e);
      }
    },
    async proposeMeetup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        const parsed = ProposeMeetupRequestSchema.safeParse(req.body);
        if (!parsed.success) throw new ValidationError("Invalid request", { errors: zodErrors(parsed.error.issues) });
        res.status(201).json(await service.proposeMeetup(req.user.id, id(req.params.id, "conversation id"), parsed.data));
      } catch (e) {
        next(e);
      }
    },
    async acceptMeetup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.acceptMeetup(req.user.id, id(req.params.id, "conversation id"), id(req.params.meetupId, "meeting id")));
      } catch (e) {
        next(e);
      }
    },
    async revealPhone(req: AuthenticatedRequest, res: Response, next: NextFunction) {
      try {
        res.status(200).json(await service.revealPhone(req.user.id, id(req.params.id, "conversation id")));
      } catch (e) {
        next(e);
      }
    },
  };
}
