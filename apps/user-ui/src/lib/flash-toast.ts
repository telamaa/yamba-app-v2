/**
 * flash-toast.ts
 * ===============
 * Persist toast messages across page navigations via sessionStorage.
 *
 * 📁 Place in: apps/user-ui/src/lib/flash-toast.ts
 */

const FLASH_KEY = "yamba_flash_toast";

export type FlashType = "success" | "error" | "info" | "onboarding_required";

export type FlashToast = {
  type: FlashType;
  message: string;
  /** If true, toast won't auto-dismiss — requires X to close */
  persistent?: boolean;
};

export function setFlashToast(flash: FlashToast): void {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify(flash));
  } catch {
    /* silent */
  }
}

export function getFlashToast(): FlashToast | null {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw) as FlashToast;
  } catch {
    return null;
  }
}
