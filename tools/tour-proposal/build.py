#!/usr/bin/env python3
"""Builds the proposed-prototype tour for iteration 2.

    python3 tools/tour-proposal/build.py

1. Computes Sam's forecasts from the seed below with the app's own rule (one point per day, worst,
   expected, and best case; see backend/src/services/forecast.ts).
2. Renders out/app.html: prototype.html with the data injected where it says __DATA__.
3. Renders out/index.html: the tour page (words from content.toml, style copied from
   tools/tour/build-tour.py) with every frame's srcdoc holding the whole prototype, started on
   that frame's screen.

Prints the sizes and a short sanity check of the forecast. Standard library only (Python 3.12).
"""

from __future__ import annotations

import html
import json
import sys
import tomllib
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
BUDGET_BYTES = 4 * 1024 * 1024
VIEWPORT = {"desktop": (1280, 800), "phone": (375, 812)}
WINDOWS = (30, 90, 180)

# ----------------------------------------------------------------------------- the seed
# Fixed "today": Saturday 26 September 2026. All dates are static.

TODAY = "2026-09-26"

# The four proposed presets, two for money in and two for money out, then one tag of Sam's own.
TAGS = [
    {"id": "pay", "name": "Pay cheque", "color": "#16a34a", "preset": True},
    {"id": "side", "name": "Side hustle", "color": "#059669", "preset": True},
    {"id": "bill", "name": "Bill", "color": "#ea580c", "preset": True},
    {"id": "groceries", "name": "Groceries", "color": "#d97706", "preset": True},
    {"id": "fun", "name": "Fun", "color": "#a855f7", "preset": False},
]

# `unit` names one occurrence, for the answer sentence ("your first café shift").
STREAMS = [
    {"id": "cafe", "kind": "income", "name": "Café shifts", "unit": "café shift", "min": 15000, "usual": 22000, "max": 30000, "every": 7, "first": "2026-10-03", "tag": "pay"},
    {"id": "tutoring", "kind": "income", "name": "Tutoring", "unit": "tutoring session", "min": 8000, "usual": 12000, "max": 16000, "every": 14, "first": "2026-10-08", "tag": "side"},
    {"id": "rent", "kind": "expense", "name": "Rent", "unit": "rent", "min": 60000, "usual": 60000, "max": 60000, "every": 30, "first": "2026-10-01", "tag": "bill"},
    {"id": "groceries", "kind": "expense", "name": "Groceries", "unit": "grocery run", "min": 6000, "usual": 8500, "max": 12000, "every": 7, "first": "2026-09-15", "tag": "groceries"},
    {"id": "phone", "kind": "expense", "name": "Phone and subscriptions", "unit": "phone bill", "min": 4200, "usual": 4200, "max": 4200, "every": 30, "first": "2026-10-06", "tag": "bill"},
]

# Balance check-ins, oldest first; the last one is the current one.
CHECKINS = [("2026-09-12", 61000), ("2026-09-19", 52000), ("2026-09-26", 43000)]

# The Coming up screen shows these months, and no month before the first check-in.
MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"]

# ----------------------------------------------------------------------------- dates and money

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]


def add_days(iso: str, n: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=n)).isoformat()


def days_between(a: str, b: str) -> int:
    """Days from a to b; negative when b is before a."""
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def day_label(iso: str) -> str:
    """'2026-10-01' -> 'Oct 1', the app's formatDate."""
    d = date.fromisoformat(iso)
    return f"{MONTH_NAMES[d.month - 1]} {d.day}"


def long_label(iso: str) -> str:
    """'2026-09-26' -> 'Sep 26, 2026', what a date field shows."""
    d = date.fromisoformat(iso)
    return f"{MONTH_NAMES[d.month - 1]} {d.day}, {d.year}"


def money(cents: int) -> str:
    """'−$255.00' / '$1,234.50', the app's formatCents with a real minus sign."""
    sign = "−" if cents < 0 else ""
    return f"{sign}${abs(cents) / 100:,.2f}"


def money_short(cents: int) -> str:
    """'$255' when there are no cents, else '$254.50'; for the answer's headline."""
    cents = abs(cents)
    return f"${cents // 100:,}" if cents % 100 == 0 else f"${cents / 100:,.2f}"


# ----------------------------------------------------------------------------- the forecast rule


def occurrences(stream: dict, start: str, end: str) -> list[str]:
    """Dates on which the stream pays inside [start, end]: firstDate + k * intervalDays, k >= 0."""
    offset = days_between(stream["first"], start)
    k = 0 if offset <= 0 else -(-offset // stream["every"])  # ceil
    out = []
    while True:
        d = add_days(stream["first"], k * stream["every"])
        if d > end:
            return out
        if d >= start:
            out.append(d)
        k += 1


def events_between(start: str, end: str) -> list[dict]:
    """Every occurrence of every stream in [start, end], sorted by date, incomes first, then name."""
    events = []
    for s in STREAMS:
        for d in occurrences(s, start, end):
            events.append({"date": d, "stream": s["id"], "kind": s["kind"], "name": s["name"], "min": s["min"], "usual": s["usual"], "max": s["max"]})
    events.sort(key=lambda e: (e["date"], 0 if e["kind"] == "income" else 1, e["name"]))
    return events


def compute_forecast(start: str, days: int, balance: int) -> dict:
    """The app's computeForecast: days + 1 points from the start date, the balance at the START of
    the start date being the check-in amount. Worst case: incomes at their minimum, expenses at their
    maximum; best case the reverse."""
    end = add_days(start, days)
    events = events_between(start, end)
    lo = ex = hi = balance
    points, out_events = [], []
    nxt = 0
    for day in range(days + 1):
        d = add_days(start, day)
        while nxt < len(events) and events[nxt]["date"] == d:
            e = events[nxt]
            nxt += 1
            if e["kind"] == "income":
                lo, ex, hi = lo + e["min"], ex + e["usual"], hi + e["max"]
            else:
                lo, ex, hi = lo - e["max"], ex - e["usual"], hi - e["min"]
            out_events.append({"day": day, "stream": e["stream"], "kind": e["kind"], "name": e["name"], "cents": e["usual"]})
        points.append([lo, ex, hi])
    return {"start": start, "days": days, "end": end, "points": points, "events": out_events}


def describe(f: dict) -> None:
    """Adds the lowest point of the expected line, the day it is back above zero for good, and the
    answer sentence, to a forecast."""
    expected = [p[1] for p in f["points"]]
    low_cents = min(expected)
    low_day = expected.index(low_cents)
    f["low"] = {"day": low_day, "cents": low_cents}
    f["end_balance"] = f["points"][-1]

    if low_cents >= 0:
        f["recovery"] = None
        f["answer"] = {
            "kind": "ok",
            "title": f"You stay above zero all {f['days']} days",
            "body": f"Lowest point {money(low_cents)} on {day_label(add_days(f['start'], low_day))}.",
        }
        return

    # First day after the low from which the expected line never dips below zero again.
    recovery = None
    for day in range(low_day + 1, len(expected)):
        if all(v >= 0 for v in expected[day:]):
            recovery = day
            break
    f["recovery"] = recovery

    by_id = {s["id"]: s for s in STREAMS}
    on_low = [e for e in f["events"] if e["day"] == low_day and e["kind"] == "expense"]
    cause = max(on_low, key=lambda e: e["cents"]) if on_low else None
    next_income = next((e for e in f["events"] if e["day"] > low_day and e["kind"] == "income"), None)
    low_date = day_label(add_days(f["start"], low_day))
    title = f"You go {money_short(low_cents)} short on {low_date}"
    parts = []
    if cause and next_income:
        parts.append(f"{cause['name']} lands before your first {by_id[next_income['stream']]['unit']}.")
    elif cause:
        parts.append(f"{cause['name']} lands on {low_date}.")
    if recovery is not None:
        on_recovery = [e for e in f["events"] if e["day"] == recovery and e["kind"] == "income"]
        payer = max(on_recovery, key=lambda e: e["cents"]) if on_recovery else None
        when = day_label(add_days(f["start"], recovery))
        if payer:
            nth = sum(1 for e in f["events"] if e["stream"] == payer["stream"] and e["day"] <= recovery)
            ordinal = ORDINALS[nth - 1] if nth <= len(ORDINALS) else f"{nth}th"
            parts.append(f"You are under zero until {when}, when the {ordinal} {by_id[payer['stream']]['unit']} pays.")
        else:
            parts.append(f"You are under zero until {when}.")
    else:
        parts.append(f"You are still under zero on {day_label(f['end'])}, the last day of the forecast.")
    parts.append(f"Lowest point {money(low_cents)}.")
    f["answer"] = {"kind": "short", "title": title, "body": " ".join(parts)}


def compare_with_forecast(index: int) -> str:
    """How check-in `index` compared with what the previous check-in's forecast expected that day."""
    if index == 0:
        return "first check-in"
    prev_date, prev_cents = CHECKINS[index - 1]
    this_date, this_cents = CHECKINS[index]
    gap = days_between(prev_date, this_date)
    expected = compute_forecast(prev_date, gap, prev_cents)["points"][-1][1]
    diff = this_cents - expected
    if diff == 0:
        return "as forecast"
    return f"{money(abs(diff))} {'over' if diff > 0 else 'under'} forecast"


def build_months(current: dict) -> list[dict]:
    """One entry per month on the Coming up screen. Days before today are marked past. In and Out
    count from today; 'end' is the expected balance on the month's last day, from the current
    check-in's 180-day forecast."""
    started, _ = CHECKINS[0]
    f180 = current["forecasts"]["180"]
    balance_on = {add_days(f180["start"], i): p[1] for i, p in enumerate(f180["points"])}
    months = []
    for key in MONTHS:
        year, month = (int(x) for x in key.split("-"))
        first = date(year, month, 1).isoformat()
        last = (date(year + (month == 12), month % 12 + 1, 1) - timedelta(days=1)).isoformat()
        start = max(first, started)
        events = events_between(start, last)
        days: list[dict] = []
        for e in events:
            if not days or days[-1]["date"] != e["date"]:
                days.append({"date": e["date"], "past": e["date"] < TODAY, "events": []})
            days[-1]["events"].append({"stream": e["stream"], "kind": e["kind"], "name": e["name"], "cents": e["usual"]})
        upcoming = [e for e in events if e["date"] >= TODAY]
        months.append({
            "key": key,
            "label": f"{MONTH_LONG[month - 1]} {year}",
            "from": start,
            "in": sum(e["usual"] for e in upcoming if e["kind"] == "income"),
            "out": sum(e["usual"] for e in upcoming if e["kind"] == "expense"),
            "end": balance_on.get(last),
            "days": days,
        })
    return months


def next_occurrence(stream: dict) -> str:
    return occurrences(stream, TODAY, add_days(TODAY, 366 * 2))[0]


def build_data() -> dict:
    checkins = []
    for i, (d, cents) in enumerate(CHECKINS):
        forecasts = {}
        for days in WINDOWS:
            f = compute_forecast(d, days, cents)
            describe(f)
            forecasts[str(days)] = f
        checkins.append({"date": d, "cents": cents, "note": compare_with_forecast(i), "forecasts": forecasts})
    streams = [{**{k: v for k, v in s.items() if k != "unit"}, "next": next_occurrence(s)} for s in STREAMS]
    return {
        "today": TODAY,
        "startedOn": CHECKINS[0][0],
        "tags": TAGS,
        "streams": streams,
        "checkins": checkins,
        "months": build_months(checkins[-1]),
    }


# ----------------------------------------------------------------------------- sanity check


def sanity(data: dict) -> None:
    """Prints the numbers the tour's captions rely on and stops the build if they no longer hold."""
    current = data["checkins"][-1]
    f = current["forecasts"]["90"]
    at = {add_days(f["start"], i): p for i, p in enumerate(f["points"])}
    print("expected balance from the Sep 26 check-in:")
    for d in ["2026-09-26", "2026-09-29", "2026-10-01", "2026-10-03", "2026-10-06", "2026-10-08", "2026-10-10"]:
        print(f"  {day_label(d):>6}  {money(at[d][1])}")
    end = f["end_balance"]
    print(f"  day 90 ({day_label(f['end'])}): worst {money(end[0])}, expected {money(end[1])}, best {money(end[2])}")
    low = f["low"]
    low_date = add_days(f["start"], low["day"])
    recovery = add_days(f["start"], f["recovery"]) if f["recovery"] is not None else None
    print(f"  lowest point {money(low['cents'])} on {day_label(low_date)}; above zero for good from {day_label(recovery) if recovery else 'never'}")
    print(f"  answer: {f['answer']['title']}. {f['answer']['body']}")
    for c in data["checkins"]:
        print(f"  check-in {day_label(c['date'])} {money(c['cents'])}: {c['note']}")
    problems = []
    if (low_date, low["cents"]) != ("2026-10-01", -25500):
        problems.append(f"the lowest point is {money(low['cents'])} on {low_date}, the captions say −$255.00 on Oct 1")
    if recovery != "2026-10-10":
        problems.append(f"the recovery is {recovery}, the captions say Oct 10")
    if [c["note"] for c in data["checkins"]] != ["first check-in", "$5.00 under forecast", "$5.00 under forecast"]:
        problems.append("the check-in notes changed; the captions say $5.00 under forecast twice")
    if problems:
        sys.exit("The seed no longer tells the story the tour describes:\n  " + "\n  ".join(problems))


# ----------------------------------------------------------------------------- the prototype


def render_app(data: dict) -> str:
    template = (HERE / "prototype.html").read_text(encoding="utf-8")
    marker = "__DATA__"
    if template.count(marker) != 1:
        sys.exit(f"prototype.html must contain {marker} exactly once")
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    # A closing tag inside the JSON would end the script element early.
    blob = blob.replace("</", "<\\/")
    return template.replace(marker, blob)


def with_start(app: str, screen: str) -> str:
    head = '<html lang="en">'
    if head not in app:
        sys.exit(f"prototype.html must open with {head}")
    return app.replace(head, f'<html lang="en" data-start="{screen}">', 1)


# ----------------------------------------------------------------------------- the tour page

esc = lambda s: html.escape(str(s), quote=True)  # noqa: E731

MARK = """<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--mark-bg)"/><g fill="none" stroke="var(--mark-fg)" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 13.4C24 9.6 26 7.6 28.4 6.6M21 13C21.2 9.4 22.6 6.9 24.8 5.4" stroke-width="1.2"/><path d="M13.4 17.6 8.6 11.8 6.2 22.4" stroke-width="1.8"/><path d="M18.4 20.2 19.6 24.4M15 21 14.4 24.8" stroke-width="1.3"/></g><g fill="var(--mark-fg)"><ellipse cx="14.6" cy="18.4" rx="6.8" ry="3.5" transform="rotate(-14 14.6 18.4)"/><circle cx="21.6" cy="15.6" r="2.6"/></g></svg>"""

FONTS = "https://fonts.googleapis.com/css2?family=Gabarito:wght@500;600;700;800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap"

# The tour's style, copied from tools/tour/build-tour.py so the two pages read as one family, plus
# the rules the frames need (an iframe scaled to fit instead of an image).
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
.links { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 14.5px; }
.toc { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-top: 6px; font-size: 14px; font-weight: 500; }
.toc a { color: var(--ink-2); text-decoration: none; }
.toc a:hover { color: var(--brand-strong); text-decoration: underline; }

/* sections */
.section { padding-block: 44px 8px; display: grid; gap: 18px; }
.section-intro { color: var(--ink-2); max-width: 66ch; margin-top: -6px; }
.plain { margin: 0; padding-left: 1.1em; display: grid; gap: 8px; }
.plain li { color: var(--ink-2); max-width: 78ch; }
.plain li::marker { color: var(--brand-strong); }

/* tour stops */
.stops { display: grid; gap: 40px; margin-top: 18px; }
.stop { display: grid; gap: 16px; padding-top: 28px; border-top: 1px solid var(--rule); }
.stop-head { display: grid; gap: 6px; align-content: start; }
.caption { color: var(--ink-2); max-width: 70ch; }
.note { font-size: 14.5px; color: var(--ink-2); padding: 10px 14px; border-left: 3px solid var(--brand); background: var(--surface); border-radius: 0 10px 10px 0; max-width: 70ch; }
.answers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px; }
.chip { font-family: var(--font-mono); font-size: 12px; font-weight: 500; color: var(--brand-strong); background: var(--brand-soft); border: 1px solid var(--brand-line); border-radius: 6px; padding: 1px 7px; line-height: 1.5; }
.stop-shots { display: grid; gap: 24px; align-items: start; }
.stop--pair .stop-shots { grid-template-columns: minmax(0, 1fr) 250px; }
/* The desktop window always takes the wide column, whichever frame comes first. */
.stop--pair .shot--desktop { grid-column: 1; grid-row: 1; }
.stop--pair .shot--phone { grid-column: 2; grid-row: 1; }
.stop--phone { grid-template-columns: minmax(0, 1fr) 250px; column-gap: 40px; align-items: center; }
.stop--phone .stop-shots { grid-template-columns: 250px; }

.shot { margin: 0; display: grid; gap: 8px; min-width: 0; }
.shot figcaption { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); letter-spacing: 0.02em; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; }
.shot--phone figcaption { flex-direction: column; align-items: center; text-align: center; gap: 2px; }
.window { border: 1px solid var(--bezel-ring); border-radius: 12px; overflow: hidden; background: var(--ground); box-shadow: var(--shadow); }
.chrome { display: flex; align-items: center; height: 30px; padding-inline: 12px; background: var(--window-bar); border-bottom: 1px solid var(--rule); }
.addr { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted); background: var(--ground); border: 1px solid var(--rule); border-radius: 6px; padding: 1px 10px; min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.addr::before { content: "kriket"; color: var(--brand-strong); margin-right: 6px; }
.view { position: relative; overflow: hidden; background: var(--shot-bg); }
.shot--desktop .view { aspect-ratio: 1280 / 800; }
.phone { width: 100%; max-width: 250px; margin-inline: auto; padding: 8px; border-radius: 34px; background: var(--bezel); box-shadow: 0 0 0 1px var(--bezel-ring), var(--shadow); }
.shot--phone .view { aspect-ratio: 375 / 812; border-radius: 26px; }
.view iframe { display: block; border: 0; transform-origin: top left; background: #ffffff; }
.view iframe:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; }

/* footer */
.foot { margin-top: 48px; padding-top: 18px; border-top: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 8px 32px; font-size: 14px; }
.foot p { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }

@media (max-width: 760px) {
  .wrap { padding-block: 24px 40px; }
  .stop--pair .stop-shots, .stop--phone, .stop--phone .stop-shots { grid-template-columns: minmax(0, 1fr); }
  .stop--pair .shot--desktop, .stop--pair .shot--phone { grid-column: auto; grid-row: auto; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
"""

# Scales every frame's iframe to the width of its view, on load and on resize.
FIT_SCRIPT = """
(function () {
  function fit() {
    document.querySelectorAll('.view > iframe').forEach(function (frame) {
      var view = frame.parentElement;
      var w = Number(frame.getAttribute('width'));
      var h = Number(frame.getAttribute('height'));
      var scale = view.clientWidth / w;
      frame.style.transform = 'scale(' + scale + ')';
      view.style.height = Math.round(h * scale) + 'px';
    });
  }
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  fit();
})();
"""


def frame(fr: dict, app: str) -> str:
    device = fr["device"]
    vw, vh = VIEWPORT[device]
    doc = with_start(app, fr["screen"])
    iframe = (
        f'<iframe srcdoc="{esc(doc)}" width="{vw}" height="{vh}" title="{esc(fr["title"])}" loading="lazy"></iframe>'
    )
    device_label = "Desktop" if device == "desktop" else "Phone"
    caption = (
        f'<figcaption><span>{device_label}, {vw} × {vh} · click inside</span>'
        f'<a href="app.html#{esc(fr["screen"])}">Open full screen ↗</a></figcaption>'
    )
    if device == "desktop":
        chrome = f'<div class="chrome"><span class="addr">{esc(fr.get("path", ""))}</span></div>'
        return f'<figure class="shot shot--desktop"><div class="window">{chrome}<div class="view">{iframe}</div></div>{caption}</figure>'
    return f'<figure class="shot shot--phone"><div class="phone"><div class="view">{iframe}</div></div>{caption}</figure>'


def stop(s: dict, app: str) -> str:
    devices = [f["device"] for f in s["frame"]]
    kind = "pair" if set(devices) == {"desktop", "phone"} else devices[0]
    note = f'<p class="note">{esc(s["note"])}</p>' if s.get("note") else ""
    chips = "".join(f'<span class="chip">{esc(a)}</span>' for a in s.get("answers", []))
    answers = f'<p class="answers"><span class="k">Answers</span>{chips}</p>' if chips else ""
    frames = "".join(frame(f, app) for f in s["frame"])
    return f"""<article class="stop stop--{kind}" id="{esc(s['id'])}">
  <div class="stop-head"><h3>{esc(s['title'])}</h3><p class="caption">{esc(s['caption'])}</p>{note}{answers}</div>
  <div class="stop-shots">{frames}</div>
</article>"""


def render_index(content: dict, app: str) -> str:
    meta = content["meta"]
    facts = "".join(f"<li>{esc(f)}</li>" for f in meta["facts"])
    links = "".join(f'<a href="{esc(l["url"])}">{esc(l["label"])}</a>' for l in meta["link"])
    toc_items = [("how", "How to read this")] + [(s["id"], s["title"]) for s in content["stop"]] + [("not-here", "Not in this prototype")]
    toc = "".join(f'<a href="#{esc(i)}">{esc(t)}</a>' for i, t in toc_items)
    how = "".join(f"<li>{esc(i)}</li>" for i in content["how"]["items"])
    stops = "".join(stop(s, app) for s in content["stop"])
    not_here = "".join(f"<li>{esc(i)}</li>" for i in content["not_here"]["items"])
    return f"""<title>{esc(meta['title'])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>{CSS}</style>
<div class="wrap">
<header class="top">
  <p class="brand">{MARK}<span class="wordmark">{esc(meta['name'])}</span><span class="brand-sub">{esc(meta['sub'])}</span></p>
  <h1>{esc(meta['headline'])}</h1>
  <p class="lede">{esc(meta['lede'])}</p>
  <ul class="facts">{facts}</ul>
  <p class="links">{links}</p>
  <nav class="toc" aria-label="On this page">{toc}</nav>
</header>
<main>
<section id="how" class="section">
  <h2>{esc(content['how']['title'])}</h2>
  <ul class="plain">{how}</ul>
</section>
<section id="tour" class="section">
  <h2>{esc(content['tour']['title'])}</h2>
  <p class="section-intro">{esc(content['tour']['intro'])}</p>
  <div class="stops">{stops}</div>
</section>
<section id="not-here" class="section">
  <h2>{esc(content['not_here']['title'])}</h2>
  <ul class="plain">{not_here}</ul>
</section>
</main>
<footer class="foot">
  <p><span class="k">Live</span> <a href="{esc(meta['live_url'])}">{esc(meta['live_url'].removeprefix('https://'))}</a> <span class="muted">({esc(meta['live_note'])})</span></p>
  <p><span class="k">Code</span> <a href="{esc(meta['repo_url'])}">{esc(meta['repo_url'].removeprefix('https://'))}</a></p>
  <p class="muted">{esc(meta['footer_note'])}</p>
</footer>
</div>
<script>{FIT_SCRIPT}</script>
"""


# ----------------------------------------------------------------------------- main


def build() -> None:
    content = tomllib.loads((HERE / "content.toml").read_text(encoding="utf-8"))
    data = build_data()
    sanity(data)
    OUT.mkdir(exist_ok=True)

    app = render_app(data)
    app_path = OUT / "app.html"
    app_path.write_text(app, encoding="utf-8")

    index = render_index(content, app)
    index_path = OUT / "index.html"
    index_path.write_text(index, encoding="utf-8")

    frames = sum(len(s["frame"]) for s in content["stop"])
    print(f"wrote {app_path} ({app_path.stat().st_size / 1024:.0f} KB)")
    print(f"wrote {index_path} ({index_path.stat().st_size / 1024 / 1024:.2f} MB, {frames} frames)")
    if index_path.stat().st_size > BUDGET_BYTES:
        sys.exit(f"index.html is over the {BUDGET_BYTES // 1024 // 1024} MB budget; trim prototype.html")


if __name__ == "__main__":
    build()
