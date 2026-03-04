// apps/user-ui/src/lib/googlePlaces.ts
let scriptPromise: Promise<void> | null = null;
let placesPromise: Promise<google.maps.PlacesLibrary> | null = null;

function loadGoogleMapsScript(opts?: { language?: string; region?: string }): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps must load in the browser"));
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  if (window.google?.maps) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Google Maps script failed")));
        return;
      }

      const language = opts?.language ?? "fr";
      const region = opts?.region ?? "FR";

      const script = document.createElement("script");
      script.dataset.googleMaps = "true";
      script.async = true;
      script.defer = true;

      // ✅ loading=async pour éviter le warning perf
      // ✅ libraries=places OK même si on utilise importLibrary("places")
      script.src =
        "https://maps.googleapis.com/maps/api/js" +
        `?key=${encodeURIComponent(apiKey)}` +
        `&v=weekly` +
        `&loading=async` +
        `&libraries=places` +
        `&language=${encodeURIComponent(language)}` +
        `&region=${encodeURIComponent(region)}`;

      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps script failed to load"));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

export async function loadPlacesLibrary(opts?: { language?: string; region?: string }) {
  await loadGoogleMapsScript(opts);

  if (!placesPromise) {
    placesPromise = google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>;
  }

  return placesPromise;
}
