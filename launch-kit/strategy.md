# Launch strategy — Citewatch

## Target communities

- **r/localseo** — the bullseye. Rules allow tools if disclosed; post a genuinely useful "2026 NAP audit checklist" with Citewatch as the disclosed tool that automates the diffing. This sub hates fluff and loves the "manual audit on purpose, no scraping" honesty.
- **r/SEO** — monthly tool threads only; otherwise answer citation-consistency questions on merit and keep the tool in profile.
- **r/juststart / r/sweatystartup** — case-study angle: "the $0 local SEO task that beats most paid link building" with the tool mentioned once.
- **r/smallbusiness** — no self-promo; educational comments on "why is my Google ranking dropping" threads, link only when asked.
- **Local SEO Facebook groups (Local Search Forum crowd)** — practitioners who resell BrightLocal to clients; pitch as white-label-able one-time cost per client.

## Show HN draft

**Title:** Show HN: Citewatch – self-hosted NAP citation tracker (BrightLocal is $39/mo)

Local search engines cross-reference your business's name/address/phone across directories; inconsistencies genuinely hurt rankings. The incumbent tools rent you two things: directory data access, and a diff. The data access is why they're expensive — but for a single business it's overkill; you can audit your 10 directories in 20 minutes if something tracks the drift.

Citewatch is that tracker, self-hosted (Node/Express/SQLite/React). The interesting bit is the diff classifier: it normalizes phone formats, case, punctuation, USPS abbreviations (Street↔St, Suite↔Ste) and directionals before comparing, so "(217) 555-0134" vs "+1 217-555-0134" classifies as formatting-only while a missing suite number classifies as a real mismatch and auto-files a fix task with a deep link to the directory's edit page. Re-audit clean and the task closes itself.

One directory has automation: Google Business Profile via your own Places API key. Everything else is deliberately manual — directory scrapers break monthly and violate ToS, and I didn't want to ship fragility. The smoke test runs the Places integration against a local fixture server, zero live calls. MIT licensed.

## SEO keywords

1. brightlocal alternative
2. local seo citation tool
3. nap consistency checker
4. google business profile audit tool
5. citation tracker self hosted
6. local citation audit checklist
7. whitespark alternative
8. yelp listing wrong phone number fix
9. local seo tools one time purchase
10. nap audit tool small business

## AppSumo / PitchGround pitch

Citewatch gives agencies and local businesses the citation-consistency engine BrightLocal rents for $468+/yr — as a one-time purchase they own. Canonical NAP source of truth, structured audits across 11 seeded + unlimited custom directories, a genuinely smart diff that ignores formatting noise but catches ranking-killers, self-closing fix tasks with edit-page deep links, and BYO-key Google Business auto-pull. Self-hosted (Docker or desktop app), SQLite, MIT source. For an LTD audience that already resells local SEO to clients, a $49–69 tier with the installer and updates is an easy margin story — each client seat replaces a recurring BrightLocal line item.

## Pricing math

**$34 one-time.** BrightLocal starts at $39/mo → pays for itself in **27 days**. Whitespark's citation tracking: $33+/mo → one month. For an agency with 5 client businesses on BrightLocal Single Business plans, Citewatch replaces ~$2,340/yr.
