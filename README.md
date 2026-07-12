# 📍 Citewatch

**One NAP, everywhere, always. Pay once — not $39/mo.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Citewatch is a self-hosted local-SEO citation tracker. Set your business's **canonical NAP** (name, address, phone) once, then audit what every directory — Google Business Profile, Yelp, Facebook, Apple Maps, Bing Places, and any industry directory you add — actually shows. Citewatch diffs each listing against the source of truth, tells the difference between a harmless formatting variation and a ranking-killing mismatch, and keeps a fix-task checklist with deep links to each directory's edit page.

It's the citation-tracking core of BrightLocal (**$39+/mo**) as a tool you own forever.

![screenshot](docs/screenshot.png)

## Why NAP consistency matters

Local search engines cross-reference your business data across directories. `(217) 555-0134` vs `217-555-0134` is fine — but a wrong phone number, a missing suite number, or an old business name on Yelp genuinely erodes local rankings and loses calls. The hard part isn't fixing listings; it's *knowing which ones drifted*. That's Citewatch.

## Features

- 🏢 **Canonical NAP profile** — name, address, phone, website, hours as the single source of truth. Multiple businesses supported.
- 📋 **Structured audit workflow** — 11 seeded directories (core + industry: hospitality, medical, legal, home services) plus your own custom ones. Open the directory, paste what it currently shows, done.
- 🧠 **Smart diffing** — normalizes phone formats, case, punctuation, and USPS abbreviations (`Street`↔`St`, `Suite`↔`Ste`) so it flags only *real* problems: `match` / `formatting only` / `incomplete` / `mismatch`.
- ✅ **Auto fix-tasks** — a genuine mismatch files "Fix listing on Yelp" with the exact wrong values and a deep link to the edit page; re-audit clean and the task closes itself.
- ⏰ **Recheck reminders** — per-listing recheck interval (default 30 days); overdue audits are flagged.
- 🔄 **Optional BYO-key Google Places auto-pull** — set `GOOGLE_PLACES_API_KEY` and pull your Google Business Profile listing automatically. Every other directory is a deliberate manual audit — no scraping, no ToS fragility, no breakage when a directory redesigns.
- 📊 **Diff report** — canonical vs every directory in one view with summary counts.

Honest scope note: MVP tracks the citations you audit — it does not crawl directories for you (nothing reliable does without expensive data deals; that's what you'd be renting from BrightLocal). Pairs naturally with **Serpdeck** (our rank tracker) for the rankings side of local SEO.

## Quick start

```bash
npm i
npm run build
cp .env.example .env   # set ADMIN_PASSWORD
npm start              # → http://localhost:5363
```

**Run it as a desktop app, or deploy to a $5 VPS when you need it public:**

```bash
npm run desktop        # Electron window, auto-logged-in, data in your user profile
# or
docker compose up -d   # VPS mode, SQLite persisted in a volume
```

## Citewatch vs BrightLocal

| | **Citewatch** | **BrightLocal** |
|---|---|---|
| Price | **$34 once** | $39–$59/mo ($468+/yr) |
| NAP diffing w/ formatting intelligence | ✅ | ✅ |
| Fix-task checklist + deep links | ✅ | ✅ |
| Google Business auto-pull | ✅ (BYO key, ~free at this volume) | ✅ |
| Automated directory crawling | ❌ manual audit workflow | ✅ |
| Rank tracking | via Serpdeck (one-time too) | ✅ |
| Your data | your SQLite file | their cloud |
| Self-hosted | ✅ | ❌ |

*If you manage 50 clients, buy BrightLocal. If you manage your own business (or a handful of clients) and are paying $468/yr to be reminded your Yelp listing has the wrong suite number — Citewatch pays for itself in 27 days.*

## ☕ Skip the setup — get the 1-click installer

Grab the packaged Windows installer on Whop: **https://whop.com/benjisaiempire/citewatch

## Tech stack

Node 20 + Express + better-sqlite3 · React 18 + Vite + Tailwind 4 + Framer Motion + Lucide · optional Google Places API (New, BYO key) · Electron desktop wrapper · Docker

## Tests

```bash
npm test   # boots the real server; Places lookups hit a local fixture — zero live network
```

## License

MIT © 2026 Ben (bensblueprints)

## macOS build

See [MAC-BUILD.md](MAC-BUILD.md). Quickest path: GitHub **Actions** tab -> run the **Mac Build** (`mac-build.yml`) workflow to get a downloadable `.dmg` (unsigned - right-click -> Open on first launch).
