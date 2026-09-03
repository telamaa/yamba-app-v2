"use client";

/**
 * FavoriteButton — le cœur (D46, A59)
 * ===================================
 * Reflète `isFavorite` servi par l'API et bascule de façon optimiste
 * (useToggleFavorite). Visiteur → porte d'identité EN MODALE (AuthGateModal,
 * A60) « Connecte-toi pour enregistrer un favori », retour sur la page
 * courante. Les refus serveur (propre trajet, trajet non publié) sont
 * traduits depuis `details.code` et annulent la bascule.
 *
 * Posé DANS une carte-lien : stopPropagation + preventDefault pour ne pas
 * ouvrir le trajet au clic sur le cœur.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { usePathname } from "@/i18n/navigation";
import useUser from "@/hooks/useUser";
import { useToggleFavorite } from "@/hooks/useFavoriteMutations";
import { getApiErrorData } from "@/services/auth.api";
import AuthGateModal from "@/components/auth/shared/AuthGateModal";

type Props = {
  tripId: string;
  isFavorite: boolean | undefined;
  /** `card` = rond compact sur une carte ; `detail` = pilule avec libellé */
  variant?: "card" | "detail";
  className?: string;
};

export default function FavoriteButton({ tripId, isFavorite, variant = "card", className = "" }: Props) {
  const t = useTranslations("favorites.button");
  const tGate = useTranslations("common.authGate.favorite");
  const pathname = usePathname();
  const { user, isLoading: userLoading } = useUser();
  const toggle = useToggleFavorite();
  const [gateOpen, setGateOpen] = useState(false);


  const active = !!isFavorite;
  const label = active ? t("remove") : t("add");

  const failWith = (error: unknown) => {
    const details = getApiErrorData(error).details as { type?: string; code?: string } | undefined;
    if (details?.type === "favorite" && details.code === "OWN_TRIP") toast.error(t("ownTrip"));
    else if (details?.type === "favorite" && details.code === "TRIP_NOT_FAVORITABLE") toast.error(t("notFavoritable"));
    else toast.error(t("error"));
  };

  const gate = (
    <AuthGateModal
      open={gateOpen}
      onCloseAction={() => setGateOpen(false)}
      title={tGate("title")}
      subtitle={tGate("subtitle")}
      redirect={pathname || "/search"}
      onSignedInAction={() => toggle.mutate({ tripId, next: true }, { onError: (error) => failWith(error) })}
    />
  );

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (userLoading || toggle.isPending) return;
    if (!user) {
      setGateOpen(true);
      return;
    }
    toggle.mutate({ tripId, next: !active }, { onError: (error) => failWith(error) });
  };

  const iconClass = active ? "fill-[#FF9900] text-[#FF9900]" : "text-slate-500 dark:text-slate-400";

  if (variant === "detail") {
    return (
      <>
      {gate}
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-label={label}
        title={label}
        className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
          active
            ? "border-[#FF9900]/40 bg-[#FF9900]/10 text-slate-900 dark:text-white"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
        } ${className}`}
      >
        <Heart size={16} className={iconClass} aria-hidden />
        {label}
      </button>
      </>
    );
  }

  return (
    <>
    {gate}
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-slate-200 transition-transform hover:scale-105 active:scale-95 dark:bg-slate-900/90 dark:ring-slate-700 ${className}`}
    >
      <Heart size={16} className={iconClass} aria-hidden />
    </button>
    </>
  );
}
