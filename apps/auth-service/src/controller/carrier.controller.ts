import type { Response, NextFunction } from "express";
import prisma from "@packages/libs/prisma";
import { ValidationError } from "@packages/error-handler";
import { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { Role } from "@prisma/client";
import Stripe from "stripe";
import {sendOnboardingCompleteEmail} from "../service/onboarding-email.service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

// URL frontend (pour les redirections Stripe)
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

/**
 * Active le statut carrier et ajoute le rôle CARRIER si nécessaire
 */
const activateCarrier = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const currentRoles: Role[] = user?.roles ?? [];
  const updatedRoles: Role[] = currentRoles.includes(Role.CARRIER)
    ? currentRoles
    : [...currentRoles, Role.CARRIER];

  await prisma.user.update({
    where: { id: userId },
    data: {
      carrierStatus: "ACTIVE",
      roles: updatedRoles,
    },
  });
};

/**
 * Données d'adresse envoyées par le frontend après sélection Google Places
 */
type AddressInput = {
  formattedAddress?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  streetLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
};

/**
 * POST /api/carrier/onboarding/profile
 * Étape 1 : Créer ou mettre à jour le profil CarrierPage
 */
export const saveCarrierProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ValidationError("Unauthorized"));
    }

    const { name, bio, address, phoneE164 } = req.body as {
      name?: string;
      bio?: string;
      address?: AddressInput;
      phoneE164?: string;
    };

    if (!name || !name.trim()) {
      return next(new ValidationError("Name is required!"));
    }

    if (bio && bio.length > 500) {
      return next(new ValidationError("Bio must be 500 characters or less."));
    }

    const userId = req.user.id;

    // Gérer l'adresse principale si des données d'adresse sont fournies
    let primaryAddressId: string | undefined;

    if (address?.formattedAddress || address?.city || address?.country) {
      const existingPage = await prisma.carrierPage.findUnique({
        where: { userId },
        select: { primaryAddressId: true },
      });

      const label = address.formattedAddress
        || [address.city, address.country].filter(Boolean).join(", ")
        || "Adresse principale";

      const addressData = {
        formattedAddress: address.formattedAddress?.trim() || null,
        placeId: address.placeId?.trim() || null,
        lat: address.lat ?? null,
        lng: address.lng ?? null,
        streetLine1: address.streetLine1?.trim() || null,
        city: address.city?.trim() || null,
        region: address.region?.trim() || null,
        postalCode: address.postalCode?.trim() || null,
        country: address.country?.trim() || null,
        countryCode: address.countryCode?.trim()?.toUpperCase() || null,
        label,
      };

      if (existingPage?.primaryAddressId) {
        await prisma.address.update({
          where: { id: existingPage.primaryAddressId },
          data: addressData,
        });
        primaryAddressId = existingPage.primaryAddressId;
      } else {
        const newAddress = await prisma.address.create({
          data: {
            userId,
            ...addressData,
          },
        });
        primaryAddressId = newAddress.id;
      }
    }

    // Upsert CarrierPage
    const carrierPage = await prisma.carrierPage.upsert({
      where: { userId },
      create: {
        userId,
        name: name.trim(),
        bio: bio?.trim() || null,
        phoneE164: phoneE164?.trim() || null,
        primaryAddressId: primaryAddressId ?? null,
        onboardingStep: "STRIPE",
      },
      update: {
        name: name.trim(),
        bio: bio?.trim() || null,
        phoneE164: phoneE164?.trim() || null,
        ...(primaryAddressId ? { primaryAddressId } : {}),
        onboardingStep: "STRIPE",
      },
      include: {
        primaryAddress: {
          select: {
            formattedAddress: true,
            city: true,
            country: true,
            countryCode: true,
          },
        },
      },
    });

    // Mettre à jour le statut sur User
    await prisma.user.update({
      where: { id: userId },
      data: {
        carrierStatus: "ONBOARDING",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Carrier profile saved.",
      carrierPage,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/carrier/onboarding/stripe
 * Étape 2 : Créer un compte Stripe Connect et retourner le lien d'onboarding
 */
export const createStripeConnectLink = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ValidationError("Unauthorized"));
    }

    const userId = req.user.id;

    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
      include: {
        primaryAddress: {
          select: {
            countryCode: true,
            streetLine1: true,
            city: true,
            region: true,
            postalCode: true,
          },
        },
      },
    });

    if (!carrierPage) {
      return next(new ValidationError("Please complete your profile first."));
    }

    let stripeAccountId = carrierPage.stripeAccountId;

    // Créer le compte Stripe Connect s'il n'existe pas encore
    if (!stripeAccountId) {
      // Valider le countryCode (doit être un code ISO 2 lettres majuscules)
      const rawCode = carrierPage.primaryAddress?.countryCode?.toUpperCase();
      const isValidCountryCode = rawCode && /^[A-Z]{2}$/.test(rawCode);

      if (!isValidCountryCode) {
        return next(
          new ValidationError(
            "Country is required to set up Stripe. Please update your address in your carrier profile."
          )
        );
      }

      const country = rawCode;

      // Pré-remplir Stripe avec les données déjà saisies à l'étape 1
      const pa = carrierPage.primaryAddress;
      const nameParts = carrierPage.name?.split(" ") ?? [];

      // Récupérer la date de naissance du User pour pré-remplir Stripe
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { birthDate: true, firstName: true, lastName: true },
      });

      const account = await stripe.accounts.create({
        type: "express",
        email: req.user.email,
        country,
        business_type: "individual",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        individual: {
          // Identité — on utilise les vrais noms du User (pas le nom d'espace)
          first_name: userRecord?.firstName || nameParts[0] || undefined,
          last_name: userRecord?.lastName || nameParts.slice(1).join(" ") || undefined,
          email: req.user.email,
          phone: carrierPage.phoneE164?.startsWith("+") ? carrierPage.phoneE164 : undefined,

          // Date de naissance (si renseignée à l'inscription)
          ...(userRecord?.birthDate
            ? {
              dob: {
                day: userRecord.birthDate.getUTCDate(),
                month: userRecord.birthDate.getUTCMonth() + 1,
                year: userRecord.birthDate.getUTCFullYear(),
              },
            }
            : {}),

          // Adresse
          address: pa
            ? {
              line1: pa.streetLine1 || undefined,
              city: pa.city || undefined,
              state: pa.region || undefined,
              postal_code: pa.postalCode || undefined,
              country: pa.countryCode || undefined,
            }
            : undefined,
        },
        business_profile: {
          // MCC 4215 = "Courier Services" — pré-remplit "Industry" sur Stripe
          mcc: "4215",
          product_description: "Transport de colis entre particuliers via Yamba",
          // URL : profil carrier en prod, omis en dev (Stripe refuse localhost)
          ...(FRONTEND_URL.includes("localhost")
            ? {}
            : { url: `${FRONTEND_URL}/carrier/${userId}` }),
          // Support — pré-remplit les champs contact sur Stripe
          support_email: req.user.email,
          support_phone: carrierPage.phoneE164?.startsWith("+") ? carrierPage.phoneE164 : undefined,
        },
        tos_acceptance: {
          service_agreement: "full",
        },
      });

      stripeAccountId = account.id;

      // Stocker l'ID Stripe sur la CarrierPage
      await prisma.carrierPage.update({
        where: { userId },
        data: {
          stripeAccountId: account.id,
        },
      });
    }

    // Générer le lien d'onboarding Stripe
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${FRONTEND_URL}/carrier/onboarding/stripe/callback?refresh=true`,
      return_url: `${FRONTEND_URL}/carrier/onboarding/stripe/callback`,
      type: "account_onboarding",
    });

    return res.status(200).json({
      success: true,
      url: accountLink.url,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/carrier/onboarding/stripe/status
 * Vérifie le statut du compte Stripe après le retour de l'onboarding Stripe
 */
export const checkStripeStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ValidationError("Unauthorized"));
    }

    const userId = req.user.id;

    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
    });

    if (!carrierPage?.stripeAccountId) {
      return res.status(200).json({
        success: true,
        status: "not_started",
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    // Récupérer le statut du compte depuis Stripe
    const account = await stripe.accounts.retrieve(carrierPage.stripeAccountId);

    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    // Mettre à jour les flags en base
    await prisma.carrierPage.update({
      where: { userId },
      data: {
        stripeChargesEnabled: chargesEnabled,
        stripePayoutsEnabled: payoutsEnabled,
        stripeOnboardingComplete: detailsSubmitted,
      },
    });

    // Si l'onboarding Stripe est complet ET pas encore activé, activer + envoyer l'email
    if (detailsSubmitted && chargesEnabled && carrierPage.onboardingStep !== "COMPLETE") {
      await prisma.carrierPage.update({
        where: { userId },
        data: {
          onboardingStep: "COMPLETE",
        },
      });

      await activateCarrier(userId);
      await sendOnboardingCompleteEmail(userId);
    }

    return res.status(200).json({
      success: true,
      status: detailsSubmitted ? "complete" : "pending",
      chargesEnabled,
      payoutsEnabled,
      detailsSubmitted,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/carrier/onboarding/complete
 * Finalise l'onboarding (skip Stripe — utilisé si l'utilisateur saute l'étape)
 */
export const completeCarrierOnboarding = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(new ValidationError("Unauthorized"));
    }

    const userId = req.user.id;

    const carrierPage = await prisma.carrierPage.findUnique({
      where: { userId },
    });

    if (!carrierPage) {
      return next(new ValidationError("Please complete your profile first."));
    }

    // Déjà complété — répondre sans renvoyer d'email
    if (carrierPage.onboardingStep === "COMPLETE") {
      return res.status(200).json({
        success: true,
        message: "Carrier onboarding already complete.",
      });
    }

    await prisma.carrierPage.update({
      where: { userId },
      data: {
        onboardingStep: "COMPLETE",
      },
    });

    await activateCarrier(userId);
    await sendOnboardingCompleteEmail(userId);

    return res.status(200).json({
      success: true,
      message: "Carrier onboarding complete!",
    });
  } catch (error) {
    return next(error);
  }
};
