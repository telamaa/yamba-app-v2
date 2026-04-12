import prisma from "../../../../packages/libs/prisma";


const initializeSiteConfig = async () => {
  try {
    const existing = await prisma.siteConfig.findFirst();

    if (!existing) {
      await prisma.siteConfig.create({
        data: {
          commissionRate: 0.10,
          maxDocSizeMb: 5,
          maxDocsPerTrip: 5,
        },
      });
      console.log("✅ Site config initialized.");
    }
  } catch (error) {
    console.error("❌ Error initializing site config:", error);
  }
};

export default initializeSiteConfig;
