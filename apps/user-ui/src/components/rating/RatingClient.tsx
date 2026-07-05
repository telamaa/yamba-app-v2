/**
 * RatingClient.tsx
 * ================
 * Orchestrateur du module de notation mutuelle. Charge le contexte
 * (rôle noté déduit du deal), tient le state (étoiles seules requises,
 * pouces en toggle, commentaire), publie, affiche le merci.
 * Utilisé par les DEUX routes : /bookings/[id]/rate et /carrier/deals/[id]/rate.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { getRatingContext, submitRating } from "./rating.api";
import {
  CARRIER_CRITERIA,
  SHIPPER_CRITERIA,
  type CriterionId,
  type CriterionVote,
  type RatingContext,
} from "./rating.types";
import type { CriterionItem } from "./RatingCriteria";
import RatingDesktop from "./RatingDesktop";
import RatingMobile from "./RatingMobile";
import RatingSuccess from "./RatingSuccess";

type Props = {
  dealId: string;
  backPath: string; // où renvoie "Plus tard" / le back (ex: "/bookings/xxx")
};

export default function RatingClient({ dealId, backPath }: Props) {
  const t = useTranslations("rating");
  const isMobile = useIsMobile();
  const router = useRouter();

  const [context, setContext] = useState<RatingContext | null>(null);
  const [stars, setStars] = useState(0);
  const [votes, setVotes] = useState<Partial<Record<CriterionId, CriterionVote>>>({});
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRatingContext(dealId).then((c) => {
      if (!cancelled) setContext(c);
    });
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const handleBack = useCallback(() => {
    router.push(backPath);
  }, [router, backPath]);

  // Toggle : re-cliquer le même pouce le désélectionne
  const handleVote = useCallback((id: CriterionId, vote: CriterionVote) => {
    setVotes((prev) => {
      const next = { ...prev };
      if (next[id] === vote) {
        delete next[id];
      } else {
        next[id] = vote;
      }
      return next;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!context || stars < 1 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitRating(context.dealId, {
        overallStars: stars,
        criteria: votes,
        comment: comment.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      toast.error(t("cta.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  }, [context, stars, votes, comment, isSubmitting, t]);

  if (isMobile === null || !context) return null;

  if (submitted) {
    return (
      <RatingSuccess
        ratedFirstName={context.person.firstName}
        onBackHomeAction={() => router.push("/")}
      />
    );
  }

  const criteria = buildCriteria(context, t);

  const shared = {
    context,
    criteria,
    stars,
    votes,
    comment,
    isSubmitting,
    canPublish: stars >= 1,
    onBackAction: handleBack,
    onStarsAction: setStars,
    onVoteAction: handleVote,
    onCommentAction: setComment,
    onPublishAction: handlePublish,
  };

  return isMobile ? <RatingMobile {...shared} /> : <RatingDesktop {...shared} />;
}

/**
 * Construit les critères avec libellés traduits — clés STATIQUES uniquement
 * (le piège t() dynamique est évité par ce mapping explicite).
 */
function buildCriteria(
  context: RatingContext,
  t: ReturnType<typeof useTranslations<"rating">>
): CriterionItem[] {
  const firstName = context.person.firstName;

  if (context.ratedRole === "CARRIER") {
    return CARRIER_CRITERIA.map((id) => {
      switch (id) {
        case "PUNCTUALITY":
          return {
            id,
            name: t("criteria.PUNCTUALITY.name"),
            desc: t("criteria.PUNCTUALITY.descCARRIER", { firstName }),
          };
        case "COMMUNICATION":
          return {
            id,
            name: t("criteria.COMMUNICATION.name"),
            desc: t("criteria.COMMUNICATION.descCARRIER"),
          };
        case "PARCEL_CARE":
          return {
            id,
            name: t("criteria.PARCEL_CARE.name"),
            desc: t("criteria.PARCEL_CARE.descCARRIER"),
          };
      }
    });
  }

  return SHIPPER_CRITERIA.map((id) => {
    switch (id) {
      case "DECLARATION_CLARITY":
        return {
          id,
          name: t("criteria.DECLARATION_CLARITY.name"),
          desc: t("criteria.DECLARATION_CLARITY.descSHIPPER"),
        };
      case "RESPONSIVENESS":
        return {
          id,
          name: t("criteria.RESPONSIVENESS.name"),
          desc: t("criteria.RESPONSIVENESS.descSHIPPER", { firstName }),
        };
      case "PUNCTUALITY":
        return {
          id,
          name: t("criteria.PUNCTUALITY.name"),
          desc: t("criteria.PUNCTUALITY.descSHIPPER", { firstName }),
        };
    }
  });
}

export type RatingViewProps = {
  context: RatingContext;
  criteria: CriterionItem[];
  stars: number;
  votes: Partial<Record<CriterionId, CriterionVote>>;
  comment: string;
  isSubmitting: boolean;
  canPublish: boolean;
  onBackAction: () => void;
  onStarsAction: (stars: number) => void;
  onVoteAction: (id: CriterionId, vote: CriterionVote) => void;
  onCommentAction: (value: string) => void;
  onPublishAction: () => void;
};
