#!/usr/bin/env bash
# smoke-services.sh — chaque bundle démarre-t-il vraiment ? (leçon du 06/09 : un build vert n'est pas un service démarré)
# Usage : bash scripts/smoke-services.sh   (ports décalés +900, aucun conflit avec `npm run dev`)
set -u
cd "$(dirname "$0")/.."
ROOT=$(pwd)
fail=0
smoke() { # nom, port réel, variable de port, chemin de santé
  local name=$1
  local port=$2
  local var=$3
  local path=${4:-/health}
  local alt=$((port + 900))
  cd "$ROOT/apps/$name" || return 1
  env "$var=$alt" OUTBOX_RELAY_ENABLED=false MESSAGING_RELAY_ENABLED=false \
    BOOKING_EXPIRY_CRON_ENABLED=false BOOKING_PAYOUT_CRON_ENABLED=false OPS_DIGEST_CRON_ENABLED=false \
    OPS_ALERTS_CRON_ENABLED=false RATING_CRON_ENABLED=false RECIPIENT_REDACTION_CRON_ENABLED=false \
    OUTBOX_RETENTION_CRON_ENABLED=false MESSAGING_REMINDER_CRON_ENABLED=false MESSAGING_RETENTION_CRON_ENABLED=false \
    RETENTION_CRON_ENABLED=false TRIP_COMPLETION_CRON_ENABLED=false ONBOARDING_REMINDER_CRON_ENABLED=false \
    node --env-file="$ROOT/.env" dist/main.js > "/tmp/smoke-$name.log" 2>&1 &
  local pid=$!
  local body="" i
  for i in $(seq 1 20); do sleep 0.5; body=$(curl -s -m 2 "http://localhost:$alt$path" 2>/dev/null) && [ -n "$body" ] && break; done
  kill $pid 2>/dev/null; wait $pid 2>/dev/null
  if echo "$body" | grep -q '"status"'; then
    echo "✅ $name — $(echo "$body" | head -c 90)"
  else
    echo "❌ $name — pas de réponse sur $path:$alt"; grep -m2 -i "error\|TypeError" "/tmp/smoke-$name.log" | head -2; fail=1
  fi
  cd "$ROOT"
}
smoke api-gateway 8080 PORT /gateway-health
smoke auth-service 6001 PORT
smoke trip-service 6002 PORT
smoke deal-service 6003 PORT
smoke notification-service 6004 NOTIFICATION_SERVICE_PORT
smoke message-service 6005 MESSAGE_SERVICE_PORT
exit $fail
