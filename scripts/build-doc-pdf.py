#!/usr/bin/env python3
"""build-doc-pdf.py — Markdown → PDF (python-markdown + Chrome headless), zéro dépendance npm.
Usage : python3 scripts/build-doc-pdf.py docs/livrables/X.md [docs/livrables/X.pdf]
Pagination, table des matières, tableaux, code ; police système. Chrome : /Applications/Google Chrome.app.
"""
import html, os, re, subprocess, sys, tempfile
import markdown

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CSS = """
@page { size: A4; margin: 18mm 16mm 20mm 16mm; }
body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #111; }
h1 { font-size: 24pt; color: #0F766E; border-bottom: 3px solid #FF9900; padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 16pt; color: #0F766E; margin-top: 26px; page-break-after: avoid; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
h3 { font-size: 12.5pt; margin-top: 18px; page-break-after: avoid; }
h4 { font-size: 11pt; margin-top: 14px; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9pt; page-break-inside: auto; }
th, td { border: 1px solid #cfcfcf; padding: 4px 6px; vertical-align: top; text-align: left; }
th { background: #f1f5f4; }
tr { page-break-inside: avoid; }
code { font-family: Menlo, Consolas, monospace; font-size: 8.8pt; background: #f4f4f4; padding: 1px 3px; border-radius: 3px; }
pre { background: #f6f8fa; border: 1px solid #e1e4e8; padding: 8px 10px; border-radius: 4px; font-size: 8.5pt; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
pre code { background: none; padding: 0; }
blockquote { border-left: 4px solid #FF9900; margin: 8px 0; padding: 4px 12px; background: #fff8ec; color: #333; }
.toc { background: #f7faf9; border: 1px solid #d9e6e3; padding: 10px 16px; border-radius: 4px; font-size: 9.5pt; page-break-after: always; }
.toc ul { list-style: none; padding-left: 14px; margin: 2px 0; }
.toc > ul { padding-left: 0; }
.toc a { color: #0F766E; text-decoration: none; }
a { color: #0F766E; }
hr { border: 0; border-top: 1px solid #ddd; margin: 18px 0; }
.cover { text-align: center; padding-top: 120px; page-break-after: always; }
.cover h1 { border: 0; font-size: 30pt; }
.cover p { color: #555; font-size: 12pt; }
img { max-width: 100%; }
"""

def build(src: str, out: str) -> None:
    text = open(src, encoding="utf-8").read()
    # Document 3 : la référence exhaustive des endpoints est générée (build-api-reference.py) et insérée ici.
    if "<!-- API_REFERENCE -->" in text:
        gen = os.path.join(os.path.dirname(src), "_api-reference.generated.md")
        text = text.replace("<!-- API_REFERENCE -->", open(gen, encoding="utf-8").read() if os.path.exists(gen) else "_(référence générée absente)_")
    m = re.match(r"^# (.+)\n", text)
    title = m.group(1).strip() if m else os.path.basename(src)
    body_md = text[m.end():] if m else text
    md = markdown.Markdown(extensions=["extra", "toc", "sane_lists", "admonition"], extension_configs={"toc": {"toc_depth": "2-3", "title": "Table des matières"}})
    body = md.convert(body_md)
    cover = f'<div class="cover"><h1>{html.escape(title)}</h1><p>Yamba — documentation générée le {subprocess.check_output(["date", "+%d/%m/%Y"]).decode().strip()} depuis <code>{html.escape(os.path.relpath(src))}</code></p></div>'
    doc = f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{html.escape(title)}</title><style>{CSS}</style></head><body>{cover}<div class="toc">{md.toc}</div>{body}</body></html>'
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(doc); tmp = f.name
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={os.path.abspath(out)}", "file://" + tmp], check=True, capture_output=True, timeout=300)
    os.unlink(tmp)
    print(f"✅ {out} ({os.path.getsize(out) // 1024} Ko) — {len(text.split())} mots")

if __name__ == "__main__":
    src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else re.sub(r"\.md$", ".pdf", src)
    build(src, out)
