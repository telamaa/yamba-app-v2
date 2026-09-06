#!/usr/bin/env python3
"""build-api-reference.py — référence exhaustive des endpoints depuis les cinq openapi.json (Markdown).
Usage : python3 scripts/build-api-reference.py > docs/livrables/_api-reference.generated.md
"""
import json, re
SERVICES = [("auth-service", 6001, "Comptes, sessions, profils, alertes de route, signalements, back-office"), ("trip-service", 6002, "Trajets, recherche, prix, documents, uploads"), ("deal-service", 6003, "Réservations (deals), paiement, transport, litiges, versements, notation, suivi destinataire"), ("message-service", 6005, "Messagerie, rendez-vous, numéro, signalement de message"), ("notification-service", 6004, "Notifications in-app, webhooks email")]
def ref_name(s):
    if isinstance(s, dict) and "$ref" in s: return s["$ref"].split("/")[-1]
    if isinstance(s, dict) and s.get("type") == "array": return f"liste de {ref_name(s.get('items', {}))}"
    if isinstance(s, dict) and s.get("type") == "object": return "objet { " + ", ".join(s.get("properties", {}).keys()) + " }"
    if isinstance(s, dict) and "type" in s: return s["type"]
    return "—"
def render_schema(name, schema, depth=0):
    props = schema.get("properties", {}); req = set(schema.get("required", []))
    rows = []
    for k, v in props.items():
        t = v.get("type", "") if isinstance(v, dict) else ""
        if isinstance(v, dict) and "$ref" in v: t = v["$ref"].split("/")[-1]
        elif isinstance(v, dict) and "anyOf" in v: t = " \\| ".join(ref_name(x) if "$ref" in x else x.get("type", "null") for x in v["anyOf"])
        elif t == "array": t = f"array<{ref_name(v.get('items', {}))}>"
        elif t == "string" and v.get("enum"): t = "enum : " + ", ".join(map(str, v["enum"]))
        elif t == "string" and v.get("format"): t = f"string ({v['format']})"
        desc = (v.get("description") if isinstance(v, dict) else "") or ""
        rows.append(f"| `{k}` | {t} | {'oui' if k in req else 'non'} | {desc.replace('|', '/')} |")
    return "\n".join(rows)
out = []
for name, port, role in SERVICES:
    d = json.load(open(f"apps/{name}/openapi.json"))
    out.append(f"\n## {name} — port {port}\n\n{role}. Document vivant : `http://localhost:{port}/docs` (Scalar) et `apps/{name}/openapi.json`. Via le gateway : `http://localhost:8080/api` (préfixes ci-dessous).\n")
    tags = {t["name"]: t.get("description", "") for t in d.get("tags", [])}
    by_tag = {}
    for path, ops in d["paths"].items():
        for method, op in ops.items():
            if method not in ("get", "post", "put", "patch", "delete"): continue
            by_tag.setdefault((op.get("tags") or ["—"])[0], []).append((path, method, op))
    for tag, items in by_tag.items():
        out.append(f"\n### {name} › {tag}\n\n{tags.get(tag, '')}\n")
        for path, method, op in items:
            sec = "aucune (public)" if not op.get("security") else ", ".join(list(s.keys())[0] for s in op["security"])
            perm = op.get("x-permission")
            out.append(f"\n#### `{method.upper()} {path}`\n\n**{op.get('summary', '')}**  \n`operationId` : `{op.get('operationId', '')}` · Authentification : {sec}" + (f" · Permission admin : `{perm}`" if perm else "") + "\n")
            if op.get("description"): out.append(op["description"] + "\n")
            params = op.get("parameters", [])
            if params:
                out.append("| Paramètre | Dans | Requis | Type | Description |\n|---|---|---|---|---|")
                for p in params: out.append(f"| `{p['name']}` | {p['in']} | {'oui' if p.get('required') else 'non'} | {ref_name(p.get('schema', {}))} | {(p.get('description') or '').replace('|', '/')} |")
                out.append("")
            rb = op.get("requestBody")
            if rb:
                sch = list(rb.get("content", {}).values())[0].get("schema", {})
                out.append(f"Corps ({'requis' if rb.get('required') else 'facultatif'}) : `{ref_name(sch)}`\n")
            out.append("| Code | Réponse |\n|---|---|")
            for code, r in op.get("responses", {}).items():
                c = r.get("content", {}); sch = list(c.values())[0].get("schema", {}) if c else {}
                out.append(f"| {code} | {ref_name(sch)} — {(r.get('description') or '').replace('|', '/')} |")
            out.append("")
    schemas = d.get("components", {}).get("schemas", {})
    used = set(re.findall(r"#/components/schemas/([A-Za-z0-9_]+)", json.dumps(d["paths"])))
    # fermeture transitive
    changed = True
    while changed:
        changed = False
        for s in list(used):
            for r in re.findall(r"#/components/schemas/([A-Za-z0-9_]+)", json.dumps(schemas.get(s, {}))):
                if r not in used: used.add(r); changed = True
    out.append(f"\n### {name} › schémas utilisés ({len(used)})\n")
    for s in sorted(used):
        sch = schemas.get(s, {})
        if sch.get("enum"): out.append(f"\n**`{s}`** — enum : " + ", ".join(f"`{x}`" for x in sch["enum"]) + (f" — {sch.get('description')}" if sch.get("description") else "") + "\n"); continue
        if "anyOf" in sch: out.append(f"\n**`{s}`** — union : " + " \\| ".join(ref_name(x) for x in sch["anyOf"]) + "\n"); continue
        if not sch.get("properties"): out.append(f"\n**`{s}`** — {sch.get('type', 'objet')}" + (f" : {sch.get('description')}" if sch.get("description") else "") + "\n"); continue
        out.append(f"\n**`{s}`**" + (f" — {sch['description']}" if sch.get("description") else "") + "\n\n| Champ | Type | Requis | Description |\n|---|---|---|---|\n" + render_schema(s, sch) + "\n")
print("\n".join(out))
