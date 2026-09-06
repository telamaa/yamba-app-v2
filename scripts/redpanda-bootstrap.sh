#!/usr/bin/env bash
# Yamba — bootstrap des topics Redpanda (A23, PR4 ; messaging-events ajouté 06/09)
# ==============================================
# Idempotent : relançable sans effet si le topic existe déjà.
# 12 partitions dès la création — augmenter plus tard changerait le
# mapping clé→partition et casserait transitoirement l'ordre par
# aggregateId (décision quasi irréversible, prise large).
# Rétention 7 jours : le replay se fait depuis l'outbox Mongo (source
# de vérité, jamais de delete), pas en rembobinant le broker.
#
# Prérequis : docker compose up -d (conteneur yamba-redpanda healthy).
# Usage : ./scripts/redpanda-bootstrap.sh

set -euo pipefail

CONTAINER="yamba-redpanda"
# DEUX sujets : le relais du deal-service ne draine que `booking`, celui du
# message-service que `messaging` (chaque relais filtre sur son aggregateType).
# Le second manquait ici : sur une machine neuve, l'auto-création étant coupée,
# le relais de messagerie PARQUAIT des événements pourtant sains.
TOPICS=("booking-events" "messaging-events")
PARTITIONS=12
RETENTION_MS=604800000 # 7 jours

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "✗ Conteneur ${CONTAINER} introuvable — lancer : docker compose up -d" >&2
  exit 1
fi

# Doctrine A23 : pas de création implicite de topics. Config CLUSTER
# persistée (survit aux redémarrages du conteneur) — posée ici car le
# flag --set au démarrage n'est pas reconnu (incident PR4). Idempotent.
docker exec "${CONTAINER}" rpk cluster config set auto_create_topics_enabled false
echo "✓ auto_create_topics_enabled=false (config cluster persistée)"

# Détection d'existence en sortie TEXTE (le flag --format json n'existe
# pas dans le rpk de cette image — incident PR4, 2e du script) :
# colonne 1 de `topic list`, match exact.
EXISTING=$(docker exec "${CONTAINER}" rpk topic list | awk '{print $1}')
for TOPIC in "${TOPICS[@]}"; do
  if echo "${EXISTING}" | grep -qx "${TOPIC}"; then
    echo "✓ Topic '${TOPIC}' existe déjà — rien à faire"
  else
    docker exec "${CONTAINER}" rpk topic create "${TOPIC}" \
      --partitions "${PARTITIONS}" \
      --replicas 1 \
      --topic-config "retention.ms=${RETENTION_MS}"
    echo "✓ Topic '${TOPIC}' créé (${PARTITIONS} partitions, rétention 7 j)"
  fi
done

echo "── Description ──"
for TOPIC in "${TOPICS[@]}"; do
  docker exec "${CONTAINER}" rpk topic describe "${TOPIC}"
done
