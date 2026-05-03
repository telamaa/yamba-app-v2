import fs from "node:fs/promises";
import path from "node:path";
import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const fr = locale === "fr";

  const fileName = fr ? "privacy-fr.md" : "privacy-en.md";
  const filePath = path.join(process.cwd(), "content", "legal", fileName);
  const content = await fs.readFile(filePath, "utf-8");

  return (
    <LegalDocument
      title={fr ? "Politique de confidentialité" : "Privacy Policy"}
      version={LEGAL_VERSIONS.privacy}
      lastUpdated={LEGAL_VERSIONS.privacy}
      content={content}
    />
  );
}
