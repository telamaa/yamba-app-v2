# Cahiers de recette — septembre 2026

Quatre cahiers de bout en bout, à jouer avant l'ouverture du chantier mobile. Chacun est autonome : prérequis, conventions, scénarios détaillés, tableau de consignation, critères de sortie.

| # | Cahier | Public | Scénarios | Fichier |
|---|---|---|---|---|
| 1 | Web — site membre | testeur produit | ~330 | `RECETTE-01-WEB.md` |
| 2 | Admin — back-office | opérateur, testeur | 125 | `RECETTE-02-ADMIN.md` |
| 3 | API — sans navigateur | développeur, intégrateur | 146 | `RECETTE-03-API.md` |
| 4 | Tâches planifiées, relais, consommateurs | développeur, exploitation | 90 | `RECETTE-04-CRONS.md` |

## Ordre conseillé

1. **API** en premier : il prouve que les gardes existent côté serveur. Un défaut trouvé ici évite de le chercher plus tard dans une interface.
2. **Web** ensuite, le plus long : c'est le produit tel que le membre le vit.
3. **Admin**, qui suppose des données créées par les deux précédents (un litige, un signalement, un versement).
4. **Crons** en dernier : plusieurs tâches n'ont d'objet que sur des deals déjà avancés.

## Prérequis communs

```sh
docker compose up -d && ./scripts/redpanda-bootstrap.sh
npx tsx --env-file=.env packages/libs/prisma/scripts/seed-deals.ts
npx tsx --env-file=.env packages/libs/prisma/scripts/grant-admin.ts <email> --role SUPER_ADMIN
npm run dev            # six services + site
npx nx dev admin-ui    # back-office
bash scripts/smoke-services.sh
```

Les configurations qui manquent rendent certains scénarios non jouables : ils sont marqués ⏭ dans chaque cahier, avec leur motif. Voir `docs/livrables/05-YAMBA-CONFIGURATION.md`.

## Consignation

Chaque cahier porte son tableau. Une anomalie se consigne avec son identifiant de scénario, sa gravité et sa reproduction. Les corrections partent en PR groupées par domaine, jamais scénario par scénario.

## Régénérer les PDF

```sh
python3 scripts/build-doc-pdf.py docs/recette/RECETTE-01-WEB.md
```
