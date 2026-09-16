"use client";

const COLORS = {
  mango: "#FF9900",
  mangoTint: "#FFF6E8",
  mangoDark: "#CC7A00",
  teal: "#0F766E",
};

/* ── Stat card ─────────────────────────────── */

export function StatCard({
                           label,
                           value,
                           change,
                         }: {
  label: string;
  value: string;
  change?: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-[22px] font-medium text-slate-900 dark:text-white">{value}</div>
      {change && (
        <div className="mt-0.5 text-[11px]" style={{ color: COLORS.teal }}>
          {change}
        </div>
      )}
    </div>
  );
}

/* ── List row ──────────────────────────────── */

type BadgeVariant = "active" | "pending" | "done";

const badgeStyles: Record<BadgeVariant, string> = {
  active: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  done: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const dotColors: Record<BadgeVariant, string> = {
  active: COLORS.teal,
  pending: COLORS.mango,
  done: "#B4B2A9",
};

export function ListRow({
                          title,
                          subtitle,
                          badge,
                          badgeVariant = "done",
                          highlight = false,
                          avatar,
                          avatarBg,
                          rightBadge,
                        }: {
  title: string;
  subtitle: string;
  badge?: string;
  badgeVariant?: BadgeVariant;
  highlight?: boolean;
  avatar?: string;
  avatarBg?: string;
  rightBadge?: number;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg px-4 py-3 mb-1.5",
        highlight ? "" : "bg-white dark:bg-slate-950",
      ].join(" ")}
      style={highlight ? { backgroundColor: COLORS.mangoTint } : undefined}
    >
      {avatar ? (
        <div
          className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[13px] font-medium text-white"
          style={{ backgroundColor: avatarBg ?? COLORS.teal }}
        >
          {avatar}
        </div>
      ) : (
        <div
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: dotColors[badgeVariant] }}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-white">
          {title}
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </div>
      </div>

      {badge && (
        <span
          className={[
            "whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            badgeStyles[badgeVariant],
          ].join(" ")}
        >
          {badge}
        </span>
      )}

      {rightBadge !== undefined && (
        <span
          className="min-w-[20px] rounded-full px-1.5 py-px text-center text-[11px] font-medium text-slate-900"
          style={{ backgroundColor: COLORS.mango }}
        >
          {rightBadge}
        </span>
      )}
    </div>
  );
}

/* ── Toggle row ────────────────────────────── */

/**
 * Bascule d'un réglage — CONTRÔLÉE (ANO-WEB-86, recette 5.26).
 *
 * Elle portait son propre `useState` : on la déplaçait, rien n'était enregistré, et l'état
 * repartait à sa valeur d'origine au rechargement. Une bascule décorative fait croire au membre
 * qu'il a réglé quelque chose. La valeur vient donc de l'appelant, qui l'écrit quelque part, et
 * `role="switch"` + `aria-checked` disent l'état à un lecteur d'écran.
 */
export function ToggleRow({
                            label,
                            description,
                            checked,
                            onChangeAction,
                            disabled = false,
                          }: {
  label: string;
  description: string;
  checked: boolean;
  onChangeAction: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="text-[13.5px] text-slate-900 dark:text-white">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChangeAction(!checked)}
        className={`relative h-[22px] w-10 flex-shrink-0 rounded-full transition-colors ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        style={{ backgroundColor: checked ? COLORS.mango : undefined }}
      >
        {!checked && (
          <span className="absolute inset-0 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
        <span
          className="absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

/* ── Setting row (bouton d'action, ou contrôle fourni) ──────── */

/**
 * Ligne de réglage. Deux formes, et aucune décorative (ANO-WEB-86, recette 5.26) :
 *
 *   - `onAction` + `actionLabel` → le bouton mangue habituel ;
 *   - `control` → le vrai contrôle du réglage (sélecteur de langue, choix de thème…).
 *
 * Sans l'un ni l'autre, la ligne est en LECTURE : elle informe, et ne promet aucun geste. Le
 * bouton ne s'affiche plus « au cas où » — c'est ce qui faisait un « Changer » sans effet.
 */
export function SettingRow({
                             label,
                             description,
                             actionLabel,
                             onAction,
                             control,
                           }: {
  label: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  control?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <div className="text-[13.5px] text-slate-900 dark:text-white">{label}</div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</div>
      </div>
      {control ??
        (onAction && actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900"
            style={{ backgroundColor: COLORS.mango }}
          >
            {actionLabel}
          </button>
        ) : null)}
    </div>
  );
}

/* ── Card wrapper ──────────────────────────── */

export function CardSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl bg-white p-4 dark:bg-slate-950">
      {children}
    </div>
  );
}

/* ── Empty state ───────────────────────────── */

export function EmptyState({
                             icon: Icon,
                             title,
                             description,
                             actionLabel,
                             onAction,
                           }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-12 text-center dark:bg-slate-950">
      <Icon size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
      <div className="text-[15px] font-medium text-slate-900 dark:text-white">{title}</div>
      <div className="mt-1 max-w-[280px] text-[13px] text-slate-500 dark:text-slate-400">
        {description}
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg px-5 py-2 text-[13px] font-medium text-slate-900"
          style={{ backgroundColor: COLORS.mango }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ── Info banner ───────────────────────────── */

export function InfoBanner({
                             icon: Icon,
                             text,
                           }: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  text: string;
}) {
  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-xl px-5 py-4"
      style={{ backgroundColor: COLORS.mangoTint }}
    >
      <Icon size={20} style={{ color: COLORS.mangoDark }} />
      <span className="text-[13px]" style={{ color: "#854F0B" }}>
        {text}
      </span>
    </div>
  );
}
