// apps/user-ui/src/lib/googleMaps.ts
import { importLibrary, setOptions, type APIOptions } from "@googlemaps/js-api-loader";

let configured = false;
let placesReady: Promise<void> | null = null;

function configureOnce() {
  if (configured) return;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");

  const options: APIOptions = {
    key: apiKey,
    v: "weekly",
    libraries: ["places"],
    // optionnel (tu peux laisser vide)
    language: "fr",
    region: "FR",
  };

  setOptions(options);
  configured = true;
}

export async function ensurePlacesLoaded(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Google Maps loader must run in the browser");

  configureOnce();

  if (!placesReady) {
    placesReady = (importLibrary("places") as Promise<google.maps.PlacesLibrary>).then(() => {
      // important : assure que google.maps.places est prêt
    });
  }

  return placesReady;
}
