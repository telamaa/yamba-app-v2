"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Cpu,
  FileText,
  Footprints,
  Laptop,
  MapPin,
  Package,
  Phone,
  Plane,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ToyBrick,
  Train,
  Car,
} from "lucide-react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import {
  ParcelCategory,
  TransportMode,
  YambaTripResult,
} from "./search-results.types";

type Props = {
  item: YambaTripResult;
};

function getTransportMeta(mode: TransportMode, isFr: boolean) {
  switch (mode) {
    case "plane":
      return {
        label: isFr ? "Avion" : "Plane",
        icon: <Plane size={13} />,
      };
    case "train":
      return {
        label: "Train",
        icon: <Train size={13} />,
      };
    case "car":
    default:
      return {
        label: isFr ? "Voiture" : "Car",
        icon: <Car size={13} />,
      };
  }
}

function getCategoryMeta(category: ParcelCategory, isFr: boolean) {
  switch (category) {
    case "clothes":
      return {
        label: isFr ? "Vêtements" : "Clothes",
        icon: <Shirt size={13} />,
      };
    case "shoes":
      return {
        label: isFr ? "Chaussures" : "Shoes",
        icon: <Footprints size={13} />,
      };
    case "fashion-accessories":
      return {
        label: isFr ? "Accessoires de mode" : "Fashion accessories",
        icon: <ShoppingBag size={13} />,
      };
    case "other-accessories":
      return {
        label: isFr ? "Autres Accessoires" : "Other accessories",
        icon: <Package size={13} />,
      };
    case "books":
      return {
        label: isFr ? "Livres" : "Books",
        icon: <BookOpen size={13} />,
      };
    case "documents":
      return {
        label: isFr ? "Documents" : "Documents",
        icon: <FileText size={13} />,
      };
    case "small-toys":
      return {
        label: isFr ? "Petits jouets" : "Small toys",
        icon: <ToyBrick size={13} />,
      };
    case "phone":
      return {
        label: isFr ? "Téléphone" : "Phone",
        icon: <Phone size={13} />,
      };
    case "computer":
      return {
        label: isFr ? "Ordinateur" : "Computer",
        icon: <Laptop size={13} />,
      };
    case "other-electronics":
      return {
        label: isFr ? "Autres electronique" : "Other electronics",
        icon: <Cpu size={13} />,
      };
    case "checked-bag-23kg":
      return {
        label: isFr ? "Valise soute 23 Kg" : "Checked bag 23 kg",
        icon: <Briefcase size={13} />,
      };
    case "cabin-bag-12kg":
    default:
      return {
        label: isFr ? "Valise Cabine 12 Kg" : "Cabin bag 12 kg",
        icon: <Briefcase size={13} />,
      };
  }
}

export default function YambaTripResultCard({ item }: Props) {
  const { lang } = useUiPreferences();
  const isFr = lang === "fr";

  const [avatarError, setAvatarError] = useState(false);
  const showAvatarImage = !!item.travelerAvatarUrl && !avatarError;

  const travelerInitials = `${item.travelerFirstName?.slice(0, 1).toUpperCase() ?? "Y"}${
    item.travelerLastName?.slice(0, 1).toUpperCase() ?? ""
  }`;

  const routeWrapRef = useRef<HTMLDivElement | null>(null);
  const fromLineRef = useRef<HTMLDivElement | null>(null);
  const toLineRef = useRef<HTMLDivElement | null>(null);
  const [arrowLeft, setArrowLeft] = useState<number | null>(null);

  const transport = useMemo(
    () => getTransportMeta(item.transportMode, isFr),
    [item.transportMode, isFr]
  );

  const labels = useMemo(
    () => ({
      from: isFr ? "Départ" : "From",
      to: isFr ? "Arrivée" : "To",
      startingFrom: isFr ? "À partir de" : "Starting from",
      allowed: isFr ? "Colis autorisés" : "Allowed parcels",
    }),
    [isFr]
  );

  useEffect(() => {
    const updateArrowPosition = () => {
      if (!routeWrapRef.current || !fromLineRef.current || !toLineRef.current) return;

      const wrapRect = routeWrapRef.current.getBoundingClientRect();
      const fromRect = fromLineRef.current.getBoundingClientRect();
      const toRect = toLineRef.current.getBoundingClientRect();

      const middleBetweenVisibleLines =
        (fromRect.right + toRect.left) / 2 - wrapRect.left;

      setArrowLeft(middleBetweenVisibleLines);
    };

    updateArrowPosition();

    const resizeObserver = new ResizeObserver(() => {
      updateArrowPosition();
    });

    if (routeWrapRef.current) resizeObserver.observe(routeWrapRef.current);
    if (fromLineRef.current) resizeObserver.observe(fromLineRef.current);
    if (toLineRef.current) resizeObserver.observe(toLineRef.current);

    window.addEventListener("resize", updateArrowPosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateArrowPosition);
    };
  }, [item.fromCity, item.toCity]);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-[#FF9900]/35 hover:bg-[#FFFDF8] hover:shadow-[0_10px_30px_rgba(255,153,0,0.10)] dark:border-slate-800 dark:bg-slate-950 dark:hover:border-[#FF9900]/25 dark:hover:bg-slate-900/80">
      <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {transport.icon}
              {transport.label}
            </span>
            <span className="text-slate-500 dark:text-slate-400">{item.travelDate}</span>
          </div>

          <div
            ref={routeWrapRef}
            className="relative mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2"
          >
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {labels.from}
              </div>
              <div
                ref={fromLineRef}
                className="mt-0.5 inline-flex max-w-full items-center gap-1 text-sm font-bold text-slate-950 dark:text-white"
              >
                <MapPin size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{item.fromCity}</span>
              </div>
            </div>

            <div aria-hidden className="w-20" />

            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {labels.to}
              </div>
              <div
                ref={toLineRef}
                className="mt-0.5 inline-flex max-w-full items-center gap-1 text-sm font-bold text-slate-950 dark:text-white"
              >
                <MapPin size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{item.toCity}</span>
              </div>
            </div>

            {arrowLeft !== null && (
              <div
                className="pointer-events-none absolute top-1/2 flex w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1.5 text-slate-400"
                style={{ left: `${arrowLeft}px` }}
              >
                <div className="h-px w-4 bg-slate-300 dark:bg-slate-700" />
                <ArrowRight size={12} className="shrink-0" />
                <div className="h-px w-4 bg-slate-300 dark:bg-slate-700" />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {(item.travelerFirstName || item.travelerAvatarUrl) && (
              <div className="inline-flex items-center gap-2">
                <div className="relative h-11 w-11 shrink-0">
                  {item.superTripper && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-[repeating-conic-gradient(#FF9900_0deg_14deg,transparent_14deg_28deg)] opacity-90" />
                      <span className="absolute inset-[3px] rounded-full bg-white dark:bg-slate-950" />
                    </>
                  )}

                  <div
                    className={[
                      "absolute overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900",
                      item.superTripper ? "inset-[4px]" : "inset-0",
                      item.profileVerified || item.superTripper
                        ? "border-2 border-[#FF9900]"
                        : "border-2 border-slate-300 dark:border-slate-700",
                    ].join(" ")}
                  >
                    {showAvatarImage ? (
                      <Image
                        src={item.travelerAvatarUrl!}
                        alt={item.travelerFirstName ?? "Traveler"}
                        fill
                        className="object-cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-slate-100 text-[10px] font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {travelerInitials}
                      </div>
                    )}
                  </div>

                  {item.profileVerified && (
                    <div className="absolute -bottom-[2px] -right-[2px] z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-[#FF9900] text-slate-900 shadow-sm dark:border-slate-950">
                      <ShieldCheck size={11} className="stroke-[2.4]" />
                    </div>
                  )}
                </div>

                {item.travelerFirstName && (
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {item.travelerFirstName}
                    {item.travelerLastName
                      ? ` ${item.travelerLastName.slice(0, 1).toUpperCase()}.`
                      : ""}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {labels.allowed}
              </span>

              {item.allowedCategories.map((category) => {
                const meta = getCategoryMeta(category, isFr);

                return (
                  <span
                    key={category}
                    title={meta.label}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {meta.icon}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4 md:block md:text-right">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {labels.startingFrom}
            </div>
            <div className="mt-0.5 text-[20px] font-extrabold tracking-tight text-slate-950 dark:text-white">
              {item.minPrice.toFixed(2).replace(".", ",")} {item.currency ?? "€"}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
