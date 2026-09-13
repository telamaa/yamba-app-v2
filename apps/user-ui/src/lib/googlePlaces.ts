// apps/user-ui/src/lib/googlePlaces.ts
let scriptPromise: Promise<void> | null = null;
let placesPromise: Promise<google.maps.PlacesLibrary> | null = null;

/**
 * Le nom du rappel que le chargeur Google appelle une fois `google.maps.importLibrary` PRÊT.
 *
 * Recette 01-WEB 5.1 (WEB-ACC-9, 10/09/2026) : avec `loading=async`, l'événement `load` du
 * <script> arrive AVANT que `google.maps.importLibrary` existe — la toute première requête de
 * suggestions d'une page échouait donc en silence (« importLibrary is not a function »), et
 * l'utilisateur qui tapait « Paris » d'une traite ne voyait rien tant qu'il ne frappait pas une
 * lettre de plus. Le contrat de Google pour `loading=async` est le paramètre `callback=` :
 * c'est lui qui dit « prêt », pas `onload`.
 */
const READY_CALLBACK = "__yambaGoogleMapsReady";

function importLibraryReady(): boolean {
  return typeof window !== "undefined" && typeof window.google?.maps?.importLibrary === "function";
}

function loadGoogleMapsScript(opts?: { language?: string; region?: string }): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps must load in the browser"));
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  if (importLibraryReady()) return Promise.resolve();

  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps="true"]');
      if (existing) {
        // Un chargeur déjà posé (autre instance, rechargement à chaud) : on attend que
        // `importLibrary` soit là, pas l'événement `load` du script.
        const attendre = (restant: number) => {
          if (importLibraryReady()) return resolve();
          if (restant <= 0) return reject(new Error("Google Maps script failed"));
          setTimeout(() => attendre(restant - 1), 100);
        };
        existing.addEventListener("error", () => reject(new Error("Google Maps script failed")));
        attendre(150); // 15 s
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
        `&region=${encodeURIComponent(region)}` +
        `&callback=${READY_CALLBACK}`;

      (window as unknown as Record<string, unknown>)[READY_CALLBACK] = () => resolve();
      script.onerror = () => {
        scriptPromise = null; // un prochain appel retentera
        reject(new Error("Google Maps script failed to load"));
      };
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
