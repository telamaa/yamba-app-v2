import fs from "node:fs/promises";
import path from "node:path";
import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const fr = locale === "fr";

  const fileName = fr ? "terms-fr.md" : "terms-en.md";
  const filePath = path.join(process.cwd(), "content", "legal", fileName);
  const content = await fs.readFile(filePath, "utf-8");

  return (
    <LegalDocument
      title={fr ? "Conditions générales d'utilisation" : "Terms of Service"}
      version={LEGAL_VERSIONS.terms}
      lastUpdated={LEGAL_VERSIONS.terms}
      content={content}
    />
  );
}
