#!/usr/bin/env bash
# Yamba — bootstrap du topic Redpanda (A23, PR4)
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
TOPIC="booking-events"
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
if docker exec "${CONTAINER}" rpk topic list | awk '{print $1}' | grep -qx "${TOPIC}"; then
  echo "✓ Topic '${TOPIC}' existe déjà — rien à faire"
else
  docker exec "${CONTAINER}" rpk topic create "${TOPIC}" \
    --partitions "${PARTITIONS}" \
    --replicas 1 \
    --topic-config "retention.ms=${RETENTION_MS}"
  echo "✓ Topic '${TOPIC}' créé (${PARTITIONS} partitions, rétention 7 j)"
fi

echo "── Description ──"
docker exec "${CONTAINER}" rpk topic describe "${TOPIC}"
