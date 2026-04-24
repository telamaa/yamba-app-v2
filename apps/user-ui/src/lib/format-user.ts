/**
 * format-user.ts
 * ===============
 * Shared utilities for formatting user names and initials.
 * Used in Header, Dashboard Home, and anywhere user info is displayed.
 *
 * 📁 Place in: apps/user-ui/src/lib/format-user.ts
 */

/**
 * Returns initials from first + last name.
 * "Enrique" + "Goio" → "EG"
 * "Enrique" + undefined → "E"
 */
export function getUserInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim().charAt(0).toUpperCase() ?? "";
  const last = lastName?.trim().charAt(0).toUpperCase() ?? "";
  return `${first}${last}` || "U";
}

/**
 * Formats display name: Prénom (capitalized) + NOM (uppercase).
 * "enrique" + "goio" → "Enrique GOIO"
 */
export function formatDisplayName(firstName?: string | null, lastName?: string | null): string {
  const first = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : "";
  const last = lastName ? lastName.toUpperCase() : "";
  return `${first} ${last}`.trim() || "—";
}
