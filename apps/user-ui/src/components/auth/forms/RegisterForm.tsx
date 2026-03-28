"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useUiPreferences } from "@/components/providers/UiPreferencesProvider";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  getApiErrorData,
  getApiErrorMessage,
  hasApiBaseUrl,
  registerUser,
  type Gender,
} from "@/services/auth.api";

type RegisterFormData = {
  firstName: string;
  lastName: string;
  gender: Gender;
  email: string;
  password: string;
};

function normalizeForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function looksLikeSimpleDate(password: string) {
  const digits = password.replace(/\D/g, "");
  return /^\d{6}$/.test(digits) || /^\d{8}$/.test(digits);
}

function hasSequentialPattern(password: string) {
  const lower = password.toLowerCase();
  const patterns = [
    "1234",
    "2345",
    "3456",
    "4567",
    "5678",
    "6789",
    "abcd",
    "azerty",
    "qwerty",
    "password",
    "motdepasse",
  ];

  return patterns.some((pattern) => lower.includes(pattern));
}

function hasTooManyRepeatedChars(password: string) {
  return /(.)\1{2,}/.test(password);
}

function getPasswordChecks(
  password: string,
  context: { firstName: string; lastName: string; email: string }
) {
  const normalizedPassword = normalizeForComparison(password);
  const firstName = normalizeForComparison(context.firstName);
  const lastName = normalizeForComparison(context.lastName);
  const emailLocalPart = normalizeForComparison(context.email).split("@")[0] ?? "";

  const forbiddenParts = [firstName, lastName, emailLocalPart].filter(
    (value) => value.length >= 3
  );

  const includesPersonalInfo = forbiddenParts.some((value) =>
    normalizedPassword.includes(value)
  );

  return {
    minLength: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    personalInfo: !includesPersonalInfo,
    simpleDate: !looksLikeSimpleDate(password),
    predictable: !hasSequentialPattern(password) && !hasTooManyRepeatedChars(password),
  };
}

function validateStrongPassword(
  password: string,
  context: { firstName: string; lastName: string; email: string }
): true | string {
  const checks = getPasswordChecks(password, context);

  const baseChecksOk =
    checks.minLength &&
    checks.lowercase &&
    checks.uppercase &&
    checks.number &&
    checks.special;

  if (!baseChecksOk) {
    return "Choisissez un mot de passe d’au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial.";
  }

  if (!checks.personalInfo) {
    return "Pour votre sécurité, évitez d’utiliser votre prénom, votre nom ou votre e-mail dans le mot de passe.";
  }

  if (!checks.simpleDate) {
    return "Pour votre sécurité, évitez un mot de passe qui ressemble à une date facile à deviner.";
  }

  if (!checks.predictable) {
    return "Pour votre sécurité, évitez les suites simples, répétitions ou mots de passe trop prévisibles.";
  }

  return true;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.2 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.1-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.2 29.3 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.4 39.7 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.3 5.2C40.9 35.6 44 30.3 44 24c0-1.1-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z"
      />
      <path
        fill="#fff"
        d="M26.6 38V26.8h3.7l.6-4.4h-4.3v-2.8c0-1.3.4-2.2 2.2-2.2h2.3V13.5c-.4-.1-1.8-.2-3.4-.2-3.4 0-5.7 2.1-5.7 6v3.1h-3.8v4.4H24V38h2.6z"
      />
    </svg>
  );
}

export default function RegisterForm() {
  const router = useRouter();
  const { lang } = useUiPreferences();
  const [passwordVisible, setPasswordVisible] = useState(false);

  const copy = useMemo(() => {
    const fr = lang === "fr";
    return {
      title: fr ? "Bienvenue sur Yamba" : "Welcome to Yamba",
      subtitle: fr
        ? "Créez votre compte pour publier et retrouver vos trajets."
        : "Create an account to share and manage your trips.",
      firstName: fr ? "Prénom" : "First name",
      lastName: fr ? "Nom" : "Last name",
      gender: fr ? "Genre" : "Gender",
      email: fr ? "E-mail" : "Email",
      password: fr ? "Mot de passe" : "Password",
      pwdHint: fr
        ? "Utilisez au moins 8 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial."
        : "Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.",
      cta: fr ? "Créer mon compte" : "Create account",
      or: fr ? "OU" : "OR",
      google: fr ? "Créer un compte avec Google" : "Continue with Google",
      facebook: fr ? "Créer un compte avec Facebook" : "Continue with Facebook",
      have: fr ? "Vous avez déjà un compte ?" : "Already have an account?",
      login: fr ? "Connexion" : "Log in",
      show: fr ? "Afficher" : "Show",
      hide: fr ? "Masquer" : "Hide",
      requiredFirstName: fr ? "Le prénom est requis." : "First name is required.",
      requiredLastName: fr ? "Le nom est requis." : "Last name is required.",
      requiredGender: fr ? "Le genre est requis." : "Gender is required.",
      requiredEmail: fr ? "L’e-mail est requis." : "Email is required.",
      invalidEmail: fr ? "Veuillez saisir un e-mail valide." : "Please enter a valid email.",
      requiredPassword: fr ? "Le mot de passe est requis." : "Password is required.",
      genericError: fr
        ? "Inscription impossible pour le moment."
        : "Unable to sign up right now.",
      configError: fr
        ? "La configuration de l’application est incomplète."
        : "Application configuration is incomplete.",
      genderLabels: fr
        ? { MALE: "Homme", FEMALE: "Femme", OTHER: "Autre" }
        : { MALE: "Male", FEMALE: "Female", OTHER: "Other" },
      checklist: fr
        ? {
          minLength: "Au moins 8 caractères",
          lowercase: "Une lettre minuscule",
          uppercase: "Une lettre majuscule",
          number: "Un chiffre",
          special: "Un caractère spécial",
          personalInfo: "N’utilise pas ton prénom, ton nom ou ton e-mail",
          simpleDate: "Évite une date facile à deviner",
          predictable: "Évite les suites simples et répétitions",
        }
        : {
          minLength: "At least 8 characters",
          lowercase: "One lowercase letter",
          uppercase: "One uppercase letter",
          number: "One number",
          special: "One special character",
          personalInfo: "Do not use your name or email",
          simpleDate: "Avoid easy-to-guess dates",
          predictable: "Avoid simple sequences and repetitions",
        },
    };
  }, [lang]);

  const UI = {
    label: "text-sm font-semibold text-slate-800 dark:text-slate-100",
    input:
      "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    select:
      "mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none " +
      "focus:border-[#FF9900]/80 focus:ring-4 focus:ring-[#FF9900]/25 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white " +
      "dark:focus:border-[#FFAE33]/70 dark:focus:ring-[#FF9900]/18",
    inputError:
      "border-red-300 focus:border-red-400 focus:ring-red-200 dark:border-red-800 dark:focus:border-red-700 dark:focus:ring-red-900/40",
    btnPrimary:
      "w-full rounded-lg bg-[#FF9900] px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-[#F08700] active:bg-[#E07A00] disabled:opacity-60 " +
      "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9900]/30 " +
      "dark:focus-visible:ring-[#FF9900]/18",
    btnSecondary:
      "w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 " +
      "shadow-sm transition-colors hover:bg-slate-50 " +
      "dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-900/50",
    link:
      "font-semibold text-[#0F766E] hover:text-[#115E59] hover:underline " +
      "dark:text-[#2DD4BF] dark:hover:text-[#5EEAD4]",
    helperError: "mt-2 text-xs text-red-600 dark:text-red-400",
    help: "mt-2 text-xs text-slate-500 dark:text-slate-500",
    checklistItem: "mt-1 flex items-start gap-2 text-xs",
    checklistOk: "text-emerald-700 dark:text-emerald-400",
    checklistPending: "text-slate-500 dark:text-slate-400",
  };

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    getValues,
    watch,
    formState: { errors, isValid },
  } = useForm<RegisterFormData>({
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      gender: "OTHER",
      email: "",
      password: "",
    },
  });

  const watchedPassword = watch("password") ?? "";
  const watchedFirstName = watch("firstName") ?? "";
  const watchedLastName = watch("lastName") ?? "";
  const watchedEmail = watch("email") ?? "";

  const passwordChecks = getPasswordChecks(watchedPassword, {
    firstName: watchedFirstName,
    lastName: watchedLastName,
    email: watchedEmail,
  });

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data, variables) => {
      if (!data?.verificationToken) {
        setError("root.serverError", {
          type: "server",
          message: copy.genericError,
        });
        return;
      }

      sessionStorage.setItem(
        "register_verification_token",
        String(data.verificationToken)
      );

      sessionStorage.setItem(
        "register_verification_email",
        variables.email.trim().toLowerCase()
      );

      router.push(
        `/register/verify?email=${encodeURIComponent(
          variables.email.trim().toLowerCase()
        )}`
      );
      router.refresh();
    },
    onError: (error) => {
      const data = getApiErrorData(error);
      let hasFieldErrors = false;

      const fieldNames: Array<keyof RegisterFormData> = [
        "firstName",
        "lastName",
        "gender",
        "email",
        "password",
      ];

      for (const field of fieldNames) {
        const fieldMessage = data?.errors?.[field];
        if (fieldMessage) {
          hasFieldErrors = true;
          setError(field, {
            type: "server",
            message: String(fieldMessage),
          });
        }
      }

      if (!hasFieldErrors) {
        setError("root.serverError", {
          type: "server",
          message: getApiErrorMessage(error, copy.genericError),
        });
      }
    },
  });

  const onSubmit = async (values: RegisterFormData) => {
    clearErrors("root.serverError");

    if (!hasApiBaseUrl()) {
      setError("root.serverError", {
        type: "config",
        message: copy.configError,
      });
      return;
    }

    const payload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      gender: values.gender,
      email: values.email.trim().toLowerCase(),
      password: values.password,
    };

    try {
      await registerMutation.mutateAsync(payload);
    } catch {
      // géré par onError
    }
  };

  return (
    <main className="px-4">
      <div className="mx-auto flex min-h-[85vh] max-w-6xl items-center justify-center py-10">
        <div className="w-full max-w-[420px]">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {copy.subtitle}
          </p>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-8 space-y-5"
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className={UI.label}>
                  {copy.firstName}
                </label>
                <input
                  id="firstName"
                  autoComplete="given-name"
                  className={`${UI.input} ${errors.firstName ? UI.inputError : ""}`}
                  {...register("firstName", {
                    required: copy.requiredFirstName,
                    setValueAs: (value) =>
                      typeof value === "string" ? value.trim() : value,
                    onChange: () => {
                      clearErrors("firstName");
                      clearErrors("root.serverError");
                    },
                  })}
                />
                {errors.firstName?.message && (
                  <p className={UI.helperError}>{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="lastName" className={UI.label}>
                  {copy.lastName}
                </label>
                <input
                  id="lastName"
                  autoComplete="family-name"
                  className={`${UI.input} ${errors.lastName ? UI.inputError : ""}`}
                  {...register("lastName", {
                    required: copy.requiredLastName,
                    setValueAs: (value) =>
                      typeof value === "string" ? value.trim() : value,
                    onChange: () => {
                      clearErrors("lastName");
                      clearErrors("root.serverError");
                    },
                  })}
                />
                {errors.lastName?.message && (
                  <p className={UI.helperError}>{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="gender" className={UI.label}>
                {copy.gender}
              </label>
              <select
                id="gender"
                className={`${UI.select} ${errors.gender ? UI.inputError : ""}`}
                {...register("gender", {
                  required: copy.requiredGender,
                  onChange: () => {
                    clearErrors("gender");
                    clearErrors("root.serverError");
                  },
                })}
              >
                <option value="MALE">{copy.genderLabels.MALE}</option>
                <option value="FEMALE">{copy.genderLabels.FEMALE}</option>
                <option value="OTHER">{copy.genderLabels.OTHER}</option>
              </select>
              {errors.gender?.message && (
                <p className={UI.helperError}>{errors.gender.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className={UI.label}>
                {copy.email}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`${UI.input} ${errors.email ? UI.inputError : ""}`}
                {...register("email", {
                  required: copy.requiredEmail,
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: copy.invalidEmail,
                  },
                  setValueAs: (value) =>
                    typeof value === "string" ? value.trim().toLowerCase() : value,
                  onChange: () => {
                    clearErrors("email");
                    clearErrors("root.serverError");
                  },
                })}
              />
              {errors.email?.message && (
                <p className={UI.helperError}>{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className={UI.label}>
                {copy.password}
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  className={`${UI.input} pr-12 ${errors.password ? UI.inputError : ""}`}
                  {...register("password", {
                    required: copy.requiredPassword,
                    validate: (value) =>
                      validateStrongPassword(value, {
                        firstName: getValues("firstName"),
                        lastName: getValues("lastName"),
                        email: getValues("email"),
                      }),
                    onChange: () => {
                      clearErrors("password");
                      clearErrors("root.serverError");
                    },
                  })}
                />

                <button
                  type="button"
                  onClick={() => setPasswordVisible((v) => !v)}
                  aria-label={passwordVisible ? copy.hide : copy.show}
                  aria-pressed={passwordVisible}
                  className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {!errors.password?.message && (
                <p className={UI.help}>{copy.pwdHint}</p>
              )}

              {watchedPassword.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className={`${UI.checklistItem} ${passwordChecks.minLength ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.minLength ? "✓" : "•"}</span>
                    <span>{copy.checklist.minLength}</span>
                  </div>

                  <div className={`${UI.checklistItem} ${passwordChecks.lowercase ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.lowercase ? "✓" : "•"}</span>
                    <span>{copy.checklist.lowercase}</span>
                  </div>

                  <div className={`${UI.checklistItem} ${passwordChecks.uppercase ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.uppercase ? "✓" : "•"}</span>
                    <span>{copy.checklist.uppercase}</span>
                  </div>

                  <div className={`${UI.checklistItem} ${passwordChecks.number ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.number ? "✓" : "•"}</span>
                    <span>{copy.checklist.number}</span>
                  </div>

                  <div className={`${UI.checklistItem} ${passwordChecks.special ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.special ? "✓" : "•"}</span>
                    <span>{copy.checklist.special}</span>
                  </div>

                  <div className={`${UI.checklistItem} ${passwordChecks.personalInfo ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.personalInfo ? "✓" : "•"}</span>
                    <span>{copy.checklist.personalInfo}</span>
                  </div>

                  <div className={`${UI.checklistItem} ${passwordChecks.simpleDate ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.simpleDate ? "✓" : "•"}</span>
                    <span>{copy.checklist.simpleDate}</span>
                  </div>

                  <div className={`${UI.checklistItem} ${passwordChecks.predictable ? UI.checklistOk : UI.checklistPending}`}>
                    <span>{passwordChecks.predictable ? "✓" : "•"}</span>
                    <span>{copy.checklist.predictable}</span>
                  </div>
                </div>
              )}

              {errors.password?.message && (
                <p className={UI.helperError}>{errors.password.message}</p>
              )}
            </div>

            {errors.root?.serverError?.message && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {errors.root.serverError.message}
              </div>
            )}

            <button
              type="submit"
              disabled={registerMutation.isPending || !isValid}
              className={UI.btnPrimary}
            >
              {registerMutation.isPending ? "…" : copy.cta}
            </button>

            <div className="flex items-center gap-4 pt-1">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-semibold text-slate-400">
                {copy.or}
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => console.log("google oauth (ui only)")}
                className={UI.btnSecondary}
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <GoogleIcon />
                  {copy.google}
                </span>
              </button>

              <button
                type="button"
                onClick={() => console.log("facebook oauth (ui only)")}
                className={UI.btnSecondary}
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <FacebookIcon />
                  {copy.facebook}
                </span>
              </button>
            </div>

            <div className="pt-3 text-center text-sm text-slate-600 dark:text-slate-400">
              {copy.have}{" "}
              <Link href="/login" className={UI.link}>
                {copy.login}
              </Link>
            </div>
          </form>

          <p className="mt-6 text-xs text-slate-500 dark:text-slate-500">
            Vérifiez l’URL pour vous assurer de vous connecter au bon site.
          </p>
        </div>
      </div>
    </main>
  );
}
