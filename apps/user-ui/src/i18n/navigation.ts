import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Wrappers autour des helpers de navigation Next.js.
 * Ces composants/hooks gardent automatiquement la locale actuelle
 * dans les URLs.
 *
 * Usage:
 *   import { Link, useRouter, usePathname } from '@/i18n/navigation';
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
