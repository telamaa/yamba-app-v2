import LoginSkeleton from "@/components/auth/skeleton/LoginSkeleton";


/**
 * Affiché automatiquement par Next.js pendant le chargement
 * du Server Component (streaming SSR).
 */
export default function Loading() {
  return <LoginSkeleton />;
}
