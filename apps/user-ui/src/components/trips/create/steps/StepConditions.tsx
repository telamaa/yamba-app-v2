"use client";

import { Upload } from "lucide-react";
import {
  CreateTripCopy,
  Draft,
  HandoffFlexibility,
  HandoffMoment,
} from "../create-trip.types";
import { CategoryChip, InputField, SectionTitle, ToggleRow } from "../TripFormUi";

export default function StepConditions({
                                         copy,
                                         draft,
                                         setDraft,
                                         toggleHandoffMoment,
                                       }: {
  copy: CreateTripCopy;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  toggleHandoffMoment: (value: HandoffMoment) => void;
}) {
  return (
    <>
      <SectionTitle title={copy.step4Title} subtitle={copy.step4Sub} />

      <div className="grid gap-4 md:grid-cols-2">
        <InputField
          label={copy.price}
          type="number"
          value={draft.priceAmount}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, priceAmount: value ? Number(value) : "" }))
          }
          suffix="€"
        />

        <div className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.handoffFlexibility}
          </div>
          <div className="grid gap-2">
            {(["flexible", "fixedTime", "byAppointment"] as HandoffFlexibility[]).map((value) => {
              const label =
                value === "flexible"
                  ? copy.flexible
                  : value === "fixedTime"
                    ? copy.fixedTime
                    : copy.byAppointment;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, handoffFlexibility: value }))}
                  className={[
                    "rounded-[16px] border px-4 py-3 text-left text-sm font-semibold",
                    draft.handoffFlexibility === value
                      ? "border-[#FF9900]/40 bg-[#FFF6E8] text-slate-900 dark:border-[#FF9900]/20 dark:bg-slate-900 dark:text-white"
                      : "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
          {copy.handoffMoments}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["beforeDeparture", copy.beforeDeparture],
              ["duringTrip", copy.duringTrip],
              ["onArrival", copy.onArrival],
            ] as Array<[HandoffMoment, string]>
          ).map(([value, label]) => (
            <CategoryChip
              key={value}
              active={draft.handoffMoments.includes(value)}
              label={label}
              onClick={() => toggleHandoffMoment(value)}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <ToggleRow
          label={copy.instantBooking}
          checked={draft.instantBooking}
          onChange={(value) => setDraft((prev) => ({ ...prev, instantBooking: value }))}
        />
        <ToggleRow
          label={copy.ticketVerified}
          checked={draft.ticketVerified}
          onChange={(value) => setDraft((prev) => ({ ...prev, ticketVerified: value }))}
        />
      </div>

      <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start gap-3">
          <Upload className="mt-0.5 text-slate-400 dark:text-slate-500" size={20} />
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{copy.uploadTitle}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{copy.uploadSub}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <label className="block">
          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {copy.notes}
          </div>
          <textarea
            rows={5}
            value={draft.notes}
            onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder={copy.notesPlaceholder}
            className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
          />
        </label>
      </div>
    </>
  );
}
