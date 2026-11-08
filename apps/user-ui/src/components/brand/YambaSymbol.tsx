/**
 * Symbole Yamba (logo M1 « Porter ») : un Y d'un seul trait dont les bras
 * portent le colis.
 *
 * - Y en mango #FF9900, colis en teal #0F766E (clair) / #2DD4BF (sombre).
 * - Sous 28 px, le trait et le colis s'épaississent pour rester lisibles.
 * - Pas de hook : utilisable en server component comme en client component.
 *
 * Variantes :
 * - "auto"  : couleurs de marque, s'adapte au thème clair/sombre (défaut)
 * - "white" : Y blanc + colis teal, pour un fond mango
 * - "mono"  : une seule couleur, celle du texte parent (currentColor)
 */
type Props = {
  /** Largeur en px. La hauteur suit le ratio du symbole (192 × 200). */
  size?: number;
  variant?: "auto" | "white" | "mono";
  className?: string;
  /** Texte accessible. Sans titre, le symbole est décoratif (aria-hidden). */
  title?: string;
};

const PATH = "M40 40 C52 100 80 128 120 128 C160 128 188 100 200 40 M120 128 V210";

export default function YambaSymbol({
  size = 32,
  variant = "auto",
  className = "",
  title,
}: Props) {
  const small = size < 28;
  const height = Math.round((size * 200) / 192);

  const stroke =
    variant === "mono" ? "currentColor" : variant === "white" ? "#FFFFFF" : "#FF9900";

  const dotClass =
    variant === "mono"
      ? "fill-current"
      : variant === "white"
        ? "fill-[#0F766E]"
        : "fill-[#0F766E] dark:fill-[#2DD4BF]";

  return (
    <svg
      width={size}
      height={height}
      viewBox="24 24 192 200"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path
        d={PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={small ? 30 : 24}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="120" cy="70" r={small ? 22 : 17} className={dotClass} />
    </svg>
  );
}
