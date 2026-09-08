# Livrables de documentation (septembre 2026)

Documents de transmission, chacun en Markdown (source) et en PDF (généré). Les six premiers ont été livrés avant le chantier mobile ; les quatre suivants préparent l'ouverture commerciale (stratégie, assurance, juridique, aides publiques).

| # | Document | Public | Source | PDF |
|---|---|---|---|---|
| 1 | Documentation métier et fonctionnelle — côté membres | produit, support, développeurs | `01-YAMBA-DOCUMENTATION-METIER-FONCTIONNELLE.md` | `.pdf` |
| 2 | Documentation métier et fonctionnelle — back-office Admin | opérateurs, développeurs | `02-YAMBA-DOCUMENTATION-ADMIN.md` | `.pdf` |
| 3 | Documentation d'utilisation de l'API de bout en bout | intégrateurs, mobile, développeurs | `03-YAMBA-DOCUMENTATION-API.md` | `.pdf` |
| 4 | Documentation technique de bout en bout | développeurs (junior compris) | `04-YAMBA-DOCUMENTATION-TECHNIQUE.md` | `.pdf` |
| 5 | Guide de configuration complet | qui installe ou déploie | `05-YAMBA-CONFIGURATION.md` | `.pdf` |
| 6 | Préparer le chantier mobile | avant d'ouvrir le chantier mobile | `06-YAMBA-PREPARATION-MOBILE.md` | `.pdf` |
| 7 | Stratégie de financement et de lancement | fondateur, futurs partenaires | `07-YAMBA-STRATEGIE-FINANCEMENT-LANCEMENT.md` | `.pdf` |
| 8 | Dossier de présentation aux assureurs et courtiers | courtiers, assureurs affinitaires | `08-YAMBA-DOSSIER-ASSURANCE.md` | `.pdf` |
| 9 | Dossier de présentation aux juristes | avocats, délégué à la protection des données | `09-YAMBA-DOSSIER-JURIDIQUE.md` | `.pdf` |
| 10 | Dossier de demande d'aides publiques | guichets d'aide, réseaux d'accompagnement | `10-YAMBA-DOSSIER-AIDES-PUBLIQUES.md` | `.pdf` |
| 11 | Dossier identité, vérification et parcours d'inscription du Voyageur | produit, développeurs, assureurs (08), juristes et DPO (09) | `11-YAMBA-DOSSIER-IDENTITE-VERIFICATION.md` | `.pdf` |

## Régénérer

```sh
python3 scripts/build-api-reference.py > docs/livrables/_api-reference.generated.md   # référence exhaustive des endpoints (depuis les cinq openapi.json)
python3 scripts/build-doc-pdf.py docs/livrables/01-YAMBA-DOCUMENTATION-METIER-FONCTIONNELLE.md   # Markdown → PDF (python-markdown + Chrome headless)
```

Le document 3 contient la ligne `<!-- API_REFERENCE -->` : `scripts/build-doc-pdf.py` y insère la référence générée au moment du PDF (la source Markdown reste courte et lisible). Prérequis : Python 3 avec le module `markdown` (`pip3 install markdown`), Google Chrome installé.

Les documents cumulatifs par lot (`context/YAMBA-DOC-TECHNIQUE.md`, `YAMBA-DOC-METIER.md`, `YAMBA-APPRENTISSAGE-DEV.md`) et le registre des décisions restent la source chronologique ; ces quatre livrables en sont la consolidation de bout en bout.
