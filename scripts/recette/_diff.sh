#!/bin/bash
# usage : _diff.sh "<commande tsx>"
cd /Users/gomab/Documents/Dev/Projects/yamba-app
A=$(npx tsx --env-file=.env scripts/recette/_totaux.ts 2>/dev/null | tail -1)
echo "» $*"
eval "$@" 2>&1 | tail -2
B=$(npx tsx --env-file=.env scripts/recette/_totaux.ts 2>/dev/null | tail -1)
node -e '
const a=JSON.parse(process.argv[1]),b=JSON.parse(process.argv[2]);
const d=Object.keys(a).filter(k=>a[k]!==b[k]).map(k=>`${k}: ${a[k]} → ${b[k]}`);
console.log("   variations :", d.length?d.join(" | "):"aucune");
' "$A" "$B"
