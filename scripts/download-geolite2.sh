#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# download-geolite2.sh — télécharge la base MaxMind GeoLite2-City (D80)
# ─────────────────────────────────────────────────────────────────────────────
# La base sert l'ancrage IP du flux d'atterrissage localisé (packages/libs/geoip),
# HORS-LIGNE : aucune IP de membre ne sort de chez nous (doctrine D78).
#
# Prérequis : un compte MaxMind gratuit et sa clé de licence dans le .env RACINE :
#   MAXMIND_LICENSE_KEY=xxxxxxxxxx
# La base (~60 Mo) atterrit dans data/geoip/GeoLite2-City.mmdb (gitignoré) et se
# périme doucement : relancer ce script de temps en temps (MaxMind publie deux
# fois par semaine). Sans base, les services tournent normalement — l'ancrage IP
# est simplement désactivé (flux découverte).
#
# Usage, depuis la racine du repo :  bash scripts/download-geolite2.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -z "${MAXMIND_LICENSE_KEY:-}" ] && [ -f .env ]; then
  MAXMIND_LICENSE_KEY="$(grep -E '^MAXMIND_LICENSE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"' || true)"
fi
if [ -z "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "MAXMIND_LICENSE_KEY absent (env ou .env racine) — créer une clé gratuite sur maxmind.com" >&2
  exit 1
fi

mkdir -p data/geoip
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Téléchargement de GeoLite2-City…"
curl -fsSL "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz" \
  -o "$tmp/geolite2-city.tar.gz"

tar -xzf "$tmp/geolite2-city.tar.gz" -C "$tmp"
mmdb="$(find "$tmp" -name 'GeoLite2-City.mmdb' | head -1)"
if [ -z "$mmdb" ]; then
  echo "Archive inattendue : GeoLite2-City.mmdb introuvable" >&2
  exit 1
fi

mv "$mmdb" data/geoip/GeoLite2-City.mmdb
echo "OK → data/geoip/GeoLite2-City.mmdb ($(du -h data/geoip/GeoLite2-City.mmdb | cut -f1))"
