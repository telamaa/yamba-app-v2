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
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const { exclude = [], version = 1 } = options;
  const storageKey = `${PREFIX}${key}`;

  const stateRef = useRef<T>(initialValue);

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const raw = sessionStorage.getItem(storageKey);
      const stored = safeParse<T>(raw);

      if (!stored) return initialValue;

      // Si la version ne correspond plus, on ignore les données stockées
      if (stored.version !== version) {
        sessionStorage.removeItem(storageKey);
        return initialValue;
      }

      // Merger avec initialValue pour garder les champs exclus
      // et récupérer les défauts pour les nouveaux champs
      return { ...initialValue, ...stored.data };
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Sauvegarder dans sessionStorage à chaque changement
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const toStore = stripExcluded(state, exclude);
      const payload: StoredState<T> = { version, data: toStore };
      sessionStorage.setItem(storageKey, safeStringify(payload));
    } catch {
      // sessionStorage peut échouer (mode privé, quota, etc.) — silencieux
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, storageKey, version]);

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(storageKey);
    }
    setState(initialValue);
  }, [storageKey, initialValue]);

  return [state, setState, clear];
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
