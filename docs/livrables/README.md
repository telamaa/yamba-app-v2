# Livrables de documentation (septembre 2026)

Quatre documents de transmission, chacun en Markdown (source) et en PDF (généré), livrés par une PR chacun avant le chantier mobile.

| # | Document | Public | Source | PDF |
|---|---|---|---|---|
| 1 | Documentation métier et fonctionnelle — côté membres | produit, support, développeurs | `01-YAMBA-DOCUMENTATION-METIER-FONCTIONNELLE.md` | `.pdf` |
| 2 | Documentation métier et fonctionnelle — back-office Admin | opérateurs, développeurs | `02-YAMBA-DOCUMENTATION-ADMIN.md` | `.pdf` |
| 3 | Documentation d'utilisation de l'API de bout en bout | intégrateurs, mobile, développeurs | `03-YAMBA-DOCUMENTATION-API.md` | `.pdf` |
| 4 | Documentation technique de bout en bout | développeurs (junior compris) | `04-YAMBA-DOCUMENTATION-TECHNIQUE.md` | `.pdf` |
| 5 | Guide de configuration complet | qui installe ou déploie | `05-YAMBA-CONFIGURATION.md` | `.pdf` |

## Régénérer

```sh
python3 scripts/build-api-reference.py > docs/livrables/_api-reference.generated.md   # référence exhaustive des endpoints (depuis les cinq openapi.json)
python3 scripts/build-doc-pdf.py docs/livrables/01-YAMBA-DOCUMENTATION-METIER-FONCTIONNELLE.md   # Markdown → PDF (python-markdown + Chrome headless)
```

Le document 3 contient la ligne `<!-- API_REFERENCE -->` : `scripts/build-doc-pdf.py` y insère la référence générée au moment du PDF (la source Markdown reste courte et lisible). Prérequis : Python 3 avec le module `markdown` (`pip3 install markdown`), Google Chrome installé.

Les documents cumulatifs par lot (`context/YAMBA-DOC-TECHNIQUE.md`, `YAMBA-DOC-METIER.md`, `YAMBA-APPRENTISSAGE-DEV.md`) et le registre des décisions restent la source chronologique ; ces quatre livrables en sont la consolidation de bout en bout.
