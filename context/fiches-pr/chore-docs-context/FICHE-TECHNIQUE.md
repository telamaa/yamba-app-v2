# Fiche technique — chore « versionner `context/` et enrichir `CLAUDE.md` »

> Branche `chore/docs-context` · base `dev` · documentation uniquement · PR #__ (noté au merge)

## 1. Ce que la PR ajoute

| Chemin | Rôle |
|---|---|
| `context/YAMBA-REGISTRE-DECISIONS-ROADMAP-v1.3.md` | **Le document maître** : décisions D1–D30 (D31/D32 arrivent avec PR-B), roadmap, arbitrages A-xx |
| `context/YAMBA-SPECIFICATION-COMPLETE.md` | Spécification de bout en bout (domaine, machines à états, pricing, événements, sécurité) |
| `context/YAMBA-REGLES-METIER-V2.md` | ~50 règles métier (PRC, CAP, ANN, COM, GAR…) |
| `context/YAMBA-CONTEXT.md` | Fait / reste à faire / règles non négociables |
| `context/YAMBA-CONTEXT-HANDOFF-PRICING-PR-A.md`, `…-PR-B.md` | État exact du chantier à chaque passation |
| `context/mockup-pricing-yamba.html` | La maquette HTML du pricing (spec du formulaire Voyageur et du calcul Expéditeur) |
| `context/fiches-pr/<PR>/FICHE-TECHNIQUE.md` + `FICHE-METIER.md` | Une paire par PR (règle d'équipe depuis le 28/08/2026) |
| `CLAUDE.md` | Instructions de travail : ordre de lecture de la gouvernance, précédence en cas de divergence (code+tests > registre > règles > synthèses), commandes Nx, baseline de tests, Git & CI (12 checks requis, D30), architecture des 4 services, règles non négociables, pièges connus |

## 2. Pourquoi versionner

- **Une seule vérité** : jusqu'ici `context/` vivait hors Git (copie locale + « project knowledge » à resynchroniser à la main) — source d'écarts (ex. D31 jamais reporté au registre).
- **Présent sur toutes les branches** : c'est le canal de communication entre l'équipe et l'assistant ; un checkout ne doit jamais le faire disparaître.
- **Revue** : une décision d'architecture passe désormais par un diff relisible dans une PR, avant le code.

## 3. Conventions

- Français pour les docs, anglais pour les surfaces publiques (OpenAPI, messages d'erreur API).
- Les **captures d'écran** de revue se déposent dans `context/fiches-pr/<PR>/captures/` mais **ne sont jamais versionnées** (`.gitignore`) : c'est un canal d'échange local, pas de la documentation.
- Les évolutions de `context/` se commitent **sur la branche de la PR concernée**, jamais sur une branche à part.

## 4. Vérification

Aucun code touché : les checks TypeScript/tests sont triviaux ; le seul check à regarder est **« secrets anti-leak »** (aucun secret dans ces fichiers — vérifié par grep avant commit).
