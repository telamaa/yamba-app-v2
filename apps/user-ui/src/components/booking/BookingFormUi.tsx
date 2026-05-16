"use client";

import {
  Briefcase,
  Bus,
  Camera,
  Check,
  CreditCard,
  Info,
  MapPin,
  Package,
  Plane,
  Plus,
  ShieldCheck,
  Train,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
} from "react";
import type {
  LocationKind,
  LocationPoint,
  ParcelPhoto,
} from "./booking.types";

// ============================================================
// COLOR TOKENS
// ============================================================

export const MANGO = "#FF9900";
export const MANGO_HOVER = "#E68A00";
export const TEAL = "#0F766E";
export const TEAL_DONE = "#0F6E56";
export const TIP_BG = "#E6F1FB";
export const TIP_TEXT = "#185FA5";
export const TIP_TITLE = "#0C447C";
export const CHARTER_BG = "#FAEEDA";
export const CHARTER_BORDER = "#FAC775";
export const CHARTER_ICON_BG = "#BA7517";
export const CHARTER_TEXT = "#854F0B";
export const CHARTER_TITLE = "#633806";
export const PHOTO_GRADIENT_FROM = "#534AB7";
export const PHOTO_GRADIENT_TO = "#7F77DD";
export const BADGE_REQUIRED_BG = "#FCEBEB";
export const BADGE_REQUIRED_TEXT = "#791F1F";

// ============================================================
// RENDER MARKDOWN-LIKE BOLD (**word**)
// ============================================================

export function RenderBoldText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-medium">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ============================================================
// FORM FIELD
// ============================================================

type FormFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  badge?: ReactNode;
};

export function FormField({ label, hint, error, children, badge }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        {badge}
      </label>
      {children}
      {hint && !error && (
        <div className="mt-1.5 text-[12px] leading-5 text-slate-400 dark:text-slate-500">
          {hint}
        </div>
      )}
      {error && (
        <div className="mt-1.5 text-[12px] font-medium" style={{ color: MANGO }}>
          {error}
        </div>
      )}
    </div>
  );
}

export function RequiredBadge({ label }: { label: string }) {
  return (
    <span
      className="ml-1 rounded-full px-2 py-[2px] text-[11px] font-medium"
      style={{ backgroundColor: BADGE_REQUIRED_BG, color: BADGE_REQUIRED_TEXT }}
    >
      {label}
    </span>
  );
}

// ============================================================
// INFO TOOLTIP
// ============================================================

export function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="group relative ml-1 inline-flex items-center">
      <button
        type="button"
        className="inline-flex items-center text-slate-400 transition-colors hover:text-slate-600 focus:text-slate-600 focus:outline-none dark:hover:text-slate-300 dark:focus:text-slate-300"
        aria-label={content}
      >
        <Info size={13} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-60 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-normal leading-[1.5] text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-100 dark:text-slate-900"
      >
        {content}
      </span>
    </span>
  );
}

// ============================================================
// FORM INPUTS
// ============================================================

type FormInputProps = {
  value: string;
  onChangeAction: (value: string) => void;
  placeholder?: string;
  type?: "text" | "tel" | "email" | "number";
  hasError?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
  autoComplete?: string;
};

export function FormInput({
                            value,
                            onChangeAction,
                            placeholder,
                            type = "text",
                            hasError,
                            inputMode,
                            autoComplete,
                          }: FormInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChangeAction(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      autoComplete={autoComplete}
      className={[
        "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
        hasError
          ? "border-[#FF9900]"
          : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
      ].join(" ")}
    />
  );
}

type FormSelectProps<T extends string> = {
  value: T;
  onChangeAction: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  hasError?: boolean;
};

export function FormSelect<T extends string>({
                                               value,
                                               onChangeAction,
                                               options,
                                               hasError,
                                             }: FormSelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChangeAction(e.target.value as T)}
      className={[
        "w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
        hasError
          ? "border-[#FF9900]"
          : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
      ].join(" ")}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

type FormTextareaProps = {
  value: string;
  onChangeAction: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hasError?: boolean;
};

export function FormTextarea({
                               value,
                               onChangeAction,
                               placeholder,
                               rows = 2,
                               hasError,
                             }: FormTextareaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChangeAction(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={[
        "w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white",
        hasError
          ? "border-[#FF9900]"
          : "border-slate-200 focus:border-[#FF9900] dark:border-slate-700",
      ].join(" ")}
    />
  );
}

// ============================================================
// TIP BLOCK
// ============================================================

type TipBlockProps = {
  icon: ReactNode;
  title: string;
  items: string[];
  ordered?: boolean;
  extraLink?: { label: string; onClickAction: () => void };
};

export function TipBlock({ icon, title, items, ordered, extraLink }: TipBlockProps) {
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div className="mb-5 rounded-lg p-4" style={{ backgroundColor: TIP_BG }}>
      <div
        className="mb-2.5 flex items-center gap-2 text-[13px] font-medium"
        style={{ color: TIP_TITLE }}
      >
        {icon}
        <span>{title}</span>
      </div>
      <ListTag
        className="m-0 list-disc pl-5 text-[13px] leading-[1.7]"
        style={{ color: TIP_TEXT, listStyleType: ordered ? "decimal" : "disc" }}
      >
        {items.map((item, i) => (
          <li key={i} className="mb-1 last:mb-0">
            <RenderBoldText text={item} />
            {i === items.length - 1 && extraLink && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={extraLink.onClickAction}
                  className="underline underline-offset-2 hover:no-underline"
                  style={{ color: TIP_TITLE }}
                >
                  {extraLink.label}
                </button>
              </>
            )}
          </li>
        ))}
      </ListTag>
    </div>
  );
}

// ============================================================
// CHARTER BLOCK
// ============================================================

type CharterBlockProps = {
  title: string;
  subtitle: string;
  intro: string;
  items: string[];
  disclaimer: string;
  fullLinkLabel: string;
  onFullLinkClickAction: () => void;
};

export function CharterBlock({
                               title,
                               subtitle,
                               intro,
                               items,
                               disclaimer,
                               fullLinkLabel,
                               onFullLinkClickAction,
                             }: CharterBlockProps) {
  return (
    <div
      className="mb-4 rounded-lg border p-5"
      style={{ backgroundColor: CHARTER_BG, borderColor: CHARTER_BORDER }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: CHARTER_ICON_BG }}
        >
          <ShieldCheck size={18} />
        </div>
        <div>
          <div className="text-[15px] font-medium" style={{ color: CHARTER_TITLE }}>
            {title}
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: CHARTER_TEXT }}>
            {subtitle}
          </div>
        </div>
      </div>
      <div className="text-[13px] leading-[1.65]" style={{ color: CHARTER_TEXT }}>
        <p className="mb-2">{intro}</p>
        <ul className="mb-2 list-disc pl-5">
          {items.map((item, i) => (
            <li key={i} className="mb-1">
              <RenderBoldText text={item} />
            </li>
          ))}
        </ul>
        <p className="mb-3">{disclaimer}</p>
        <button
          type="button"
          onClick={onFullLinkClickAction}
          className="font-medium underline-offset-2 hover:underline"
          style={{ color: CHARTER_TITLE }}
        >
          {fullLinkLabel} →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CHARTER ACCEPTANCE CHECKBOX
// ============================================================

type CharterCheckboxProps = {
  checked: boolean;
  onChangeAction: (checked: boolean) => void;
  title: string;
  descPrefix: string;
  cgvLabel: string;
  cgvHref: string;
  descJoin: string;
  contractLabel: string;
  contractHref: string;
  descSuffix: string;
  hasError?: boolean;
};

export function CharterCheckbox({
                                  checked,
                                  onChangeAction,
                                  title,
                                  descPrefix,
                                  cgvLabel,
                                  cgvHref,
                                  descJoin,
                                  contractLabel,
                                  contractHref,
                                  descSuffix,
                                  hasError,
                                }: CharterCheckboxProps) {
  const id = useId();
  const linkClass = "underline-offset-2 hover:underline";
  const linkStyle = { color: TIP_TEXT };

  return (
    <label
      htmlFor={id}
      className={[
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
        "bg-slate-50 hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800",
        hasError
          ? "border-[#FF9900]"
          : "border-transparent hover:border-slate-200 dark:hover:border-slate-700",
      ].join(" ")}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChangeAction(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 cursor-pointer accent-[#FF9900]"
      />
      <div>
        <div className="mb-1 text-[14px] font-medium">{title}</div>
        <div className="text-[12px] leading-[1.5] text-slate-500 dark:text-slate-400">
          {descPrefix}
          <a href={cgvHref} className={linkClass} style={linkStyle}>{cgvLabel}</a>
          {descJoin}
          <a href={contractHref} className={linkClass} style={linkStyle}>{contractLabel}</a>
          {descSuffix}
        </div>
      </div>
    </label>
  );
}

// ============================================================
// INSURANCE OPTION (div role="button", nested <button> allowed)
// ============================================================

type InsuranceOptionProps = {
  selected: boolean;
  onSelectAction: () => void;
  title: string;
  price: string;
  priceVariant?: "free" | "paid";
  description: ReactNode;
  extraLink?: { label: string; onClickAction: () => void };
};

export function InsuranceOption({
                                  selected,
                                  onSelectAction,
                                  title,
                                  price,
                                  priceVariant = "paid",
                                  description,
                                  extraLink,
                                }: InsuranceOptionProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelectAction}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectAction();
        }
      }}
      className={[
        "mb-2.5 flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        selected
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-emerald-500" : "border-slate-300 dark:border-slate-600",
        ].join(" ")}
        aria-hidden="true"
      >
        {selected && <span className="h-[8px] w-[8px] rounded-full bg-emerald-500" />}
      </span>
      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[14px] font-medium text-slate-900 dark:text-white">
            {title}
          </span>
          <span
            className={[
              "text-[13px] font-medium",
              priceVariant === "free"
                ? "text-slate-500 dark:text-slate-400"
                : "text-emerald-700 dark:text-emerald-400",
            ].join(" ")}
          >
            {price}
          </span>
        </div>
        <div className="text-[12px] leading-[1.55] text-slate-600 dark:text-slate-400">
          {description}
          {extraLink && (
            <>
              {" "}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  extraLink.onClickAction();
                }}
                className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
              >
                {extraLink.label}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOCATION (pickup / delivery)
// ============================================================

export function getLocationIcon(kind: LocationKind): LucideIcon {
  switch (kind) {
    case "AIRPORT":
      return Plane;
    case "TRAIN_STATION":
      return Train;
    case "BUS_STATION":
      return Bus;
    case "PARCEL_POINT":
      return Package;
    case "ADDRESS":
      return MapPin;
    default:
      return MapPin;
  }
}

type LocationOptionProps = {
  location: LocationPoint;
  selected: boolean;
  onSelectAction: () => void;
  hasError?: boolean;
};

export function LocationOption({
                                 location,
                                 selected,
                                 onSelectAction,
                                 hasError,
                               }: LocationOptionProps) {
  const Icon = getLocationIcon(location.kind);
  return (
    <button
      type="button"
      onClick={onSelectAction}
      className={[
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
          : hasError
            ? "border-[#FF9900] bg-white dark:bg-slate-900"
            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-emerald-500" : "border-slate-300 dark:border-slate-600",
        ].join(" ")}
        aria-hidden="true"
      >
        {selected && <span className="h-[8px] w-[8px] rounded-full bg-emerald-500" />}
      </span>
      <Icon
        size={18}
        className={[
          "mt-0.5 flex-shrink-0",
          selected
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-slate-500 dark:text-slate-400",
        ].join(" ")}
      />
      <div className="flex-1">
        <div className="text-[13px] font-medium text-slate-900 dark:text-white">
          {location.label}
        </div>
        {location.subLabel && (
          <div className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
            {location.subLabel}
          </div>
        )}
        {location.addressShort && (
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">
            {location.addressShort}
          </div>
        )}
      </div>
    </button>
  );
}

type LocationDisplayProps = {
  location: LocationPoint;
  hint?: string;
};

export function LocationDisplay({ location, hint }: LocationDisplayProps) {
  const Icon = getLocationIcon(location.kind);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <Icon
        size={18}
        className="mt-0.5 flex-shrink-0 text-slate-500 dark:text-slate-400"
      />
      <div className="flex-1">
        <div className="text-[13px] font-medium text-slate-900 dark:text-white">
          {location.label}
        </div>
        {location.subLabel && (
          <div className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
            {location.subLabel}
          </div>
        )}
        {location.addressShort && (
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">
            {location.addressShort}
          </div>
        )}
        {hint && (
          <div className="mt-1.5 text-[11px] italic text-slate-400 dark:text-slate-500">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PHOTO SLOT & GRID
// ============================================================

type PhotoSlotProps = {
  photo?: ParcelPhoto;
  onAddAction?: (files: File[]) => void;
  onRemoveAction?: () => void;
  addLabel: string;
  removeAriaLabel: string;
};

export function PhotoSlot({
                            photo,
                            onAddAction,
                            onRemoveAction,
                            addLabel,
                            removeAriaLabel,
                          }: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0 && onAddAction) {
        onAddAction(files);
      }
      e.target.value = "";
    },
    [onAddAction]
  );

  if (photo) {
    return (
      <div
        className="relative aspect-square overflow-hidden rounded-lg text-white"
        style={{
          background: `linear-gradient(135deg, ${PHOTO_GRADIENT_FROM}, ${PHOTO_GRADIENT_TO})`,
        }}
      >
        {photo.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.previewUrl}
            alt={photo.label ?? ""}
            className="h-full w-full object-cover opacity-90"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Camera size={28} />
          </div>
        )}
        {photo.label && (
          <div className="absolute bottom-1.5 left-1.5 right-1.5 rounded bg-black/55 px-1.5 py-0.5 text-center text-[10px] font-medium">
            {photo.label}
          </div>
        )}
        {onRemoveAction && (
          <button
            type="button"
            onClick={onRemoveAction}
            aria-label={removeAriaLabel}
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/70"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500 transition-colors hover:border-[#FF9900] hover:bg-[#FAEEDA] hover:text-[#854F0B] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-[rgba(255,153,0,0.12)]"
      >
        <Plus size={20} />
        <span className="mt-1">{addLabel}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}

type PhotoGridProps = {
  photos: ParcelPhoto[];
  maxSlots: number;
  onAddAction: (files: File[]) => void;
  onRemoveAction: (photoId: string) => void;
  cols?: 3 | 5;
  addLabel: string;
  removeAriaLabel: string;
};

export function PhotoGrid({
                            photos,
                            maxSlots,
                            onAddAction,
                            onRemoveAction,
                            cols,
                            addLabel,
                            removeAriaLabel,
                          }: PhotoGridProps) {
  const empties = Math.max(0, maxSlots - photos.length);
  const gridCols =
    cols === 3
      ? "grid-cols-3"
      : cols === 5
        ? "grid-cols-5"
        : "grid-cols-3 md:grid-cols-5";

  return (
    <div className={`mt-2 grid gap-2.5 ${gridCols}`}>
      {photos.map((p) => (
        <PhotoSlot
          key={p.id}
          photo={p}
          onRemoveAction={() => onRemoveAction(p.id)}
          addLabel={addLabel}
          removeAriaLabel={removeAriaLabel}
        />
      ))}
      {Array.from({ length: empties }).map((_, i) => (
        <PhotoSlot
          key={`empty-${i}`}
          onAddAction={onAddAction}
          addLabel={addLabel}
          removeAriaLabel={removeAriaLabel}
        />
      ))}
    </div>
  );
}

// ============================================================
// PAYMENT METHOD OPTION
// ============================================================

type PaymentMethodOptionProps = {
  selected: boolean;
  onSelectAction: () => void;
  iconVariant: "card" | "apple" | "google";
  icon: ReactNode;
  title: string;
  description: string;
};

export function PaymentMethodOption({
                                      selected,
                                      onSelectAction,
                                      iconVariant,
                                      icon,
                                      title,
                                      description,
                                    }: PaymentMethodOptionProps) {
  const iconBg =
    iconVariant === "apple"
      ? "bg-black text-white"
      : iconVariant === "google"
        ? "bg-white border border-slate-200 text-[#185FA5] dark:bg-slate-100"
        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";

  return (
    <button
      type="button"
      onClick={onSelectAction}
      className={[
        "mb-2.5 flex w-full items-center gap-3.5 rounded-lg border p-4 text-left transition-colors",
        selected
          ? "border-[#FF9900] bg-orange-50 dark:bg-orange-950/30"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-[#FF9900]" : "border-slate-300 dark:border-slate-600",
        ].join(" ")}
        aria-hidden="true"
      >
        {selected && <span className="h-[8px] w-[8px] rounded-full bg-[#FF9900]" />}
      </span>
      <span
        className={`flex h-7 w-10 flex-shrink-0 items-center justify-center rounded ${iconBg}`}
      >
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-[14px] font-medium text-slate-900 dark:text-white">
          {title}
        </div>
        <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
          {description}
        </div>
      </div>
    </button>
  );
}

// ============================================================
// TRUST BADGE
// ============================================================

export function TrustBadge({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-slate-50 px-4 py-3 text-[12px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      <ShieldCheck size={16} className="flex-shrink-0" style={{ color: TEAL_DONE }} />
      <span>{message}</span>
    </div>
  );
}

// ============================================================
// SECTION TITLE
// ============================================================

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 mt-5 text-[14px] font-medium text-slate-900 first:mt-0 dark:text-white">
      {children}
    </h2>
  );
}

// ============================================================
// BUTTONS
// ============================================================

type ButtonProps = {
  children: ReactNode;
  onClickAction: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
};

export function PrimaryButton({ children, onClickAction, disabled, type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClickAction}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-[14px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      style={{ backgroundColor: disabled ? "#A8A8A2" : MANGO }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClickAction, disabled, type = "button" }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClickAction}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-transparent px-5 py-2.5 text-[14px] text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

// ============================================================
// ICON BUTTON
// ============================================================

type IconButtonProps = {
  children: ReactNode;
  onClickAction: () => void;
  ariaLabel: string;
};

export function IconButton({ children, onClickAction, ariaLabel }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClickAction}
      aria-label={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

export { Check, CreditCard, Briefcase };
