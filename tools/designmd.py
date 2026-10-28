#!/usr/bin/env python3
"""
designmd.py - klien DESIGNmd (https://designmd.ai) + compiler design-token.

Memperluas konsep "designmd MCP": selain mengunduh DESIGN.md, tool ini
MENGOMPILASI isinya menjadi design tokens (CSS custom properties) yang
langsung dipakai website. Tidak butuh pip/npm — hanya Python stdlib.

Perintah CLI
------------
  python tools/designmd.py fetch  chef/campuskit        # unduh -> design/DESIGN.md
  python tools/designmd.py tokens                       # DESIGN.md -> static/css/tokens.css
  python tools/designmd.py sync   chef/campuskit        # fetch + tokens
  python tools/designmd.py mcp                          # jalankan sebagai MCP server (stdio)

API key (opsional) dibaca dari env DESIGNMD_API_KEY.

Konfigurasi MCP (mcp_config.json):
  { "mcpServers": { "designmd-local": {
      "command": "python", "args": ["tools/designmd.py", "mcp"] } } }
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESIGN_FILE = ROOT / "design" / "DESIGN.md"
TOKENS_FILE = ROOT / "static" / "css" / "tokens.css"
API = "https://designmd.ai/api/v1/kits/{author}/{slug}/download"


# --------------------------------------------------------------------------- #
# Fetch
# --------------------------------------------------------------------------- #
def fetch_design(kit: str, dest: Path = DESIGN_FILE) -> Path:
    """Unduh DESIGN.md dari designmd.ai. kit = 'author/slug'."""
    m = re.fullmatch(r"@?([\w.-]+)/([\w.-]+)", kit.strip())
    if not m:
        raise ValueError("Format kit harus 'author/slug', contoh: chef/campuskit")
    url = API.format(author=m.group(1), slug=m.group(2))
    headers = {"User-Agent": "designmd-local/1.0", "Accept": "text/markdown,text/plain,*/*"}
    key = os.environ.get("DESIGNMD_API_KEY")
    if key:
        headers["Authorization"] = f"Bearer {key}"
        headers["x-api-key"] = key
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            text = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"designmd.ai membalas HTTP {e.code} (cek API key / nama kit)") from e
    if "## Colors" not in text and "## Color" not in text:
        raise RuntimeError("Respons tidak terlihat seperti DESIGN.md yang valid")
    dest.parent.mkdir(parents=True, exist_ok=True)
    header = f"<!-- source: {url} -->\n"
    dest.write_text(header + text, encoding="utf-8")
    return dest


# --------------------------------------------------------------------------- #
# Parse DESIGN.md -> dict
# --------------------------------------------------------------------------- #
HEX = r"#[0-9A-Fa-f]{6}"


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def parse_design(md: str) -> dict:
    d: dict = {"colors": {}, "fonts": {}, "type": {}, "spacing": {}, "radius": {}, "shadow": {}}

    # Colors:  - **Primary** (#7F1D1D): usage
    sec = re.search(r"## Colors\s*(.*?)(?=\n## |\Z)", md, re.S)
    if sec:
        for name, hx, use in re.findall(rf"- \*\*(.+?)\*\* \(({HEX})\):?\s*(.*)", sec.group(1)):
            d["colors"][_slug(name)] = {"hex": hx.upper(), "use": use.strip()}

    # Fonts
    for role, key in (("Headline", "display"), ("Body", "body"), ("Mono", "mono")):
        m = re.search(rf"\*\*{role} Font\*\*:\s*(.+)", md)
        if m:
            d["fonts"][key] = m.group(1).strip()

    # Type scale: - **h1**: Vollkorn 32px bold, 1.25 line height. Page titles.
    for name, fam, px, weight, lh in re.findall(
        r"- \*\*(h\d|body|sm|xs|mono)\*\*:\s*([\w ]+?) (\d+)px (\w+), ([\d.]+) line height", md
    ):
        d["type"][name] = {"family": fam, "size": int(px), "weight": weight, "lh": float(lh)}

    # Spacing: - **sp-1**: 4px — usage
    for name, px in re.findall(r"- \*\*(sp-\d+)\*\*:\s*(\d+)px", md):
        d["spacing"][name] = int(px)

    # Radius: - **radius-sm** (4px): ...
    for name, px in re.findall(r"- \*\*(radius-[\w]+)\*\* \((\d+(?:px|%))\)", md):
        d["radius"][name] = px if px.endswith("%") else px

    # Shadows: - **shadow-sm**: 1px offset, 2px blur, #000000 at 4%.
    for name, off, blur, hx, op in re.findall(
        rf"- \*\*(shadow-(?:sm|md|lg|xl))\*\*:\s*(\d+)px offset, (\d+)px blur, ({HEX}) at (\d+)%", md
    ):
        d["shadow"][name] = (int(off), int(blur), hx, int(op))
    m = re.search(rf"- \*\*shadow-focus\*\*:\s*(\d+)px ring ({HEX}) at (\d+)%", md)
    if m:
        d["shadow"]["shadow-focus"] = ("ring", int(m.group(1)), m.group(2), int(m.group(3)))

    # Button hover (varian Primary): '- **Primary**: #7F1D1D fill, ... Hover: #5B1212.'
    m = re.search(rf"- \*\*Primary\*\*: {HEX} fill.*?Hover: ({HEX})", md)
    if m:
        d["primary_hover"] = m.group(1).upper()
    return d


# --------------------------------------------------------------------------- #
# Compile tokens -> CSS
# --------------------------------------------------------------------------- #
def _rgba(hx: str, pct: int) -> str:
    r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
    return f"rgba({r}, {g}, {b}, {pct / 100:.2f})"


def _darken(hx: str, f: float) -> str:
    r, g, b = (int(hx[i : i + 2], 16) for i in (1, 3, 5))
    return "#%02X%02X%02X" % (int(r * f), int(g * f), int(b * f))


def _tint(hx: str, f: float) -> str:
    r, g, b = (int(hx[i : i + 2], 16) for i in (1, 3, 5))
    return "#%02X%02X%02X" % tuple(int(c + (255 - c) * f) for c in (r, g, b))


def compile_tokens(d: dict, source: str = "chef/campuskit") -> str:
    c = d["colors"]
    out = [f"/* GENERATED oleh tools/designmd.py dari DESIGN.md ({source}). Jangan edit manual. */", ":root {"]

    out.append("  /* Colors */")
    for k, v in c.items():
        out.append(f"  --c-{k}: {v['hex']};")
    if "primary" in c:
        p = c["primary"]["hex"]
        out += [
            f"  --c-primary-hover: {d.get('primary_hover') or _darken(p, 0.72)};",
            f"  --c-primary-soft: {_tint(p, 0.93)};",
            f"  --c-primary-ring: {_rgba(p, 25)};",
        ]
    if "secondary" in c:
        s = c["secondary"]["hex"]
        out += [f"  --c-secondary-soft: {_tint(s, 0.88)};", f"  --c-secondary-deep: {_darken(s, 0.75)};"]
    if "tertiary" in c:
        t = c["tertiary"]["hex"]
        out += [f"  --c-tertiary-soft: {_tint(t, 0.9)};"]
    for k in ("success", "warning", "error", "info"):
        if k in c:
            out.append(f"  --c-{k}-soft: {_tint(c[k]['hex'], 0.88)};")

    out.append("  /* Fonts */")
    f = d["fonts"]
    out.append(f"  --font-display: '{f.get('display', 'Georgia')}', Georgia, 'Times New Roman', serif;")
    out.append(f"  --font-body: '{f.get('body', 'Inter')}', system-ui, -apple-system, 'Segoe UI', sans-serif;")
    out.append(f"  --font-mono: '{f.get('mono', 'Consolas')}', ui-monospace, Consolas, monospace;")

    out.append("  /* Type scale */")
    for k, v in d["type"].items():
        w = {"bold": 700, "semibold": 600, "medium": 500, "regular": 400}.get(v["weight"], 400)
        out.append(f"  --fs-{k}: {v['size'] / 16:g}rem; --fw-{k}: {w}; --lh-{k}: {v['lh']:g};")

    out.append("  /* Spacing (base 8px) */")
    for k, px in d["spacing"].items():
        out.append(f"  --{k}: {px}px;")

    out.append("  /* Radius */")
    for k, px in d["radius"].items():
        out.append(f"  --{k}: {px if px.endswith('%') else px};")

    out.append("  /* Elevation */")
    for k, v in d["shadow"].items():
        if k == "shadow-focus":
            out.append(f"  --{k}: 0 0 0 {v[1]}px {_rgba(v[2], v[3])};")
        else:
            off, blur, hx, op = v
            out.append(f"  --{k}: 0 {off}px {blur}px {_rgba(hx, op)};")
    out.append("}")
    return "\n".join(out) + "\n"


def build_tokens(src: Path = DESIGN_FILE, dest: Path = TOKENS_FILE) -> Path:
    md = src.read_text(encoding="utf-8")
    d = parse_design(md)
    if not d["colors"] or not d["spacing"]:
        raise RuntimeError("DESIGN.md tidak berisi token warna/spacing yang bisa dikompilasi")
    m = re.search(r"source: https://designmd\.ai/api/v1/kits/([\w.-]+/[\w.-]+)/download", md)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(compile_tokens(d, m.group(1) if m else "custom"), encoding="utf-8")
    return dest


# --------------------------------------------------------------------------- #
# Minimal MCP server (JSON-RPC 2.0 over stdio, newline-delimited)
# --------------------------------------------------------------------------- #
TOOLS = [
    {
        "name": "designmd_fetch",
        "description": "Unduh DESIGN.md dari designmd.ai ke design/DESIGN.md. Contoh kit: 'chef/campuskit'.",
        "inputSchema": {
            "type": "object",
            "properties": {"kit": {"type": "string", "description": "author/slug"}},
            "required": ["kit"],
        },
    },
    {
        "name": "designmd_build_tokens",
        "description": "Kompilasi design/DESIGN.md menjadi static/css/tokens.css (CSS custom properties).",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "designmd_inspect",
        "description": "Tampilkan token yang terdeteksi (warna, font, spacing, radius, shadow) sebagai JSON.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


def _call_tool(name: str, args: dict) -> str:
    if name == "designmd_fetch":
        return f"Tersimpan: {fetch_design(args['kit'])}"
    if name == "designmd_build_tokens":
        return f"Tersimpan: {build_tokens()}"
    if name == "designmd_inspect":
        return json.dumps(parse_design(DESIGN_FILE.read_text(encoding='utf-8')), indent=2, ensure_ascii=False)
    raise ValueError(f"Tool tidak dikenal: {name}")


def serve_mcp() -> None:
    def send(obj):
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        mid, method = msg.get("id"), msg.get("method")
        if method == "initialize":
            send({"jsonrpc": "2.0", "id": mid, "result": {
                "protocolVersion": msg.get("params", {}).get("protocolVersion", "2024-11-05"),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "designmd-local", "version": "1.0.0"}}})
        elif method == "tools/list":
            send({"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}})
        elif method == "tools/call":
            p = msg.get("params", {})
            try:
                text, err = _call_tool(p.get("name", ""), p.get("arguments") or {}), False
            except Exception as e:  # noqa: BLE001
                text, err = f"Error: {e}", True
            send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}], "isError": err}})
        elif method == "ping":
            send({"jsonrpc": "2.0", "id": mid, "result": {}})
        elif mid is not None:
            send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": "Method not found"}})


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd = argv[1]
    try:
        if cmd == "fetch":
            print("OK ->", fetch_design(argv[2] if len(argv) > 2 else "chef/campuskit"))
        elif cmd == "tokens":
            print("OK ->", build_tokens())
        elif cmd == "sync":
            print("OK ->", fetch_design(argv[2] if len(argv) > 2 else "chef/campuskit"))
            print("OK ->", build_tokens())
        elif cmd == "mcp":
            serve_mcp()
        else:
            print(f"Perintah tidak dikenal: {cmd}\n{__doc__}")
            return 2
    except Exception as e:  # noqa: BLE001
        print(f"GAGAL: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
