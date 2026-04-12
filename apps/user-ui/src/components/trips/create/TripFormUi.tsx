import type { ValidationErrors } from "./create-trip.config";

const MANGO = "#FF9900";
const MANGO_10 = "rgba(255, 153, 0, 0.1)";

/* ── Field error — text only, no dot ───────── */

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="mt-1 animate-[fadeSlide_0.2s_ease]">
      <span className="text-[11px]" style={{ color: MANGO }}>{error}</span>
    </div>
  );
}

/* ── Error summary — no dot ────────────────── */

export function ErrorSummary({
                               errors,
                               isFr,
                             }: {
  errors: ValidationErrors;
  isFr: boolean;
}) {
  const count = Object.keys(errors).length;
  if (count === 0) return null;

  const label = isFr
    ? `${count} champ${count > 1 ? "s" : ""} à compléter`
    : `${count} field${count > 1 ? "s" : ""} to complete`;

  return (
    <div className="mb-4 rounded-lg px-3 py-2 animate-[fadeSlide_0.2s_ease]" style={{ backgroundColor: MANGO_10 }}>
      <span className="text-[12px] font-medium" style={{ color: MANGO }}>{label}</span>
    </div>
  );
}

/* ── Section label ─────────────────────────── */

export function SectionLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className={[
      "mb-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500",
      first ? "mt-0" : "mt-7",
    ].join(" ")}>
      {children}
    </div>
  );
}

/* ── Compact segmented control — no border ─── */

export function SegmentedControl({
                                   value,
                                   options,
                                   onChange,
                                   error,
                                 }: {
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <div
        className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/50"
        style={error ? { outline: `1.5px solid ${MANGO}`, backgroundColor: MANGO_10 } : undefined}
      >
        {options.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "rounded-md px-4 py-2 text-[13px] transition-all",
                isActive
                  ? "font-medium text-slate-900 shadow-sm dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              ].join(" ")}
              style={isActive ? { backgroundColor: MANGO, color: "#1a1a1a" } : undefined}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <FieldError error={error} />
    </div>
  );
}

/* ── Form field wrapper ────────────────────── */

export function FormField({
                            label,
                            children,
                            error,
                            className = "",
                          }: {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[12px] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
      <FieldError error={error} />
    </div>
  );
}

/* ── Standard input ────────────────────────── */

export function FormInput({
                            type = "text",
                            value,
                            onChange,
                            placeholder,
                            error,
                            className = "",
                          }: {
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}) {
  return (
    <div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-[#FF9900]/20",
          "dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500",
          error
            ? "border-[#FF9900] focus:border-[#FF9900]"
            : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
          className,
        ].join(" ")}
      />
      <FieldError error={error} />
    </div>
  );
}

/* ── Toggle switch ─────────────────────────── */

export function Toggle({
                         on,
                         onChange,
                         label,
                       }: {
  on: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[13px] text-slate-700 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="relative h-[22px] w-10 flex-shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: on ? MANGO : undefined }}
        aria-label={label}
      >
        {!on && (
          <span className="absolute inset-0 rounded-full bg-slate-300 dark:bg-slate-600" />
        )}
        <span
          className="absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white transition-transform"
          style={{ transform: on ? "translateX(18px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

/* ── Category chip ─────────────────────────── */

export function CategoryChip({
                               label,
                               active,
                               onClick,
                             }: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3.5 py-1.5 text-[12px] transition-all",
        active
          ? "border-[#FF9900] font-medium text-slate-900 dark:text-[#FFB84D]"
          : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600",
      ].join(" ")}
      style={active ? { backgroundColor: MANGO_10 } : undefined}
    >
      {label}
    </button>
  );
}

/* ── Mini chip ─────────────────────────────── */

export function MiniChip({
                           label,
                           active,
                           onClick,
                           hasError,
                         }: {
  label: string;
  active: boolean;
  onClick: () => void;
  hasError?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-2.5 py-1 text-[11px] transition-all",
        active
          ? "border-[#FF9900] font-medium text-slate-900 dark:text-[#FFB84D]"
          : hasError
            ? "border-[#FF9900]/50 text-slate-400"
            : "border-slate-200 text-slate-400 hover:border-slate-300 dark:border-slate-700 dark:text-slate-500",
      ].join(" ")}
      style={active ? { backgroundColor: MANGO_10 } : undefined}
    >
      {label}
    </button>
  );
}

/* ── Price input ───────────────────────────── */

export function PriceInput({
                             value,
                             onChange,
                             placeholder = "0",
                             error,
                           }: {
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? "" : Number(v));
          }}
          placeholder={placeholder}
          className={[
            "w-20 rounded-lg border bg-white px-3 py-2 text-right text-[13px] text-slate-900",
            "focus:outline-none focus:ring-1 focus:ring-[#FF9900]/20",
            "dark:bg-slate-900 dark:text-white",
            error
              ? "border-[#FF9900] focus:border-[#FF9900]"
              : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
          ].join(" ")}
        />
        <span className="text-[12px] text-slate-400">€</span>
      </div>
      <FieldError error={error} />
    </div>
  );
}

/* ── Swap button ───────────────────────────── */

export function SwapButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center self-end mb-1.5 rounded-full border border-slate-200 text-slate-400 transition-colors hover:border-[#FF9900] hover:text-[#FF9900] dark:border-slate-700 dark:text-slate-500 dark:hover:border-[#FF9900] dark:hover:text-[#FF9900]"
      aria-label="Swap"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 16V4m0 12l-3-3m3 3l3-3M17 8v12m0-12l3 3m-3-3l-3 3" />
      </svg>
    </button>
  );
}

/* ── Condition card ────────────────────────── */

export function ConditionCard({
                                title,
                                price,
                                onPriceChange,
                                handoffMoments,
                                pickupMoments,
                                handoffLabels,
                                pickupLabels,
                                onToggleHandoff,
                                onTogglePickup,
                                priceError,
                                handoffError,
                                pickupError,
                              }: {
  title: string;
  price: number | "";
  onPriceChange: (value: number | "") => void;
  handoffMoments: string[];
  pickupMoments: string[];
  handoffLabels: { key: string; label: string }[];
  pickupLabels: { key: string; label: string }[];
  onToggleHandoff: (key: string) => void;
  onTogglePickup: (key: string) => void;
  priceError?: string;
  handoffError?: string;
  pickupError?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-900 dark:text-white">{title}</span>
        <PriceInput value={price} onChange={onPriceChange} error={priceError} />
      </div>

      <div className="mb-2.5 flex items-center gap-3">
        <span className="w-12 text-[11px] text-slate-400 dark:text-slate-500">Remise</span>
        <div>
          <div className="flex flex-wrap gap-1.5">
            {handoffLabels.map((h) => (
              <MiniChip
                key={h.key}
                label={h.label}
                active={handoffMoments.includes(h.key)}
                onClick={() => onToggleHandoff(h.key)}
                hasError={!!handoffError}
              />
            ))}
          </div>
          <FieldError error={handoffError} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-12 text-[11px] text-slate-400 dark:text-slate-500">Retrait</span>
        <div>
          <div className="flex flex-wrap gap-1.5">
            {pickupLabels.map((p) => (
              <MiniChip
                key={p.key}
                label={p.label}
                active={pickupMoments.includes(p.key)}
                onClick={() => onTogglePickup(p.key)}
                hasError={!!pickupError}
              />
            ))}
          </div>
          <FieldError error={pickupError} />
        </div>
      </div>
    </div>
  );
}

/* ── Review card ───────────────────────────── */

export function ReviewCard({
                             label,
                             value,
                             sub,
                             onEdit,
                             editLabel = "Modifier",
                             children,
                           }: {
  label: string;
  value?: string;
  sub?: string;
  onEdit: () => void;
  editLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</div>
          {value && (
            <div className="mt-1 text-[14px] font-medium text-slate-900 dark:text-white">{value}</div>
          )}
          {sub && (
            <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{sub}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex-shrink-0 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors"
          style={{ backgroundColor: MANGO_10, color: MANGO }}
        >
          {editLabel}
        </button>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

/* ── Revenue badge ─────────────────────────── */

export function RevenueBadge({
                               min,
                               max,
                               label,
                             }: {
  min: number;
  max: number;
  label: string;
}) {
  if (min === 0 && max === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 dark:bg-emerald-900/20">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
      <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
        {label} : {min}€ – {max}€
      </span>
    </div>
  );
}
