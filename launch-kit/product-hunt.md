# Product Hunt — Citewatch

**Name:** Citewatch

**Tagline (60 chars):** Track your NAP across every directory. $34 once, not $39/mo.

**Description (260 chars):**
Citewatch is a self-hosted local-SEO citation tracker. Set your canonical name/address/phone, audit what Google, Yelp, Facebook & co. actually show, and get smart diffs that ignore formatting but catch real mismatches. Fix-tasks with deep links. Pay once.

**Full description:**
Local rankings live and die by NAP consistency — the same name, address and phone everywhere. BrightLocal charges $39–59/month to watch this for you.

Citewatch is the citation-tracking core as a product you own:

- Set your canonical NAP once (multiple businesses supported).
- Work through a structured audit checklist: 11 seeded directories + your own. Paste what each directory currently shows.
- Smart diffing normalizes phone formats, case, and USPS abbreviations — "(217) 555-0134" vs "217-555-0134" is fine; a missing suite number is flagged. Classifications: match / formatting-only / incomplete / mismatch.
- Real mismatches automatically file a fix task with the exact wrong values and a deep link to the directory's edit page. Fix it, re-audit, the task closes itself.
- Per-listing recheck reminders (default 30 days).
- Optional BYO-key Google Places pull auto-audits your Google Business Profile.

Honest scope: it doesn't crawl directories (that's the part you rent from BrightLocal at $500/yr) — it makes the audit you should be doing quarterly take 20 minutes instead of an afternoon, and never lets a drift go unnoticed. Self-hosted: Node + SQLite, desktop app or Docker on a $5 VPS. MIT source.

**Maker first comment:**
Hi PH 👋 I do local SEO for small businesses. The dirty secret of citation tools: the expensive part is directory data access, but the *value* is just "your Yelp listing has the wrong phone number, here's the edit link." I got tired of clients paying $500/yr for that sentence.

Citewatch is my answer: a disciplined audit workflow with genuinely smart diffing (it knows Street↔St and Suite↔Ste are the same thing) and self-closing fix tasks. The one auto-pull is Google Business via your own Places API key, because that's the one directory with a sane API. Everything else is manual on purpose — scrapers break monthly and violate ToS. MIT source on GitHub; the paid product is the packaged installer. Ask me anything about NAP weirdness — I've seen suite numbers kill map-pack rankings.

**Gallery shots (5):**
1. Business dashboard — cards with match/mismatch/open-task counts.
2. Audit checklist — directory rows with status pills (match, formatting only, mismatch) and recheck-due flags.
3. The diff view — canonical vs listed values, mismatched phone highlighted in red.
4. Fix-task panel — "Fix listing on Facebook: phone listed (217) 555-9999 should be (217) 555-0134" with edit-page deep link.
5. Audit modal showing side-by-side canonical hints while pasting listed values.
