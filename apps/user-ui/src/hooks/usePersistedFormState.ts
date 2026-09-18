"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook pour persister le state d'un formulaire dans sessionStorage.
 *
 * Le formulaire est automatiquement restauré après:
 *  - Un changement de langue (navigation avec LocaleSwitcher)
 *  - Un rafraîchissement de page (F5)
 *  - Une navigation arrière puis avant
 *
 * Les données sont scopées à l'onglet (sessionStorage) et disparaissent
 * quand l'utilisateur ferme l'onglet/le navigateur.
 *
 * Types natifs JSON pris en charge:
 *   string, number, boolean, null, array, object
 *
 * Types avancés préservés automatiquement via marqueurs:
 *   - Date (restauré en Date, pas en string)
 *   - Map (restauré en Map, pas en objet)
 *   - Set (restauré en Set, pas en array)
 *   - BigInt (restauré en bigint, pas en string)
 *
 * Types NON supportés (à exclure via `exclude`):
 *   - File, FileList, Blob, ArrayBuffer (non sérialisables)
 *   - Fonctions, classes custom, RegExp
 *   - Références circulaires
 *
 * Les données sensibles (mots de passe, CB, etc.) doivent être
 * explicitement exclues via le paramètre `exclude`.
 *
 * @example
 * const [draft, setDraft, clear] = usePersistedFormState(
 *   "create-trip-wizard",
 *   initialDraft,
 *   {
 *     exclude: ["tripDocuments"],  // Files non sérialisables
 *     version: 1,                  // bump si la structure change
 *   }
 * );
 */

type Options<T> = {
  /** Clés de l'objet T à NE PAS persister (mots de passe, Files, etc.) */
  exclude?: (keyof T)[];
  /** Version du schéma. Si elle change, le state stocké est ignoré. */
  version?: number;
};

type StoredState<T> = {
  version: number;
  data: Partial<T>;
};

const PREFIX = "yamba:form:";

// ── Marqueurs de sérialisation pour les types non-JSON ──
const DATE_MARKER = "__yamba_date__";
const MAP_MARKER = "__yamba_map__";
const SET_MARKER = "__yamba_set__";
const BIGINT_MARKER = "__yamba_bigint__";

/**
 * Remplace les types non-JSON par des marqueurs JSON-safe avant le stringify.
 *
 * Cette fonction est appelée récursivement par JSON.stringify pour chaque
 * valeur de l'arbre.
 */
function replacer(this: any, key: string, value: unknown): unknown {
  // La valeur brute (avant les transformations automatiques de JSON)
  // Pour les Dates, JSON.stringify applique déjà toISOString() avant replacer,
  // on la récupère depuis `this[key]` pour avoir la Date originale.
  const rawValue = this[key];

  if (rawValue instanceof Date) {
    return { [DATE_MARKER]: rawValue.toISOString() };
  }

  if (rawValue instanceof Map) {
    return { [MAP_MARKER]: Array.from(rawValue.entries()) };
  }

  if (rawValue instanceof Set) {
    return { [SET_MARKER]: Array.from(rawValue.values()) };
  }

  if (typeof rawValue === "bigint") {
    return { [BIGINT_MARKER]: rawValue.toString() };
  }

  return value;
}

/**
 * Restaure les types non-JSON depuis leurs marqueurs après le parse.
 */
function reviver(_key: string, value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  const obj = value as Record<string, unknown>;

  // Date
  if (DATE_MARKER in obj && typeof obj[DATE_MARKER] === "string") {
    const d = new Date(obj[DATE_MARKER] as string);
    return isNaN(d.getTime()) ? undefined : d;
  }

  // Map
  if (MAP_MARKER in obj && Array.isArray(obj[MAP_MARKER])) {
    try {
      return new Map(obj[MAP_MARKER] as [unknown, unknown][]);
    } catch {
      return new Map();
    }
  }

  // Set
  if (SET_MARKER in obj && Array.isArray(obj[SET_MARKER])) {
    try {
      return new Set(obj[SET_MARKER] as unknown[]);
    } catch {
      return new Set();
    }
  }

  // BigInt
  if (BIGINT_MARKER in obj && typeof obj[BIGINT_MARKER] === "string") {
    try {
      return BigInt(obj[BIGINT_MARKER] as string);
    } catch {
      return undefined;
    }
  }

  return value;
}

function safeParse<T>(raw: string | null): StoredState<T> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw, reviver);
  } catch {
    return null;
  }
}

function safeStringify<T>(payload: StoredState<T>): string {
  return JSON.stringify(payload, replacer);
}

function stripExcluded<T>(value: T, exclude: (keyof T)[]): Partial<T> {
  if (!exclude.length) return value as Partial<T>;
  const clone = { ...value };
  for (const key of exclude) {
    delete clone[key];
  }
  return clone;
}

export function usePersistedFormState<T extends object>(
  key: string,
  initialValue: T,
  options: Options<T> = {}
): [T, React.Dispatch<React.SetStateAction<T>>, () => void, boolean] {
  const { exclude = [], version = 1 } = options;
  const storageKey = `${PREFIX}${key}`;

  const stateRef = useRef<T>(initialValue);

  /*
   * LE PREMIER RENDU EST TOUJOURS `initialValue` — côté serveur COMME côté client.
   *
   * L'ancienne version lisait sessionStorage dans l'initialiseur du `useState`, derrière un
   * `typeof window === "undefined"` : littéralement la « branche serveur/client » que le message
   * d'erreur de React cite en premier. Dès qu'un brouillon existait, le premier rendu client
   * différait du HTML serveur → « Hydration failed » → React RÉGÉNÈRE tout l'arbre côté client —
   * et recrée au passage le <script> anti-flash du layout, d'où l'avertissement « script tag
   * while rendering » vu en recette le 18/09 (l'erreur d'hydratation en était la cause, le
   * script le symptôme).
   *
   * Le brouillon est donc rechargé APRÈS le montage, dans un effet : premier rendu identique au
   * serveur, hydratation sans écart, puis l'état stocké reprend la main. Le drapeau `hydrated`
   * (4e élément du retour) dit quand c'est fait : les requêtes dérivées d'un brouillon doivent
   * l'attendre, sinon elles partent une première fois avec les valeurs par défaut pour repartir
   * aussitôt avec le brouillon — double appel réseau, et double événement d'audience
   * (`search_performed` s'émet dans la queryFn).
   */
  const [state, setState] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const stored = safeParse<T>(raw);

      if (stored) {
        if (stored.version !== version) {
          // Si la version ne correspond plus, on ignore les données stockées
          sessionStorage.removeItem(storageKey);
        } else {
          // Merger avec l'état courant pour garder les champs exclus
          // et récupérer les défauts pour les nouveaux champs
          setState((courant) => ({ ...courant, ...stored.data }));
        }
      }
    } catch {
      /* stockage illisible : on reste sur l'état initial */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, version]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Sauvegarder dans sessionStorage à chaque changement — mais JAMAIS avant le COMMIT de la
  // relecture ci-dessus. La garde est l'ÉTAT `hydrated`, pas une ref posée dans l'effet : une ref
  // devient vraie dans la même passe d'effets, la sauvegarde s'exécutait donc juste après la
  // relecture et écrasait le brouillon stocké avec l'état initial — et sous StrictMode (double
  // montage des effets en dev), la SECONDE relecture retrouvait ce brouillon écrasé : perdu.
  // Payé le 18/09, mesuré à la sonde (requête partie sans le brouillon).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydrated) return;

    try {
      const toStore = stripExcluded(state, exclude);
      const payload: StoredState<T> = { version, data: toStore };
      sessionStorage.setItem(storageKey, safeStringify(payload));
    } catch {
      // sessionStorage peut échouer (mode privé, quota, etc.) — silencieux
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, storageKey, version, hydrated]);

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(storageKey);
    }
    setState(initialValue);
  }, [storageKey, initialValue]);

  return [state, setState, clear, hydrated];
}

/**
 * Écrit un brouillon SANS passer par le hook — pour préremplir un formulaire
 * depuis un autre écran (ex. : une puce corridor de l'accueil qui prépare la
 * recherche avant d'ouvrir `/search`). Même préfixe, même enveloppe
 * `{version, data}` : le hook relira ce brouillon comme un des siens.
 */
export function seedPersistedFormState<T extends object>(
  key: string,
  data: Partial<T>,
  version = 1
) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredState<T> = { version, data };
    sessionStorage.setItem(`${PREFIX}${key}`, safeStringify(payload));
  } catch {
    // sessionStorage peut échouer (mode privé, quota, etc.) — silencieux
  }
}

/**
 * Helper pour nettoyer TOUS les formulaires persistés.
 * À utiliser par exemple lors du logout.
 */
export function clearAllPersistedForms() {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}
