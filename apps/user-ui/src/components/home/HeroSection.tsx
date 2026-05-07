"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import TripSearchBar from "@/components/search/TripSearchBar";
import HeroSectionSkeleton from "@/components/home/skeleton/HeroSectionSkeleton";

const SKELETON_DURATION = 300;

type HeroImage = {
  src: string;
  alt: string;
};

const HERO_IMAGES: HeroImage[] = [
  {
    src: "/assets/images/hero/yamba-hero-1.jpg",
    alt: "Voyageur consultant son téléphone à l'aéroport",
  },
  {
    src: "/assets/images/hero/yamba-hero-2.jpg",
    alt: "Voyageuse souriante en gare avec ses bagages",
  },
  {
    src: "/assets/images/hero/yamba-hero-3.jpg",
    alt: "Personne planifiant son trajet sur ordinateur",
  },
];

function useRandomHeroImage(): HeroImage {
  const [image, setImage] = useState<HeroImage>(HERO_IMAGES[0]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * HERO_IMAGES.length);
    setImage(HERO_IMAGES[randomIndex]);
  }, []);

  return image;
}

function HeroImage({ image }: { image: HeroImage }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading"
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-white/5">
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-white/5" />
      )}

      {status === "error" && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #FF9900 0%, #FF6B35 50%, #2DD4BF 100%)",
          }}
        />
      )}

      {status !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.src}
          alt={image.alt}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}

      {status === "loaded" && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-slate-950/20 via-transparent to-transparent" />
      )}
    </div>
  );
}

export default function HeroSection() {
  const t = useTranslations("home.hero");
  const [isLoading, setIsLoading] = useState(true);
  const heroImage = useRandomHeroImage();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SKELETON_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <HeroSectionSkeleton />;

  return (
    <section className="yamba-hero-mesh relative overflow-hidden">
      {/* Blobs décoratifs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 -z-0 h-96 w-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #FF9900, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/3 -z-0 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(circle, #2DD4BF, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-8 md:pt-12 lg:pt-14">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-10 lg:gap-12">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-white md:text-3xl lg:text-4xl">
              {t("titleLine1")} {t("titleLine2")}{" "}
              <span className="yamba-grad-text">{t("titleHighlight")}</span>{" "}
              {t("titleEnd")}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-sm text-slate-300 md:mx-0 md:mt-5 md:text-base">
              {t("subtitle")}
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-400 md:mt-6 md:justify-start md:gap-x-6">
              <span>
                <span className="font-bold text-white">
                  {t("stats.rating")}
                </span>{" "}
                · {t("stats.ratingLabel")}
              </span>
              <span>
                <span className="font-bold text-white">
                  {t("stats.users")}
                </span>{" "}
                {t("stats.usersLabel")}
              </span>
              <span>
                <span className="font-bold text-white">
                  {t("stats.cities")}
                </span>{" "}
                {t("stats.citiesLabel")}
              </span>
              <span>
                <span className="font-bold text-white">
                  {t("stats.co2")}
                </span>{" "}
                {t("stats.co2Label")}
              </span>
            </div>
          </div>

          {/* Image (desktop only) */}
          <div className="hidden md:flex md:items-center">
            <div className="relative aspect-[16/9] w-full">
              <HeroImage image={heroImage} />
            </div>
          </div>
        </div>

        {/* Spacer entre hero et search */}
        <div className="h-8 md:h-10" />
      </div>

      {/* Search bar — sticky avec mode auto + disableCompact pour rester en mode expanded */}
      <TripSearchBar mode="auto" stickyOnScroll={true} disableCompact={true} />

      {/* Espace après search avant section suivante */}
      <div className="h-12 md:h-16" />
    </section>
  );
}
