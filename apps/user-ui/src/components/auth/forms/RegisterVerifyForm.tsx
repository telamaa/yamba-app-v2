"use client";

/**
 * RegisterVerifyForm.tsx — la vérification du code d'inscription (D92).
 * =====================================================================
 * Une SALLE D'ATTENTE, pas un formulaire : c'est le seul écran du produit où
 * l'utilisateur sort du site pour aller chercher un code dans sa boîte mail,
 * et doit vouloir revenir. Sept décisions de D92 vivent ici.
 *
 *  1A — la colonne de gauche cesse de vendre (elle servait l'argumentaire
 *       d'acquisition à quelqu'un qui a déjà signé) et répond à la question
 *       du moment : « et si le mail n'arrive pas ? ». Plus de badge de
 *       sécurité auto-décerné non plus : un signal de confiance nomme un
 *       tiers ou un fait vérifiable, sinon il ne dit rien (règle 1A de D91).
 *  2A — l'adresse est EN CLAIR, avec « Modifier » à côté. On masque une
 *       adresse que l'utilisateur n'a PAS tapée ; celle-ci a été saisie
 *       trente secondes plus tôt, et le masque détruisait la seule fonction
 *       utile de la ligne : attraper la faute de frappe.
 *  3A — la connexion est ENCHAÎNÉE après la vérification (mot de passe en
 *       mémoire de module, voir `register-flow-state.ts`), donc le titre
 *       « Plus qu'une étape ! » devient vrai. Repli : connexion préremplie.
 *  4A — la sixième frappe valide d'office, et le focus est dans la première
 *       case à l'arrivée. Le CTA reste, visible, et NOMME le manquement.
 *  5A — les cases se voient : une case dans laquelle on doit taper ne peut
 *       pas être de la couleur de la page (1,32:1 mesuré, 3:1 exigé par
 *       WCAG 2.1 SC 1.4.11). La case remplie passe au teal de la charte.
 *  6A — un seul compte à rebours à l'écran, et l'aide arrive quand elle sert
 *       (règles pures dans `lib/auth/otp-display.ts`).
 *  7A — les textes vivent dans `messages/{fr,en}/auth.json` sous `auth.otp`,
 *       espace de noms calqué sur celui du mobile : les deux fronts passent
 *       enfin sous le même contrôle i18n de la CI.
 *
 * Reste en ternaires `fr ? … : …`, DÉLIBÉRÉMENT : `otpCodeMessage` et les
 * messages de règle de mot de passe, parce qu'ils sont PARTAGÉS avec trois
 * autres formulaires d'auth. Leur migration est le lot i18n nommé par D91,
 * pas celui-ci — on migre l'écran que l'on touche.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { otpCodeMessage, type OtpErrorCode } from "@/lib/auth/auth-error-codes";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Clock, Loader2, Mail } from "lucide-react";
import {
  cancelRegistration,
  getApiErrorData,
  getApiErrorMessage,
  hasApiBaseUrl,
  loginUser,
  resendRegistrationOtp,
  verifyRegistrationOtp,
} from "@/services/auth.api";
import type { HeroVisual } from "@/lib/auth/hero-visuals";
import { setFlashToast } from "@/lib/flash-toast";
import { REGISTER_REDIRECT_KEY, sanitizeRedirect, withRedirect } from "@/lib/auth/safe-redirect";
import { clearPendingPassword, readPendingPassword } from "@/lib/auth/register-flow-state";
import {
  OTP_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  resendPhase,
  showValidity,
} from "@/lib/auth/otp-display";
import { webmailUrl } from "@/lib/auth/webmail";
import { useToast } from "@/components/ui/Toast";
import AuthHeroVisual from "@/components/auth/visual/AuthHeroVisual";

const OTP_LENGTH = 6;

type VerifyFormData = {
  otp: string;
};

type OtpErrorDetails = {
  type?: string;
  code?: OtpErrorCode;
  attemptsLeft?: number;
  locked?: boolean;
  lockUntilSeconds?: number;
  otpInvalidated?: boolean;
};

type ErrorContext = {
  attemptsLeft?: number;
  locked: boolean;
  lockUntilSeconds?: number;
};

type Props = {
  heroVisual: HeroVisual;
};

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** `754` → `12:34`, `29` → `00:29` — jumeau de `formatMMSS` du mobile. */
function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RegisterVerifyForm({ heroVisual }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const { lang } = useUiPreferences();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const t = useTranslations("auth.otp");
  const fr = lang === "fr";

  const tokenFromQuery = sp.get("token") ?? "";
  const emailFromQuery = sp.get("email") ?? "";

  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);
  const [expiryTimer, setExpiryTimer] = useState(OTP_EXPIRY_SECONDS);

  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);
  const [lockTimer, setLockTimer] = useState(0);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const resendIntervalRef = useRef<number | null>(null);
  const expiryIntervalRef = useRef<number | null>(null);
  const lockIntervalRef = useRef<number | null>(null);
  /** La vérification d'office ne part qu'UNE fois par saisie complète. */
  const verifiedValue = useRef("");

  // 🔒 Init from URL or sessionStorage (double fallback robuste)
  // - URL : utile pour les liens magiques email envoyés par le backend
  // - sessionStorage : flow normal après /register (sans email en URL)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const t =
      tokenFromQuery ||
      sessionStorage.getItem("register_verification_token") ||
      "";
    const e =
      emailFromQuery ||
      sessionStorage.getItem("register_verification_email") ||
      "";

    setToken(t);
    setEmail(e);

    if (tokenFromQuery) {
      sessionStorage.setItem("register_verification_token", tokenFromQuery);
    }
    if (emailFromQuery) {
      sessionStorage.setItem("register_verification_email", emailFromQuery);
    }

    // 🔒 Protection défensive : si l'utilisateur arrive ici sans token/email
    // (ex: il a tapé l'URL directement, ou la session a expiré), on le
    // redirige vers /register pour qu'il recommence proprement
    if (!t && !e) {
      router.push("/register");
    }
  }, [tokenFromQuery, emailFromQuery, router]);

  const {
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<VerifyFormData>({
    mode: "onSubmit",
    defaultValues: { otp: "" },
  });

  const otp = digits.join("");

  useEffect(() => {
    setValue("otp", otp);
  }, [otp, setValue]);

  const clearResendTimer = () => {
    if (resendIntervalRef.current) {
      window.clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }
  };

  const clearExpiryTimer = () => {
    if (expiryIntervalRef.current) {
      window.clearInterval(expiryIntervalRef.current);
      expiryIntervalRef.current = null;
    }
  };

  const clearLockTimer = () => {
    if (lockIntervalRef.current) {
      window.clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
  };

  const startResendTimer = () => {
    clearResendTimer();
    setResendTimer(RESEND_COOLDOWN_SECONDS);
    resendIntervalRef.current = window.setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearResendTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startExpiryTimer = () => {
    clearExpiryTimer();
    setExpiryTimer(OTP_EXPIRY_SECONDS);
    expiryIntervalRef.current = window.setInterval(() => {
      setExpiryTimer((prev) => {
        if (prev <= 1) {
          clearExpiryTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startLockTimer = (durationSeconds: number) => {
    clearLockTimer();
    setLockTimer(durationSeconds);
    lockIntervalRef.current = window.setInterval(() => {
      setLockTimer((prev) => {
        if (prev <= 1) {
          clearLockTimer();
          setErrorContext(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (token) {
      startResendTimer();
      startExpiryTimer();
      // D92 4A — le focus est DANS la première case à l'arrivée. Sans lui on
      // arrivait sur six cases, on collait son code, et rien ne se passait :
      // il fallait d'abord cliquer. Le seul `focus()` du fichier vivait dans
      // la branche de succès du renvoi, c'est-à-dire presque jamais.
      inputsRef.current[0]?.focus();
    }
    return () => {
      clearResendTimer();
      clearExpiryTimer();
      clearLockTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * D92 3A — la connexion enchaînée. Un échec ici (réseau, mot de passe
   * perdu par un rechargement) retombe sur la connexion préremplie avec son
   * bandeau « compte activé » : jamais un compte activé bloqué sur un écran.
   */
  const finishAfterVerification = async () => {
    const verifiedEmail =
      emailFromQuery || sessionStorage.getItem("register_verification_email") || email;
    const redirectTo = sanitizeRedirect(sessionStorage.getItem(REGISTER_REDIRECT_KEY));
    const password = readPendingPassword(verifiedEmail);

    sessionStorage.removeItem("register_verification_token");
    sessionStorage.removeItem("register_verification_email");
    sessionStorage.removeItem(REGISTER_REDIRECT_KEY);
    clearPendingPassword();

    if (password !== null) {
      try {
        // `rememberMe: false` — la valeur par défaut du formulaire de
        // connexion. L'enchaînement ne doit pas DÉCIDER à la place de
        // l'utilisateur d'une session longue qu'il n'a pas demandée.
        await loginUser({ email: verifiedEmail, password, rememberMe: false });
        await queryClient.invalidateQueries({ queryKey: ["user"] });
        router.push(redirectTo || "/");
        router.refresh();
        return;
      } catch {
        // on continue vers la connexion préremplie
      }
    }

    setFlashToast({ type: "success", message: t("verifiedFlash"), persistent: true });
    router.push(
      withRedirect(
        "/login?verified=1" + (verifiedEmail ? "&email=" + encodeURIComponent(verifiedEmail) : ""),
        redirectTo
      )
    );
    router.refresh();
  };

  const verifyOtpMutation = useMutation({
    mutationFn: verifyRegistrationOtp,
    onSuccess: () => {
      void finishAfterVerification();
    },
    onError: (error) => {
      verifiedValue.current = "";
      const data = getApiErrorData(error);

      const details = (data as { details?: OtpErrorDetails })?.details;

      if (details?.type === "otp") {
        setErrorContext({
          attemptsLeft: details.attemptsLeft,
          locked: details.locked ?? false,
          lockUntilSeconds: details.lockUntilSeconds,
        });

        if (details.locked && details.lockUntilSeconds) {
          startLockTimer(details.lockUntilSeconds);
        }

        // Jamais le message anglais brut de l'API : phrase construite du code
        setError("otp", {
          type: "server",
          message: otpCodeMessage(fr, { ...details, type: "otp" }),
        });
        return;
      }

      if (data?.errors?.otp) {
        setError("otp", { type: "server", message: String(data.errors.otp) });
        return;
      }

      setError("root.serverError", {
        type: "server",
        message: getApiErrorMessage(error, t("invalidOtp")),
      });
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: resendRegistrationOtp,
    onSuccess: (data, variables) => {
      const nextToken = data?.verificationToken || variables.verificationToken;
      sessionStorage.setItem("register_verification_token", nextToken);
      setToken(nextToken);
      setDigits(Array(OTP_LENGTH).fill(""));
      setErrorContext(null);
      verifiedValue.current = "";
      startResendTimer();
      startExpiryTimer();
      inputsRef.current[0]?.focus();
      toast({
        type: "success",
        title: t("resentTitle"),
        message: t("resentMessage"),
      });
    },
    onError: (error) => {
      setError("root.serverError", {
        type: "server",
        message: getApiErrorMessage(error, t("genericError")),
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelRegistration,
    onSuccess: () => {
      sessionStorage.removeItem("register_verification_token");
      sessionStorage.removeItem("register_verification_email");
      clearPendingPassword();
      router.push("/register");
    },
    onError: () => {
      sessionStorage.removeItem("register_verification_token");
      sessionStorage.removeItem("register_verification_email");
      clearPendingPassword();
      router.push("/register");
    },
  });

  const focusIndex = (i: number) => {
    const el = inputsRef.current[i];
    el?.focus();
    el?.select();
  };

  const updateDigitAt = (index: number, value: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const fillDigits = (value: string) => {
    const clean = onlyDigits(value).slice(0, OTP_LENGTH);
    const next = Array(OTP_LENGTH).fill("");
    clean.split("").forEach((char, idx) => {
      next[idx] = char;
    });
    setDigits(next);
    return clean;
  };

  const handleChange = (index: number, raw: string) => {
    clearErrors("otp");
    clearErrors("root.serverError");
    setErrorContext(null);

    const value = onlyDigits(raw);

    if (value.length >= 2) {
      const pasted = fillDigits(value);
      focusIndex(Math.min(pasted.length - 1, OTP_LENGTH - 1));
      return;
    }

    const one = value.slice(0, 1);
    updateDigitAt(index, one);

    if (one && index < OTP_LENGTH - 1) {
      focusIndex(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    clearErrors("otp");
    clearErrors("root.serverError");

    if (e.key === "Backspace") {
      if (digits[index]) {
        updateDigitAt(index, "");
        return;
      }
      if (index > 0) {
        updateDigitAt(index - 1, "");
        focusIndex(index - 1);
      }
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) focusIndex(index - 1);
    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) focusIndex(index + 1);
  };

  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    clearErrors("otp");
    clearErrors("root.serverError");
    const text = onlyDigits(e.clipboardData.getData("text")).slice(0, OTP_LENGTH);
    if (!text) return;
    fillDigits(text);
    focusIndex(Math.min(text.length - 1, OTP_LENGTH - 1));
  };

  const expiryWarning = expiryTimer > 0 && expiryTimer <= 60;
  const expired = expiryTimer === 0;
  const isLocked = errorContext?.locked === true && lockTimer > 0;

  const verifyOtp = useCallback(
    async (otpValue: string) => {
      clearErrors("otp");
      clearErrors("root.serverError");

      if (!hasApiBaseUrl()) {
        setError("root.serverError", { type: "config", message: t("configError") });
        return;
      }
      if (!token) {
        setError("root.serverError", { type: "session", message: t("missingToken") });
        return;
      }
      if (otpValue.length !== OTP_LENGTH) {
        setError("otp", { type: "manual", message: t("incomplete") });
        return;
      }

      try {
        await verifyOtpMutation.mutateAsync({
          verificationToken: token,
          otp: otpValue,
        });
      } catch {
        // géré dans onError
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, t, clearErrors, setError]
  );

  // D92 4A — sixième chiffre → vérification d'office. Le geste attendu
  // partout ailleurs, et celui que le téléphone faisait déjà : six cases
  // pleines qui ne déclenchent rien sont une impasse silencieuse.
  const canAutoVerify =
    otp.length === OTP_LENGTH && !verifyOtpMutation.isPending && !expired && !isLocked;
  useEffect(() => {
    if (canAutoVerify && verifiedValue.current !== otp) {
      verifiedValue.current = otp;
      void verifyOtp(otp);
    }
  }, [otp, canAutoVerify, verifyOtp]);

  const onSubmit = async (values: VerifyFormData) => {
    await verifyOtp(values.otp);
  };

  const canResend = resendTimer === 0 && !errorContext?.locked;
  const phase = canResend ? "ready" : resendPhase(resendTimer);
  const mailbox = useMemo(() => (email ? webmailUrl(email) : null), [email]);

  const resendOtp = async () => {
    if (!canResend || !token) return;
    clearErrors("root.serverError");
    try {
      await resendOtpMutation.mutateAsync({ verificationToken: token });
    } catch {
      // géré dans onError
    }
  };

  const handleStartOver = () => {
    if (window.confirm(t("changeConfirm"))) {
      clearPendingPassword();
      if (!token) {
        router.push("/register");
        return;
      }
      cancelMutation.mutate({ verificationToken: token });
    }
  };

  const attemptsLeft = errorContext?.attemptsLeft;
  const showAttemptsWarning =
    typeof attemptsLeft === "number" && attemptsLeft >= 0 && !isLocked;

  const lockedDuration = (): string => {
    if (lockTimer < 60) return t("lockSeconds", { count: lockTimer });
    if (lockTimer < 3600) return t("lockMinutes", { count: Math.ceil(lockTimer / 60) });
    return t("lockHours", { count: Math.ceil(lockTimer / 3600) });
  };

  const mailboxButton =
    mailbox === null ? null : (
      <a
        href={mailbox}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
      >
        <Mail size={16} aria-hidden />
        {t("openMailbox")}
      </a>
    );

  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(var(--yamba-viewport)-64px)]">
      {/* LEFT — la colonne répond à l'attente, elle ne vend plus (D92 1A) */}
      <div className="hidden lg:block">
        <AuthHeroVisual visual={heroVisual} variant="waiting" action={mailboxButton} />
      </div>

      {/* RIGHT — formulaire */}
      <div className="flex items-center justify-center px-4 py-8 lg:px-8 lg:py-10">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white lg:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t("sentTo")}</p>

          {/* D92 2A — l'adresse EN CLAIR, et le geste qui répond d'elle.
              `break-all` : une adresse longue se replie plutôt que de
              déborder, elle ne se tronque jamais — c'est elle que l'on
              relit pour attraper la faute de frappe. */}
          {email && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
              <span className="min-w-0 break-all font-mono text-sm text-slate-900 dark:text-white">
                {email}
              </span>
              <button
                type="button"
                onClick={handleStartOver}
                disabled={cancelMutation.isPending}
                className="flex-shrink-0 text-xs font-semibold text-[#0D9488] underline underline-offset-2 decoration-[#0D9488]/40 hover:decoration-[#0D9488] disabled:opacity-50 dark:text-[#2DD4BF] dark:decoration-[#2DD4BF]/40 dark:hover:decoration-[#2DD4BF]"
              >
                {cancelMutation.isPending ? "…" : t("changeEmail")}
              </button>
            </div>
          )}

          {/* La boîte mail, sous l'adresse, en colonne étroite (le desktop la
              tient à gauche — ici elle serait hors écran). */}
          {mailbox !== null && <div className="mt-3 lg:hidden">{mailboxButton}</div>}

          {/* D92 6A — la validité ne se montre qu'à sa dernière minute. */}
          {isLocked ? (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={12} />
              <span>{t("lockedRetryIn")}</span>
              <span className="font-mono font-bold">{lockedDuration()}</span>
            </div>
          ) : (
            showValidity(expiryTimer) && (
              <div
                className={`mt-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                  expired
                    ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                    : expiryWarning
                      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                }`}
              >
                <Clock size={12} />
                {expired ? (
                  <span className="font-semibold">{t("expired")}</span>
                ) : (
                  <>
                    <span>{t("validFor")}</span>
                    <span className="font-mono font-bold">{formatMMSS(expiryTimer)}</span>
                  </>
                )}
              </div>
            )
          )}

          {/* OTP form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4">
            <div>
              <label className="block text-center text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
                {t("enterCode")}
              </label>

              <div
                className="flex items-center justify-center gap-2 sm:gap-2.5"
                onPaste={handlePaste}
              >
                {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d*"
                    maxLength={1}
                    value={digits[i]}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    disabled={expired || isLocked || verifyOtpMutation.isPending}
                    /* D92 5A — la case se VOIT : `slate-950` sur une page
                       `slate-950` bordée de `slate-800` donnait 1,32:1 là où
                       WCAG 2.1 SC 1.4.11 exige 3:1 pour la limite d'un
                       contrôle. Fond remonté d'un cran, bordure `slate-600`.
                       Et la case remplie prend le TEAL de la charte : le
                       vert qu'elle portait avant y faisait entrer une
                       troisième teinte, étrangère à la marque. */
                    className={`h-12 w-10 rounded-lg border bg-white text-center font-mono text-lg font-bold text-slate-900 outline-none transition-all sm:h-13 sm:w-11 dark:text-white ${
                      errors.otp || isLocked
                        ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-200 dark:border-red-700 dark:bg-red-950/20 dark:focus:border-red-600 dark:focus:ring-red-900/40"
                        : digits[i]
                          ? "border-[#0F766E] bg-teal-50/40 focus:ring-4 focus:ring-[#0F766E]/20 dark:border-[#2DD4BF] dark:bg-teal-950/20 dark:focus:ring-[#2DD4BF]/25"
                          : "border-slate-300 bg-white focus:border-[#FF9900] focus:ring-4 focus:ring-[#FF9900]/20 dark:border-slate-600 dark:bg-slate-900 dark:focus:border-[#FFAE33]"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label={`${t("enterCode")} ${i + 1}/${OTP_LENGTH}`}
                  />
                ))}
              </div>

              <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                {t("pasteHint")}
              </p>

              {showAttemptsWarning && attemptsLeft !== undefined && attemptsLeft > 0 && (
                <div
                  role="alert"
                  className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                    attemptsLeft === 1
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                      : attemptsLeft <= 2
                        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
                        : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                  }`}
                >
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold">{t("incorrectCode")}</span>{" "}
                    <span>{t("attemptsLeft", { count: attemptsLeft })}</span>
                  </div>
                </div>
              )}

              {isLocked && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400"
                    />
                    <div className="text-xs">
                      <p className="font-bold text-red-800 dark:text-red-300">{t("locked")}</p>
                      <p className="mt-1 text-red-700 dark:text-red-400">{t("lockedTip")}</p>
                    </div>
                  </div>
                </div>
              )}

              {errors.otp?.message && !showAttemptsWarning && !isLocked && (
                <div
                  role="alert"
                  className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {errors.otp.message}
                </div>
              )}
            </div>

            {errors.root?.serverError?.message && !isLocked && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              >
                {errors.root.serverError.message}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyOtpMutation.isPending || expired || isLocked}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30"
            >
              {verifyOtpMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t("verifying")}
                </>
              ) : (
                t("verify")
              )}
            </button>
          </form>

          {/* D92 6A — le bloc de renvoi en trois temps. Jamais une phrase
              ouverte sur un non-geste : « … tes spams OU » suivi d'un lien
              grisé laissait un « ou » pendre dans le vide une minute durant. */}
          <div className="mt-5 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
            {phase === "ready" ? (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("notReceived")}</p>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={resendOtpMutation.isPending}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[#0D9488] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#2DD4BF] dark:hover:bg-slate-900/40"
                >
                  {resendOtpMutation.isPending ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : null}
                  {t("resend")}
                </button>
              </>
            ) : phase === "early" ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("hintEarly")}</p>
            ) : (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("notReceivedWaiting")}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("resendIn", { time: formatMMSS(resendTimer) })}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
