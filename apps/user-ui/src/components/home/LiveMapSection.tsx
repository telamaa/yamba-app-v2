"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import LiveMapSectionSkeleton from "@/components/home/skeleton/LiveMapSectionSkeleton";

const SKELETON_DURATION = 300;

type Trip = {
  from: [number, number];
  to: [number, number];
  fromName: string;
  toName: string;
  mode: string;
  status: "active" | "pending";
};

const TRIPS: Trip[] = [
  { from: [48.8566, 2.3522], to: [50.8503, 4.3517], fromName: "Paris", toName: "Bruxelles", mode: "🚆", status: "active" },
  { from: [45.764, 4.8357], to: [43.2965, 5.3698], fromName: "Lyon", toName: "Marseille", mode: "🚗", status: "active" },
  { from: [48.8566, 2.3522], to: [-4.2634, 15.2429], fromName: "Paris", toName: "Brazzaville", mode: "✈️", status: "pending" },
  { from: [51.5074, -0.1278], to: [52.52, 13.405], fromName: "Londres", toName: "Berlin", mode: "✈️", status: "active" },
  { from: [40.7128, -74.006], to: [45.5017, -73.5673], fromName: "New York", toName: "Montréal", mode: "✈️", status: "active" },
  { from: [25.2048, 55.2708], to: [1.3521, 103.8198], fromName: "Dubaï", toName: "Singapour", mode: "✈️", status: "pending" },
  { from: [33.5731, -7.5898], to: [48.8566, 2.3522], fromName: "Casablanca", toName: "Paris", mode: "✈️", status: "active" },
  { from: [35.6762, 139.6503], to: [1.3521, 103.8198], fromName: "Tokyo", toName: "Singapour", mode: "✈️", status: "pending" },
  { from: [-23.5505, -46.6333], to: [19.4326, -99.1332], fromName: "São Paulo", toName: "Mexico", mode: "✈️", status: "active" },
  { from: [50.6292, 3.0573], to: [48.8566, 2.3522], fromName: "Lille", toName: "Paris", mode: "🚆", status: "active" },
  { from: [14.7167, -17.4677], to: [33.5731, -7.5898], fromName: "Dakar", toName: "Casablanca", mode: "✈️", status: "active" },
];

export default function LiveMapSection() {
  const t = useTranslations("home.liveMap");
  const [isLoading, setIsLoading] = useState(true);
  const [tripCounter, setTripCounter] = useState(47);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  // Skeleton timer
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), SKELETON_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Live counter animation
  useEffect(() => {
    if (isLoading) return;
    const interval = setInterval(() => {
      setTripCounter((prev) => {
        const variation = Math.floor(Math.random() * 3) - 1;
        return Math.max(40, prev + variation);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Init Leaflet map (desktop only)
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth <= 768) return;
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      // await import("leaflet/dist/leaflet.css");

      if (cancelled || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [25, 10],
        zoom: 2,
        minZoom: 2,
        scrollWheelZoom: false,
        zoomControl: true,
        worldCopyJump: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        noWrap: false,
      }).addTo(map);

      TRIPS.forEach((trip) => {
        const color = trip.status === "active" ? "#FF9900" : "#2DD4BF";

        L.polyline([trip.from, trip.to], {
          color,
          weight: 2,
          opacity: 0.6,
          dashArray: trip.status === "pending" ? "6, 8" : undefined,
        }).addTo(map);

        [trip.from, trip.to].forEach((coord) => {
          const icon = L.divIcon({
            className: "custom-div-icon",
            html: `<div class="yamba-marker-pulse" style="width: 12px; height: 12px; background: ${color};"></div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          L.marker(coord, { icon })
            .bindPopup(
              `<div style="padding: 4px;">
                <p style="font-weight: bold; color: white; margin: 0 0 4px 0;">${trip.mode} ${trip.fromName} → ${trip.toName}</p>
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">${
                trip.status === "active" ? t("tripStatus.active") : t("tripStatus.pending")
              }</p>
              </div>`
            )
            .addTo(map);
        });
      });

      mapInstanceRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        // @ts-expect-error - leaflet map has remove method
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isLoading, t]);

  if (isLoading) return <LiveMapSectionSkeleton />;

  return (
    <section className="bg-slate-950 py-14 md:py-20">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FF9900]">
            <span className="yamba-pulse-dot h-1 w-1 rounded-full bg-[#FF9900]" />
            {t("badge")}
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white md:text-4xl">
            {t("titleLine1")}{" "}
            <span className="yamba-grad-text">{t("titleHighlight")}</span>
            {t("titleEnd")}
          </h2>
          <p className="mt-3 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        {/* Desktop : Leaflet map */}
        <div className="relative hidden md:block">
          <div
            ref={mapContainerRef}
            className="h-[440px] overflow-hidden rounded-[20px]"
            style={{ zIndex: 1 }}
          />
          <div className="absolute left-4 top-4 z-[1000] flex flex-col gap-1.5">
            <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-xl">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                {t("stats.activeTrips")}
              </p>
              <p className="text-lg font-bold text-white">{tripCounter}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 backdrop-blur-xl">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                {t("stats.inTransit")}
              </p>
              <p className="text-lg font-bold text-[#FF9900]">128</p>
            </div>
          </div>
        </div>

        {/* Mobile : stats cards */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-center backdrop-blur-xl">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t("stats.activeTrips")}
            </p>
            <p className="text-4xl font-extrabold text-white">{tripCounter}</p>
            <p className="mt-2 text-xs text-slate-400">{t("mobileStats.activeTripsLabel")}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-center backdrop-blur-xl">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t("stats.inTransit")}
            </p>
            <p className="text-4xl font-extrabold text-[#FF9900]">128</p>
            <p className="mt-2 text-xs text-slate-400">{t("mobileStats.inTransitLabel")}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-gradient-to-br from-orange-500/10 to-teal-500/10 p-5 text-center">
            <p className="text-3xl">🌍</p>
            <p className="mt-2 text-base font-bold text-white">{t("mobileStats.globalTitle")}</p>
            <p className="mt-1 text-xs text-slate-400">{t("mobileStats.globalSubtitle")}</p>
          </div>
        </div>

        {/* CTA contextuel */}
        <div className="mt-6 text-center">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF9900] transition-colors hover:text-[#FFB84D]"
          >
            {t("viewAll")}
            <span>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
