"use client";

import type { ReactNode } from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SectionTitle({
                               title,
                               subtitle,
                             }: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function ChoiceCard({
                             active,
                             icon,
                             title,
                             description,
                             onClick,
                           }: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[18px] border px-4 py-4 text-left transition-colors",
        active
          ? "border-[#FF9900]/35 bg-[#FFF6E8] text-slate-900 dark:border-[#FF9900]/20 dark:bg-slate-900 dark:text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/60"
      )}
    >
      <div className="mb-2 text-slate-400 dark:text-slate-500">{icon}</div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{description}</div>
    </button>
  );
}

export function FieldCard({
                            label,
                            value,
                            icon,
                            onClick,
                          }: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      {...(onClick ? { type: "button", onClick } : {})}
      className={cn(
        "w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-950",
        onClick ? "transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60" : ""
      )}
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 text-slate-400 dark:text-slate-500">{icon}</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {label}
          </div>
          <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {value}
          </div>
        </div>
      </div>
    </Comp>
  );
}

export function InfoDot({
                          text,
                        }: {
  text: string;
}) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      i
    </span>
  );
}

export function InputField({
                             label,
                             value,
                             onChange,
                             type = "text",
                             placeholder,
                             suffix,
                             min,
                             max,
                             step,
                             helperText,
                             error,
                             labelAdornment,
                             inputMode,
                           }: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  helperText?: string;
  error?: string;
  labelAdornment?: ReactNode;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <span>{label}</span>
        {labelAdornment ? <span>{labelAdornment}</span> : null}
      </div>

      <div
        className={cn(
          "flex items-center rounded-[16px] border bg-white px-4 py-3 dark:bg-slate-950",
          error
            ? "border-red-300 dark:border-red-900"
            : "border-slate-200 dark:border-slate-800"
        )}
      >
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          step={step}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
        />
        {suffix ? (
          <span className="ml-2 text-sm text-slate-400 dark:text-slate-500">{suffix}</span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : helperText ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      ) : null}
    </label>
  );
}

export function ToggleRow({
                            label,
                            checked,
                            onChange,
                          }: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 py-4 text-left dark:border-slate-800 dark:bg-slate-950"
    >
      <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>

      <span
        className={cn(
          "relative h-7 w-12 rounded-full transition-colors",
          checked ? "bg-[#FF9900]" : "bg-slate-300 dark:bg-slate-700"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </span>
    </button>
  );
}

export function CategoryChip({
                               active,
                               label,
                               onClick,
                             }: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
        active
          ? "border-[#FF9900]/40 bg-[#FFF6E8] text-slate-900 dark:border-[#FF9900]/20 dark:bg-slate-900 dark:text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
      )}
    >
      {label}
    </button>
  );
}

export function SummaryCard({
                              title,
                              value,
                            }: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {title}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

export function CompactSegmentedControl<T extends string>({
                                                            label,
                                                            value,
                                                            options,
                                                            onChange,
                                                            columns = 3,
                                                          }: {
  label: string;
  value: T | null;
  options: Array<{
    value: T;
    label: string;
  }>;
  onChange: (value: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </div>

      <div
        className={cn(
          "rounded-[18px] bg-slate-100 p-1 dark:bg-slate-900",
          columns === 2 ? "grid grid-cols-2 gap-1" : "grid grid-cols-3 gap-1"
        )}
      >
        {options.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-[14px] px-3 py-2.5 text-sm font-semibold transition-all",
                active
                  ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.12),0_6px_16px_rgba(15,23,42,0.06)] dark:bg-slate-800 dark:text-white"
                  : "bg-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
