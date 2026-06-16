/**
 * StatusStepper.tsx
 * =================
 * Stepper d'état réutilisable (Voyageur ET Expéditeur).
 *
 * - Affiche N étapes numérotées avec leur label
 * - Marque les étapes passées (✓ vert), l'étape active (orange), les futures (gris)
 * - Responsive : compact sur mobile, plus aéré sur desktop
 *
 * Exemples d'usage :
 *
 *   Voyageur post-acceptation :
 *     <StatusStepper
 *       steps={[
 *         { label: "Accepté" },
 *         { label: "Pickup" },
 *         { label: "Transport" },
 *         { label: "Livraison" },
 *         { label: "Versement" },
 *       ]}
 *       currentStep={2}
 *     />
 *
 *   Expéditeur post-acceptation : currentStep={2}, dernière étape = "Vérif."
 */

"use client";

import { Check } from "lucide-react";

export type StatusStep = {
  label: string;
  /** Sous-label optionnel affiché sous le label principal (desktop uniquement) */
  sublabel?: string;
};

type Props = {
  steps: StatusStep[];
  /** Index 1-based de l'étape actuelle (1 = première étape) */
  currentStep: number;
  /** Titre optionnel affiché au-dessus du stepper */
  title?: string;
};

export default function StatusStepper({ steps, currentStep, title }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      {title && (
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </div>
      )}
      <div className="flex items-start justify-between gap-1">
        {steps.map((step, idx) => {
          const stepNumber = idx + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isLast = idx === steps.length - 1;

          return (
            <div key={idx} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Connector gauche (sauf premier) */}
                {idx > 0 && (
                  <div
                    className={`h-px flex-1 ${
                      isCompleted || isActive
                        ? "bg-emerald-500 dark:bg-emerald-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                )}

                {/* Cercle d'étape */}
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isCompleted
                      ? "bg-emerald-500 text-white dark:bg-emerald-600"
                      : isActive
                        ? "bg-[#FF9900] text-slate-950"
                        : "border border-slate-300 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted ? <Check size={12} strokeWidth={3} /> : stepNumber}
                </div>

                {/* Connector droite (sauf dernier) */}
                {!isLast && (
                  <div
                    className={`h-px flex-1 ${
                      isCompleted
                        ? "bg-emerald-500 dark:bg-emerald-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                )}
              </div>

              {/* Labels sous le cercle */}
              <div className="mt-2 text-center">
                <div
                  className={`text-[10px] font-medium leading-tight md:text-[11px] ${
                    isActive
                      ? "text-slate-900 dark:text-white"
                      : isCompleted
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-500 dark:text-slate-500"
                  }`}
                >
                  {step.label}
                </div>
                {step.sublabel && (
                  <div className="mt-0.5 hidden text-[9px] text-slate-400 md:block dark:text-slate-500">
                    {step.sublabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
