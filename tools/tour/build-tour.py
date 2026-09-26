#!/usr/bin/env python3
"""Builds the kriket tour page from content.toml and the screenshots capture.mjs saved.

    python3 build-tour.py [--out PATH] [--no-convert]

1. Converts shots/png/*.png to shots/jpg/*.jpg (JPEG quality 80, at most 1280 px wide), with
   Pillow when it is installed and macOS `sips` otherwise.
2. Reads content.toml (all the words) and shots/meta.json (the seeded data and forecast).
3. Writes one self-contained HTML file with every screenshot embedded as a data: URI.
   Default output: ../kriket-app-tour.html, next to this folder.

Only the Python standard library is needed (3.11+ for tomllib).
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import re
import shutil
import struct
import subprocess
import sys
import tomllib
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
PNG_DIR = HERE / "shots" / "png"
JPG_DIR = HERE / "shots" / "jpg"
DEFAULT_OUT = HERE.parent / "kriket-app-tour.html"
MAX_WIDTH = 1280
QUALITY = 80
BUDGET_BYTES = 6 * 1024 * 1024

# Viewports capture.mjs uses, for the frame labels.
VIEWPORT = {"desktop": (1280, 800), "phone": (375, 812)}


# ----------------------------------------------------------------------------- images


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def convert() -> None:
    JPG_DIR.mkdir(parents=True, exist_ok=True)
    for old in JPG_DIR.glob("*.jpg"):
        old.unlink()
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        Image = None
        if not shutil.which("sips"):
            sys.exit("Need Pillow (python3 -m pip install --user pillow) or macOS sips to convert.")
    for png in sorted(PNG_DIR.glob("*.png")):
        jpg = JPG_DIR / f"{png.stem}.jpg"
        width, height = png_size(png)
        if Image is not None:
            im = Image.open(png).convert("RGB")
            if width > MAX_WIDTH:
                im = im.resize((MAX_WIDTH, round(height * MAX_WIDTH / width)), Image.LANCZOS)
            im.save(jpg, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        else:
            cmd = ["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(QUALITY)]
            if width > MAX_WIDTH:
                cmd += ["--resampleWidth", str(MAX_WIDTH)]
            subprocess.run([*cmd, str(png), "--out", str(jpg)], check=True, capture_output=True)
        print(f"converted {png.name} -> {jpg.name} ({jpg.stat().st_size // 1024} KB)")


def load_images() -> dict[str, tuple[str, int, int]]:
    images = {}
    for jpg in sorted(JPG_DIR.glob("*.jpg")):
        png = PNG_DIR / f"{jpg.stem}.png"
        width, height = png_size(png) if png.exists() else (MAX_WIDTH, MAX_WIDTH)
        if width > MAX_WIDTH:
            width, height = MAX_WIDTH, round(height * MAX_WIDTH / width)
        data = base64.b64encode(jpg.read_bytes()).decode("ascii")
        images[jpg.stem] = (f"data:image/jpeg;base64,{data}", width, height)
    return images


# ----------------------------------------------------------------------------- text helpers

esc = lambda s: html.escape(str(s), quote=True)  # noqa: E731
NONE = '<span class="muted">none</span>'


def inline(text: str) -> str:
    """Markdown-ish inline: `code`, **bold**, [label](https://...)."""
    out = html.escape(text.strip(), quote=False)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", out)
    out = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2">\1</a>', out)
    return out


def blocks(text: str) -> str:
    """Paragraphs split on blank lines; a block of '- ' lines becomes a list."""
    parts = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if lines and all(line.startswith("- ") for line in lines):
            items = "".join(f"<li>{inline(line[2:])}</li>" for line in lines)
            parts.append(f"<ul>{items}</ul>")
        elif lines:
            parts.append(f"<p>{inline(' '.join(lines))}</p>")
    return "".join(parts)


def dollars(value: str | int, cents: bool = False) -> str:
    amount = int(value) / 100 if cents else float(value)
    sign = "−" if amount < 0 else ""
    return f"{sign}${abs(amount):,.2f}"


def short_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d:%b} {d.day}"


# ----------------------------------------------------------------------------- icons

MARK = """<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--mark-bg)"/><g fill="none" stroke="var(--mark-fg)" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 13.4C24 9.6 26 7.6 28.4 6.6M21 13C21.2 9.4 22.6 6.9 24.8 5.4" stroke-width="1.2"/><path d="M13.4 17.6 8.6 11.8 6.2 22.4" stroke-width="1.8"/><path d="M18.4 20.2 19.6 24.4M15 21 14.4 24.8" stroke-width="1.3"/></g><g fill="var(--mark-fg)"><ellipse cx="14.6" cy="18.4" rx="6.8" ry="3.5" transform="rotate(-14 14.6 18.4)"/><circle cx="21.6" cy="15.6" r="2.6"/></g></svg>"""

CHECK = """<svg class="check" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="var(--brand)"/><path d="M5.8 10.4 8.6 13.1 14.3 7.2" fill="none" stroke="var(--on-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>"""


# ----------------------------------------------------------------------------- sections


def header(meta: dict, shots_meta: dict) -> str:
    captured = ""
    if shots_meta.get("capturedAt"):
        when = datetime.fromisoformat(shots_meta["capturedAt"].replace("Z", "+00:00")).astimezone()
        captured = (
            f'<p class="captured">Screenshots captured {esc(f"{when:%a %d %b %Y, %H:%M %Z}")} '
            f'from <code>{esc(shots_meta.get("branch") or "?")}</code> at '
            f'<code>{esc(shots_meta.get("commit") or "?")}</code>.</p>'
        )
    nav = "".join(
        f'<a href="#{i}">{t}</a>'
        for i, t in [
            ("iterations", "Iterations"),
            ("today", "Today"),
            ("tour", "Tour"),
            ("how", "How it works"),
            ("api", "API"),
            ("next", "Next steps"),
        ]
    )
    return f"""
<header class="top">
  <p class="brand">{MARK}<span class="wordmark">{esc(meta['name'])}</span><span class="brand-sub">app tour</span></p>
  <h1>{esc(meta['headline'])}</h1>
  <p class="lede">{inline(meta['idea'])}</p>
  <ul class="facts">
    <li>{esc(meta['as_built'])}</li>
    <li><span class="k">branch</span> <code>{esc(meta['branch'])}</code></li>
    <li><span class="k">commit</span> <code>{esc(meta['commit'])}</code></li>
  </ul>
  {captured}
  <nav class="toc" aria-label="On this page">{nav}</nav>
</header>"""


def iterations(items: list[dict]) -> str:
    rows = []
    for it in sorted(items, key=lambda i: i["number"], reverse=True):
        rows.append(
            f"""<li class="iter">
  <span class="iter-n" aria-label="Iteration {it['number']}">{it['number']}</span>
  <div class="iter-body">
    <p class="iter-meta"><span>{esc(it['when'])}</span><span><code>{esc(it['branch'])}</code> at <code>{esc(it['commit'])}</code></span></p>
    <p class="iter-what">{inline(it['changed'])}</p>
    <p class="iter-shots"><span class="k">Screenshots refreshed</span> {inline(it['screenshots'])}</p>
    {f'<p class="iter-shots"><a href="{esc(it["snapshot"])}">This version of the tour, as it was</a></p>' if it.get('snapshot') else ''}
  </div>
</li>"""
        )
    return f"""
<section id="iterations" class="section">
  <h2>Iterations</h2>
  <p class="section-intro">One entry per build this tour was refreshed for, newest first. Each keeps a snapshot of the page as it was, so the product's progress stays visible after the fact.</p>
  <ol class="iters" reversed>{''.join(rows)}</ol>
</section>"""


def built(items: list[dict], also: dict) -> str:
    lis = "".join(
        f"""<li class="done">{CHECK}<div><h3><span class="item-no" title="Whiteboard item {b['item']}">{b['item']}</span>{esc(b['title'])}</h3><p>{inline(b['text'])}</p></div></li>"""
        for b in items
    )
    return f"""
<section id="today" class="section">
  <h2>What you can do today</h2>
  <p class="section-intro">Whiteboard items 0 to 3 are built end to end, from the database to the screen.</p>
  <ul class="checklist">{lis}</ul>
  <p class="also">{inline(also['text'])}</p>
</section>"""


def demo_block(shots_meta: dict) -> str:
    seed = shots_meta.get("seed") or []
    if not seed:
        return '<p class="failed-note">No seed data recorded: shots/meta.json is missing, so capture.mjs has not run.</p>'
    rows = "".join(
        f"""<tr><th scope="row">{esc(s['name'])}</th><td>{'In' if s['kind'] == 'income' else 'Out'}</td>"""
        f"""<td class="num">{dollars(s['min'])}</td><td class="num">{dollars(s['usual'])}</td><td class="num">{dollars(s['max'])}</td>"""
        f"""<td class="num">{s['every']} days</td><td>{short_date(s['first'])}</td>"""
        f"""<td>{esc(s['tag']) if s.get('tag') else NONE}</td></tr>"""
        for s in seed
    )
    f90 = shots_meta.get("forecast90")
    ends = ""
    if f90:
        ends = f"""<dl class="ends">
  <div><dt>Worst case</dt><dd>{dollars(f90['minCents'], cents=True)}</dd></div>
  <div><dt>Expected</dt><dd>{dollars(f90['actualCents'], cents=True)}</dd></div>
  <div><dt>Best case</dt><dd>{dollars(f90['maxCents'], cents=True)}</dd></div>
</dl>"""
    bal = shots_meta.get("balance", {})
    user = shots_meta.get("user", {})
    return f"""
<div class="demo">
  <div class="demo-head">
    <h3>The demo account</h3>
    <p><strong>{esc(user.get('name', 'Sam'))}</strong>, signed up with a throwaway address, keeps the preset tags, starts from a balance of <strong>{dollars(bal.get('amount', '0'))}</strong> on {short_date(bal['asOf']) if bal.get('asOf') else 'today'}, and adds these five streams through the app's own forms. Every capture run makes a fresh account with the same data, dated from the day it runs.</p>
  </div>
  <div class="table-wrap"><table class="streams">
    <thead><tr><th scope="col">Stream</th><th scope="col">In / out</th><th scope="col" class="num">Min</th><th scope="col" class="num">Usual</th><th scope="col" class="num">Max</th><th scope="col" class="num">Every</th><th scope="col">First</th><th scope="col">Tag</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
  {'<p class="ends-label">Balance on day 90, as the app computes it</p>' + ends if ends else ''}
</div>"""


def frame(shot: dict, images: dict, failed: dict) -> str:
    device = shot["device"]
    name = shot["file"]
    vw, vh = VIEWPORT[device]
    if name in images:
        src, w, h = images[name]
        scrolls = h / w > vh / vw + 0.01
        body = f'<img src="{src}" width="{w}" height="{h}" alt="{esc(shot["alt"])}">'
        view = (
            f'<div class="view" tabindex="0" role="region" aria-label="{esc(shot["alt"])}, scroll to see the rest">{body}</div>'
            if scrolls
            else f'<div class="view">{body}</div>'
        )
        label = f'{"Desktop" if device == "desktop" else "Phone"}, {vw} × {vh}' + (
            " · full page, scroll inside" if scrolls else ""
        )
    else:
        reason = failed.get(name) or failed.get("seed") or "no screenshot file was produced"
        view = f'<div class="view view--failed"><p><strong>This screenshot failed to capture.</strong> {esc(reason)}</p></div>'
        label = f'{"Desktop" if device == "desktop" else "Phone"}, {vw} × {vh} · capture failed'
    if device == "desktop":
        chrome = f'<div class="chrome"><span class="addr">{esc(shot.get("path", ""))}</span></div>'
        return f'<figure class="shot shot--desktop"><div class="window">{chrome}{view}</div><figcaption>{label}</figcaption></figure>'
    return f'<figure class="shot shot--phone"><div class="phone">{view}</div><figcaption>{label}</figcaption></figure>'


def tour(content: dict, images: dict, shots_meta: dict) -> str:
    failed = shots_meta.get("failed") or {}
    stops = []
    for stop in content["stop"]:
        devices = {s["device"] for s in stop["shot"]}
        kind = "pair" if devices == {"desktop", "phone"} else ("phone" if devices == {"phone"} else "desktop")
        note = f'<p class="note">{inline(stop["note"])}</p>' if stop.get("note") else ""
        shots = "".join(frame(s, images, failed) for s in stop["shot"])
        stops.append(
            f"""<article class="stop stop--{kind}" id="stop-{esc(stop['id'])}">
  <div class="stop-head"><h3>{esc(stop['title'])}</h3><p class="caption">{inline(stop['caption'])}</p>{note}</div>
  <div class="stop-shots">{shots}</div>
</article>"""
        )
    return f"""
<section id="tour" class="section">
  <h2>The tour</h2>
  <p class="section-intro">{inline(content['tour']['intro'])}</p>
  {demo_block(shots_meta)}
  <div class="stops">{''.join(stops)}</div>
</section>"""


def how(items: list[dict]) -> str:
    cards = []
    for h in items:
        extra = ""
        if h.get("presets"):
            chips = "".join(
                f'<li><span class="dot" style="--dot:{esc(color)}"></span>{esc(name)}</li>'
                for name, color in h["presets"]
            )
            extra = f'<ul class="chips">{chips}</ul>'
        cards.append(f'<div class="how-item"><h3>{esc(h["title"])}</h3>{blocks(h["text"])}{extra}</div>')
    return f"""
<section id="how" class="section">
  <h2>How it works</h2>
  <div class="how-grid">{''.join(cards)}</div>
</section>"""


def api(section: dict) -> str:
    rows = "".join(
        f'<tr><td class="method">{esc(m)}</td><td class="path"><code>{esc(p)}</code></td><td>{inline(b) if b else NONE}</td><td>{inline(r)}</td></tr>'
        for m, p, b, r in section["rows"]
    )
    return f"""
<section id="api" class="section">
  <h2>The API</h2>
  <p class="section-intro">{inline(section['intro'])}</p>
  <div class="table-wrap"><table class="api">
    <thead><tr><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Send</th><th scope="col">Get back</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
  <p class="footnote">{inline(section['footnote'])}</p>
</section>"""


def next_steps(section: dict, questions: list[dict]) -> str:
    cards = "".join(
        f"""<article class="card">
  <header class="card-head"><span class="item-no" title="Whiteboard item {n['item']}">{n['item']}</span><h3>{esc(n['title'])}</h3><span class="size" title="Rough size">{esc(n['size'])}</span></header>
  <dl>
    <dt>In the model</dt><dd>{inline(n['model'])}</dd>
    <dt>On screen</dt><dd>{inline(n['screen'])}</dd>
    <dt>Smallest demo</dt><dd>{inline(n['smallest'])}</dd>
  </dl>
</article>"""
        for n in section["item"]
    )
    qs = "".join(f"<li>{inline(q['text'])}</li>" for q in questions)
    return f"""
<section id="next" class="section">
  <h2>Next steps to plan</h2>
  <p class="section-intro">{inline(section['intro'])}</p>
  <div class="cards">{cards}</div>
  <div class="questions">
    <h3>Open questions for the two of you</h3>
    <ul>{qs}</ul>
  </div>
</section>"""


def footer(meta: dict) -> str:
    return f"""
<footer class="foot">
  <p><span class="k">Live</span> <a href="{esc(meta['public_url'])}">{esc(meta['public_url'].removeprefix('https://'))}</a> <span class="muted">({esc(meta['public_note'])})</span></p>
  <p><span class="k">Code</span> <a href="{esc(meta['repo_url'])}">{esc(meta['repo_url'].removeprefix('https://'))}</a></p>
</footer>"""


# ----------------------------------------------------------------------------- page

FONTS = "https://fonts.googleapis.com/css2?family=Gabarito:wght@500;600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"

CSS = """
:root {
  --ground: #ffffff;
  --surface: #f7f6f2;
  --surface-2: #eeece6;
  --ink: #1c1b18;
  --ink-2: #45423c;
  --muted: #6d685f;
  --rule: #e4e0d7;
  --brand: #16a34a;
  --brand-strong: #15803d;
  --brand-soft: #f0fbf3;
  --brand-line: #bfe3ca;
  --on-brand: #ffffff;
  --mark-bg: #16a34a;
  --mark-fg: #ffffff;
  --bezel: #23221e;
  --bezel-ring: #d6d1c6;
  --window-bar: #f1efea;
  --shot-bg: #ffffff;
  --shadow: 0 1px 2px rgb(40 36 28 / 0.06), 0 10px 28px -14px rgb(40 36 28 / 0.22);
  --focus: #15803d;
  --font-display: "Gabarito", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --font-body: "Instrument Sans", "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ground: #131310;
    --surface: #1c1b17;
    --surface-2: #26251f;
    --ink: #f1eee7;
    --ink-2: #d3cfc6;
    --muted: #a39e93;
    --rule: #34322c;
    --brand: #22c55e;
    --brand-strong: #4ade80;
    --brand-soft: #14231a;
    --brand-line: #25482f;
    --on-brand: #06170c;
    --bezel: #2c2b26;
    --bezel-ring: #4a4740;
    --window-bar: #24231e;
    --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 12px 30px -14px rgb(0 0 0 / 0.7);
    --focus: #4ade80;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --ground: #131310;
  --surface: #1c1b17;
  --surface-2: #26251f;
  --ink: #f1eee7;
  --ink-2: #d3cfc6;
  --muted: #a39e93;
  --rule: #34322c;
  --brand: #22c55e;
  --brand-strong: #4ade80;
  --brand-soft: #14231a;
  --brand-line: #25482f;
  --on-brand: #06170c;
  --bezel: #2c2b26;
  --bezel-ring: #4a4740;
  --window-bar: #24231e;
  --shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 12px 30px -14px rgb(0 0 0 / 0.7);
  --focus: #4ade80;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  padding-inline: 16px;
  padding-block: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1000px; margin-inline: auto; padding-block: 40px 56px; }
img { max-width: 100%; height: auto; display: block; }
a { color: var(--brand-strong); text-underline-offset: 3px; text-decoration-thickness: 1px; }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; border-radius: 4px; }
code { font-family: var(--font-mono); font-size: 0.86em; background: var(--surface-2); padding: 0.08em 0.36em; border-radius: 5px; color: var(--ink); }
strong { font-weight: 600; color: var(--ink); }
.muted { color: var(--muted); }
.k { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
h1, h2, h3 { font-family: var(--font-display); color: var(--ink); text-wrap: balance; margin: 0; }
h2 { font-size: clamp(26px, 3.4vw, 32px); font-weight: 700; letter-spacing: -0.015em; line-height: 1.15; }
h3 { font-size: 19px; font-weight: 600; letter-spacing: -0.005em; line-height: 1.25; }
p { margin: 0; }

/* header */
.top { display: grid; gap: 14px; padding-bottom: 28px; border-bottom: 1px solid var(--rule); }
.brand { display: flex; align-items: center; gap: 10px; }
.mark { width: 34px; height: 34px; flex: none; }
.wordmark { font-family: var(--font-display); font-weight: 700; font-size: 24px; letter-spacing: -0.01em; }
.brand-sub { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); padding-left: 10px; border-left: 1px solid var(--rule); }
h1 { font-size: clamp(36px, 6vw, 54px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.02; margin-top: 10px; }
.lede { font-size: clamp(17px, 2vw, 20px); color: var(--ink-2); max-width: 44ch; line-height: 1.45; }
.facts { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.facts li { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; padding: 5px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--rule); }
.facts li:first-child { background: var(--brand-soft); border-color: var(--brand-line); color: var(--brand-strong); font-weight: 600; }
.facts code { background: none; padding: 0; }
.captured { font-size: 13px; color: var(--muted); }
.captured code { font-size: 12px; }
.toc { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 6px; font-size: 14px; font-weight: 500; }
.toc a { color: var(--ink-2); text-decoration: none; }
.toc a:hover { color: var(--brand-strong); text-decoration: underline; }

/* sections */
.section { padding-block: 44px 8px; display: grid; gap: 18px; }
.section-intro { color: var(--ink-2); max-width: 66ch; margin-top: -6px; }

/* iterations */
.iters { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.iter { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 16px; padding: 16px 18px; border: 1px solid var(--rule); border-radius: 14px; background: var(--surface); }
.iter-n { font-family: var(--font-display); font-weight: 800; font-size: 34px; line-height: 1; color: var(--brand-strong); text-align: center; padding-top: 2px; }
.iter-body { display: grid; gap: 6px; }
.iter-meta { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 14px; color: var(--muted); }
.iter-meta code { font-size: 12.5px; }
.iter-what { color: var(--ink); max-width: 70ch; }
.iter-shots { font-size: 14px; color: var(--ink-2); display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }

/* checklist */
.checklist { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 28px; }
.done { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 12px; padding-block: 14px; border-top: 1px solid var(--rule); }
.check { width: 22px; height: 22px; margin-top: 2px; }
.done h3 { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
.done p { color: var(--ink-2); font-size: 15px; }
.item-no { font-family: var(--font-mono); font-size: 12px; font-weight: 500; color: var(--brand-strong); background: var(--brand-soft); border: 1px solid var(--brand-line); border-radius: 6px; padding: 1px 7px; line-height: 1.5; flex: none; }
.also { font-size: 15px; color: var(--ink-2); padding: 12px 16px; border-radius: 12px; background: var(--surface); max-width: 80ch; }

/* demo account */
.demo { display: grid; gap: 14px; padding: 20px; border-radius: 16px; background: var(--brand-soft); border: 1px solid var(--brand-line); }
.demo-head { display: grid; gap: 6px; }
.demo-head p { color: var(--ink-2); max-width: 75ch; font-size: 15px; }
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 8px 12px 8px 0; vertical-align: top; }
thead th { font-family: var(--font-mono); font-size: 11.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border-bottom: 1px solid var(--rule); white-space: nowrap; }
tbody tr + tr > * { border-top: 1px solid var(--rule); }
.streams tbody th { font-weight: 600; white-space: nowrap; }
.streams td { white-space: nowrap; }
.demo .streams thead th { border-bottom-color: var(--brand-line); }
.demo .streams tbody tr + tr > * { border-top-color: var(--brand-line); }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.ends-label { font-size: 13px; color: var(--muted); margin-bottom: -6px; }
.ends { display: flex; flex-wrap: wrap; gap: 10px 36px; margin: 0; }
.ends div { display: grid; }
.ends dt { font-size: 13px; color: var(--muted); }
.ends dd { margin: 0; font-family: var(--font-display); font-weight: 700; font-size: 26px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.ends div:nth-child(2) dd { color: var(--brand-strong); }

/* tour stops */
.stops { display: grid; gap: 40px; margin-top: 18px; }
.stop { display: grid; gap: 16px; padding-top: 28px; border-top: 1px solid var(--rule); }
.stop-head { display: grid; gap: 6px; align-content: start; }
.caption { color: var(--ink-2); max-width: 70ch; }
.note { font-size: 14.5px; color: var(--ink-2); padding: 10px 14px; border-left: 3px solid var(--brand); background: var(--surface); border-radius: 0 10px 10px 0; max-width: 70ch; }
.stop-shots { display: grid; gap: 24px; align-items: start; }
.stop--pair .stop-shots { grid-template-columns: minmax(0, 1fr) 250px; }
.stop--phone { grid-template-columns: minmax(0, 1fr) 250px; column-gap: 40px; align-items: center; }
.stop--phone .stop-shots { grid-template-columns: 250px; }

.shot { margin: 0; display: grid; gap: 8px; min-width: 0; }
.shot figcaption { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); letter-spacing: 0.02em; }
.shot--phone figcaption { text-align: center; }
.window { border: 1px solid var(--bezel-ring); border-radius: 12px; overflow: hidden; background: var(--ground); box-shadow: var(--shadow); }
.chrome { display: flex; align-items: center; height: 30px; padding-inline: 12px; background: var(--window-bar); border-bottom: 1px solid var(--rule); }
.addr { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); background: var(--ground); border: 1px solid var(--rule); border-radius: 6px; padding: 1px 10px; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.addr::before { content: "kriket"; color: var(--brand-strong); margin-right: 6px; }
.shot--desktop .view { aspect-ratio: 1280 / 800; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; background: var(--shot-bg); }
.phone { width: 100%; max-width: 250px; margin-inline: auto; padding: 8px; border-radius: 34px; background: var(--bezel); box-shadow: 0 0 0 1px var(--bezel-ring), var(--shadow); }
.shot--phone .view { aspect-ratio: 375 / 812; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; border-radius: 26px; background: var(--shot-bg); }
.shot--phone .view::-webkit-scrollbar { display: none; }
.view--failed { display: grid; place-items: center; padding: 20px; text-align: center; font-size: 14px; color: var(--ink-2); background: var(--surface) !important; border: 2px dashed var(--rule); }
.failed-note { color: var(--ink-2); font-size: 14px; }

/* how it works */
.how-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.how-item { display: grid; gap: 8px; align-content: start; padding: 18px 20px; border-radius: 14px; background: var(--surface); }
.how-item:nth-child(2) { grid-row: span 2; }
.how-item p, .how-item li { color: var(--ink-2); font-size: 15px; }
.how-item ul { margin: 0; padding-left: 1.1em; display: grid; gap: 4px; }
.how-item:nth-child(2) code { font-size: 0.9em; }
.chips { list-style: none; padding: 0 !important; display: flex !important; flex-wrap: wrap; gap: 6px !important; }
.chips li { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; padding: 3px 10px; border-radius: 999px; background: var(--ground); border: 1px solid var(--rule); color: var(--ink); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--dot); flex: none; }

/* api */
.api td { font-size: 13.5px; color: var(--ink-2); }
.api .method { font-family: var(--font-mono); font-size: 12px; font-weight: 500; color: var(--brand-strong); white-space: nowrap; }
.api .path code { background: none; padding: 0; white-space: nowrap; font-size: 12.5px; }
.api td code { font-size: 12px; }
.footnote { font-size: 14px; color: var(--muted); max-width: 80ch; }

/* next steps */
.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.card { display: grid; gap: 12px; align-content: start; padding: 18px 20px 20px; border: 1px solid var(--rule); border-radius: 14px; background: var(--ground); }
.card-head { display: flex; align-items: center; gap: 10px; }
.card-head h3 { flex: 1; min-width: 0; }
.size { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--ink); background: var(--surface-2); border-radius: 8px; padding: 2px 9px; white-space: nowrap; }
.card dl { margin: 0; display: grid; gap: 4px; }
.card dt { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-top: 6px; }
.card dt:first-child { margin-top: 0; }
.card dd { margin: 0; font-size: 14.5px; color: var(--ink-2); }
.questions { display: grid; gap: 10px; margin-top: 10px; padding: 20px 22px; border-radius: 16px; background: var(--brand-soft); border: 1px solid var(--brand-line); }
.questions ul { margin: 0; padding-left: 1.1em; display: grid; gap: 8px; }
.questions li { color: var(--ink-2); max-width: 78ch; }
.questions li::marker { color: var(--brand-strong); }

/* footer */
.foot { margin-top: 48px; padding-top: 18px; border-top: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 8px 32px; font-size: 14px; }
.foot p { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }

@media (max-width: 760px) {
  .wrap { padding-block: 24px 40px; }
  .checklist, .how-grid, .cards { grid-template-columns: minmax(0, 1fr); }
  .how-item:nth-child(2) { grid-row: auto; }
  .stop--pair .stop-shots, .stop--phone, .stop--phone .stop-shots { grid-template-columns: minmax(0, 1fr); }
  .shot--desktop .view { aspect-ratio: auto; max-height: 440px; }
  .iter { grid-template-columns: 32px minmax(0, 1fr); gap: 12px; padding: 14px; }
  .iter-n { font-size: 26px; }
  .demo { padding: 16px; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
"""


def build(out: Path, do_convert: bool) -> None:
    content = tomllib.loads((HERE / "content.toml").read_text(encoding="utf-8"))
    meta_path = HERE / "shots" / "meta.json"
    shots_meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    if do_convert:
        convert()
    images = load_images()
    meta = content["meta"]
    page = f"""<title>{esc(meta['title'])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>{CSS}</style>
<div class="wrap">
{header(meta, shots_meta)}
<main>
{iterations(content['iteration'])}
{built(content['built'], content['also'])}
{tour(content, images, shots_meta)}
{how(content['how'])}
{api(content['api'])}
{next_steps(content['next'], content.get('question', []))}
</main>
{footer(meta)}
</div>
"""
    out.write_text(page, encoding="utf-8")
    size = out.stat().st_size
    missing = [s["file"] for stop in content["stop"] for s in stop["shot"] if s["file"] not in images]
    print(f"wrote {out} ({size / 1024 / 1024:.2f} MB, {len(images)} screenshots embedded)")
    if missing:
        print(f"WARNING: no screenshot for {', '.join(missing)}; the page says so in their frames")
    if size > BUDGET_BYTES:
        print(f"WARNING: over the {BUDGET_BYTES // 1024 // 1024} MB budget; lower QUALITY or MAX_WIDTH")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="where to write the HTML")
    parser.add_argument("--no-convert", action="store_true", help="reuse shots/jpg as they are")
    args = parser.parse_args()
    build(args.out, not args.no_convert)
