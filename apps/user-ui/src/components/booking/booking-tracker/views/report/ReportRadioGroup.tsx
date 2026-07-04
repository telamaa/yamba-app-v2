/**
 * ReportRadioGroup.tsx
 * ====================
 * Groupe de radios style maquette : option sélectionnée = fond amber
 * + indicateur rond amber. Utilisé pour la catégorie ET la solution
 * souhaitée. Les labels arrivent déjà traduits du parent (évite le
 * piège t() dynamique).
 */

"use client";

export type RadioOption = {
  id: string;
  label: string;
};

type Props = {
  name: string;
  options: RadioOption[];
  selectedId: string | null;
  onSelectAction: (id: string) => void;
  compact?: boolean;
};

export default function ReportRadioGroup({
                                           name,
                                           options,
                                           selectedId,
                                           onSelectAction,
                                           compact = false,
                                         }: Props) {
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const selected = option.id === selectedId;
        const rowClass =
          "flex w-full items-center gap-2.5 rounded-xl border text-left transition-colors " +
          (compact ? "px-3 py-2.5" : "px-3.5 py-3") +
          " " +
          (selected
            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
            : "border-transparent bg-slate-50 hover:border-slate-200 dark:bg-slate-900 dark:hover:border-slate-700");
        const dotClass =
          "flex flex-shrink-0 items-center justify-center rounded-full border-[1.5px] bg-white dark:bg-slate-950 " +
          (compact ? "h-4 w-4" : "h-[18px] w-[18px]") +
          " " +
          (selected
            ? "border-amber-600 dark:border-amber-500"
            : "border-slate-300 dark:border-slate-600");
        const labelClass =
          "leading-snug " +
          (compact ? "text-[13px]" : "text-[14px]") +
          " " +
          (selected
            ? "font-medium text-amber-950 dark:text-amber-100"
            : "text-slate-700 dark:text-slate-300");

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelectAction(option.id)}
            className={rowClass}
          >
            <span className={dotClass} aria-hidden="true">
              {selected && (
                <span className="h-2 w-2 rounded-full bg-amber-600 dark:bg-amber-500" />
              )}
            </span>
            <span className={labelClass}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
