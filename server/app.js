const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const { openDb } = require('./db');
const { diffListing } = require('./normalize');
const { placesEnabled, fetchPlaceByQuery } = require('./places');

const SESSION_COOKIE = 'cw_session';
const DAY_MS = 24 * 60 * 60 * 1000;

function createApp({ dbPath, adminPassword, autologinToken = null, env = process.env } = {}) {
  const db = openDb(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(cookieParser());
  app.use(express.json({ limit: '256kb' }));

  app.locals.db = db;

  const findBusiness = db.prepare('SELECT * FROM businesses WHERE id = ?');
  const findDirectory = db.prepare('SELECT * FROM directories WHERE id = ?');
  const findListing = db.prepare('SELECT * FROM listings WHERE business_id = ? AND directory_id = ?');
  const findListingById = db.prepare('SELECT * FROM listings WHERE id = ?');

  // ── auth ───────────────────────────────────────────────────────────────────
  function requireAuth(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    if (token && db.prepare('SELECT id FROM sessions WHERE token = ?').get(token)) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  function createSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, Date.now());
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  }

  app.get('/api/health', (req, res) => res.json({ ok: true, app: 'citewatch' }));

  app.post('/api/login', (req, res) => {
    if ((req.body || {}).password !== adminPassword) return res.status(401).json({ error: 'wrong password' });
    createSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });

  // Desktop mode auto-login (Electron passes a one-shot token).
  app.get('/auth/auto', (req, res) => {
    if (autologinToken && req.query.token === autologinToken) createSession(res);
    res.redirect('/');
  });

  app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

  // ── helpers ────────────────────────────────────────────────────────────────
  function deepLink(directory, business) {
    let url = directory.edit_url_template || '';
    const subs = {
      '{name}': business?.name || '',
      '{phone}': business?.phone || '',
      '{website}': business?.website || ''
    };
    for (const [k, v] of Object.entries(subs)) url = url.split(k).join(encodeURIComponent(v));
    return url;
  }

  function recheckDue(listing, now = Date.now()) {
    if (!listing.last_checked_at) return true; // never audited → due
    return listing.last_checked_at + listing.recheck_interval_days * DAY_MS <= now;
  }

  function serializeListing(listing, business, directory) {
    const diff = listing.last_checked_at ? diffListing(business, listing) : null;
    return {
      ...listing,
      directory_name: directory.name,
      directory_category: directory.category,
      edit_url: deepLink(directory, business),
      recheck_due: recheckDue(listing),
      diff
    };
  }

  // Auto-manage the fix task for a listing after every (re)check:
  //  - real mismatch → ensure ONE open "Fix listing on X" task with a deep link
  //  - anything else → auto-complete any open task for that listing
  function syncTask(business, directory, listing, diff) {
    const now = Date.now();
    const open = db
      .prepare("SELECT * FROM tasks WHERE listing_id = ? AND status = 'open'")
      .get(listing.id);
    if (diff.overall === 'mismatch') {
      const bad = Object.entries(diff.fields)
        .filter(([, f]) => f.status === 'mismatch' || f.status === 'missing')
        .map(([k, f]) => `${k}: listed "${f.current || '—'}" should be "${f.canonical}"`)
        .join('; ');
      if (open) {
        db.prepare('UPDATE tasks SET detail = ?, deep_link = ? WHERE id = ?')
          .run(bad, deepLink(directory, business), open.id);
      } else {
        db.prepare(`
          INSERT INTO tasks (business_id, directory_id, listing_id, title, detail, deep_link, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
        `).run(business.id, directory.id, listing.id, `Fix listing on ${directory.name}`, bad, deepLink(directory, business), now);
      }
    } else if (open) {
      db.prepare("UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?").run(now, open.id);
    }
  }

  // ── businesses CRUD ────────────────────────────────────────────────────────
  function validateBusiness(body, res) {
    const name = String(body.name || '').trim();
    if (!name) { res.status(400).json({ error: 'name is required' }); return null; }
    let hours_json = '{}';
    if (body.hours_json != null) {
      try {
        hours_json = typeof body.hours_json === 'string' ? body.hours_json : JSON.stringify(body.hours_json);
        JSON.parse(hours_json);
      } catch {
        res.status(400).json({ error: 'hours_json must be valid JSON' }); return null;
      }
    }
    return {
      name,
      address: String(body.address || '').trim(),
      phone: String(body.phone || '').trim(),
      website: String(body.website || '').trim(),
      hours_json
    };
  }

  app.get('/api/businesses', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM businesses ORDER BY created_at DESC').all();
    const stats = db.prepare(`
      SELECT business_id,
             COUNT(*) AS listings_total,
             SUM(CASE WHEN status = 'mismatch' THEN 1 ELSE 0 END) AS mismatches,
             SUM(CASE WHEN status = 'match' THEN 1 ELSE 0 END) AS matches
      FROM listings WHERE last_checked_at IS NOT NULL GROUP BY business_id
    `).all();
    const openTasks = db.prepare(
      "SELECT business_id, COUNT(*) AS n FROM tasks WHERE status = 'open' GROUP BY business_id"
    ).all();
    const statMap = Object.fromEntries(stats.map((s) => [s.business_id, s]));
    const taskMap = Object.fromEntries(openTasks.map((t) => [t.business_id, t.n]));
    res.json(rows.map((b) => ({
      ...b,
      listings_checked: statMap[b.id]?.listings_total || 0,
      mismatches: statMap[b.id]?.mismatches || 0,
      matches: statMap[b.id]?.matches || 0,
      open_tasks: taskMap[b.id] || 0
    })));
  });

  app.post('/api/businesses', requireAuth, (req, res) => {
    const v = validateBusiness(req.body || {}, res);
    if (!v) return;
    const info = db.prepare(
      'INSERT INTO businesses (name, address, phone, website, hours_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(v.name, v.address, v.phone, v.website, v.hours_json, Date.now());
    res.status(201).json(findBusiness.get(info.lastInsertRowid));
  });

  app.get('/api/businesses/:id', requireAuth, (req, res) => {
    const b = findBusiness.get(req.params.id);
    if (!b) return res.status(404).json({ error: 'not found' });
    res.json(b);
  });

  app.put('/api/businesses/:id', requireAuth, (req, res) => {
    const b = findBusiness.get(req.params.id);
    if (!b) return res.status(404).json({ error: 'not found' });
    const v = validateBusiness({ ...b, ...(req.body || {}) }, res);
    if (!v) return;
    db.prepare('UPDATE businesses SET name = ?, address = ?, phone = ?, website = ?, hours_json = ? WHERE id = ?')
      .run(v.name, v.address, v.phone, v.website, v.hours_json, b.id);
    // canonical changed → re-classify every checked listing + resync tasks
    const updated = findBusiness.get(b.id);
    for (const listing of db.prepare('SELECT * FROM listings WHERE business_id = ? AND last_checked_at IS NOT NULL').all(b.id)) {
      const diff = diffListing(updated, listing);
      db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(diff.overall, listing.id);
      syncTask(updated, findDirectory.get(listing.directory_id), listing, diff);
    }
    res.json(updated);
  });

  app.delete('/api/businesses/:id', requireAuth, (req, res) => {
    const b = findBusiness.get(req.params.id);
    if (!b) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM tasks WHERE business_id = ?').run(b.id);
    db.prepare('DELETE FROM listings WHERE business_id = ?').run(b.id);
    db.prepare('DELETE FROM businesses WHERE id = ?').run(b.id);
    res.json({ ok: true });
  });

  // ── directories ────────────────────────────────────────────────────────────
  app.get('/api/directories', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM directories ORDER BY is_seeded DESC, id ASC').all());
  });

  app.post('/api/directories', requireAuth, (req, res) => {
    const name = String((req.body || {}).name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
      const info = db.prepare(
        "INSERT INTO directories (name, edit_url_template, category, is_seeded) VALUES (?, ?, ?, 0)"
      ).run(name, String(req.body.edit_url_template || '').trim(), String(req.body.category || 'custom').trim());
      res.status(201).json(findDirectory.get(info.lastInsertRowid));
    } catch {
      res.status(409).json({ error: 'a directory with that name already exists' });
    }
  });

  app.put('/api/directories/:id', requireAuth, (req, res) => {
    const d = findDirectory.get(req.params.id);
    if (!d) return res.status(404).json({ error: 'not found' });
    const name = String((req.body || {}).name ?? d.name).trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    db.prepare('UPDATE directories SET name = ?, edit_url_template = ?, category = ? WHERE id = ?')
      .run(name, String(req.body.edit_url_template ?? d.edit_url_template).trim(),
           String(req.body.category ?? d.category).trim(), d.id);
    res.json(findDirectory.get(d.id));
  });

  app.delete('/api/directories/:id', requireAuth, (req, res) => {
    const d = findDirectory.get(req.params.id);
    if (!d) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM tasks WHERE directory_id = ?').run(d.id);
    db.prepare('DELETE FROM listings WHERE directory_id = ?').run(d.id);
    db.prepare('DELETE FROM directories WHERE id = ?').run(d.id);
    res.json({ ok: true });
  });

  // ── listings (the audit workflow) ──────────────────────────────────────────
  // Returns one row per directory (existing listing data merged in), each with
  // diff classification + recheck_due — the full audit checklist in one call.
  app.get('/api/businesses/:id/listings', requireAuth, (req, res) => {
    const business = findBusiness.get(req.params.id);
    if (!business) return res.status(404).json({ error: 'not found' });
    const directories = db.prepare('SELECT * FROM directories ORDER BY is_seeded DESC, id ASC').all();
    const rows = directories.map((dir) => {
      const listing = findListing.get(business.id, dir.id);
      if (listing) return serializeListing(listing, business, dir);
      return {
        id: null,
        business_id: business.id,
        directory_id: dir.id,
        directory_name: dir.name,
        directory_category: dir.category,
        current_name: '', current_address: '', current_phone: '',
        listing_url: '', notes: '',
        last_checked_at: null,
        recheck_interval_days: 30,
        status: 'unchecked',
        edit_url: deepLink(dir, business),
        recheck_due: true,
        diff: null
      };
    });
    res.json(rows);
  });

  // Upsert what a directory currently shows (a manual audit entry).
  // Sets last_checked_at, classifies the diff, and auto-syncs the fix task.
  app.put('/api/businesses/:id/listings/:directoryId', requireAuth, (req, res) => {
    const business = findBusiness.get(req.params.id);
    if (!business) return res.status(404).json({ error: 'business not found' });
    const directory = findDirectory.get(req.params.directoryId);
    if (!directory) return res.status(404).json({ error: 'directory not found' });

    const body = req.body || {};
    const now = Date.now();
    // last_checked_at override supported for backfilling old audits/imports
    const checkedAt = Number.isFinite(Number(body.last_checked_at)) && body.last_checked_at != null
      ? Number(body.last_checked_at) : now;
    let interval = Math.floor(Number(body.recheck_interval_days));
    if (!Number.isFinite(interval) || interval < 1) interval = null;

    let listing = findListing.get(business.id, directory.id);
    if (listing) {
      db.prepare(`
        UPDATE listings SET current_name = ?, current_address = ?, current_phone = ?,
          listing_url = ?, notes = ?, last_checked_at = ?, recheck_interval_days = ?
        WHERE id = ?
      `).run(
        String(body.current_name ?? listing.current_name).trim(),
        String(body.current_address ?? listing.current_address).trim(),
        String(body.current_phone ?? listing.current_phone).trim(),
        String(body.listing_url ?? listing.listing_url).trim(),
        String(body.notes ?? listing.notes).trim(),
        checkedAt, interval ?? listing.recheck_interval_days, listing.id
      );
    } else {
      db.prepare(`
        INSERT INTO listings (business_id, directory_id, current_name, current_address, current_phone,
          listing_url, notes, last_checked_at, recheck_interval_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        business.id, directory.id,
        String(body.current_name || '').trim(),
        String(body.current_address || '').trim(),
        String(body.current_phone || '').trim(),
        String(body.listing_url || '').trim(),
        String(body.notes || '').trim(),
        checkedAt, interval ?? 30
      );
    }
    listing = findListing.get(business.id, directory.id);
    const diff = diffListing(business, listing);
    db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(diff.overall, listing.id);
    listing = findListingById.get(listing.id);
    syncTask(business, directory, listing, diff);
    res.json(serializeListing(listing, business, directory));
  });

  // Full diff report: canonical vs every checked directory entry.
  app.get('/api/businesses/:id/diff', requireAuth, (req, res) => {
    const business = findBusiness.get(req.params.id);
    if (!business) return res.status(404).json({ error: 'not found' });
    const listings = db.prepare(`
      SELECT l.*, d.name AS directory_name, d.edit_url_template, d.category AS directory_category
      FROM listings l JOIN directories d ON d.id = l.directory_id
      WHERE l.business_id = ? AND l.last_checked_at IS NOT NULL
      ORDER BY d.is_seeded DESC, d.id ASC
    `).all(business.id);
    const entries = listings.map((l) => ({
      listing_id: l.id,
      directory_id: l.directory_id,
      directory_name: l.directory_name,
      last_checked_at: l.last_checked_at,
      recheck_due: recheckDue(l),
      edit_url: deepLink({ edit_url_template: l.edit_url_template }, business),
      ...diffListing(business, l)
    }));
    res.json({
      business,
      entries,
      summary: {
        checked: entries.length,
        match: entries.filter((e) => e.overall === 'match').length,
        formatting: entries.filter((e) => e.overall === 'formatting').length,
        incomplete: entries.filter((e) => e.overall === 'incomplete').length,
        mismatch: entries.filter((e) => e.overall === 'mismatch').length,
        recheck_due: entries.filter((e) => e.recheck_due).length
      }
    });
  });

  // ── tasks ──────────────────────────────────────────────────────────────────
  app.get('/api/businesses/:id/tasks', requireAuth, (req, res) => {
    const business = findBusiness.get(req.params.id);
    if (!business) return res.status(404).json({ error: 'not found' });
    const rows = db.prepare(`
      SELECT t.*, d.name AS directory_name FROM tasks t
      JOIN directories d ON d.id = t.directory_id
      WHERE t.business_id = ? ORDER BY t.status ASC, t.created_at DESC
    `).all(business.id);
    res.json(rows);
  });

  app.post('/api/tasks/:id/toggle', requireAuth, (req, res) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    if (task.status === 'open') {
      db.prepare("UPDATE tasks SET status = 'done', completed_at = ? WHERE id = ?").run(Date.now(), task.id);
    } else {
      db.prepare("UPDATE tasks SET status = 'open', completed_at = NULL WHERE id = ?").run(task.id);
    }
    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
  });

  // ── optional Google Places auto-pull (Google Business Profile only) ────────
  app.get('/api/places/status', requireAuth, (req, res) => {
    res.json({ enabled: placesEnabled(env) });
  });

  app.post('/api/businesses/:id/places-pull', requireAuth, async (req, res) => {
    const business = findBusiness.get(req.params.id);
    if (!business) return res.status(404).json({ error: 'not found' });
    if (!placesEnabled(env)) {
      return res.status(400).json({ error: 'Google Places is not configured — set GOOGLE_PLACES_API_KEY in .env' });
    }
    const query = String((req.body || {}).query || `${business.name} ${business.address}`).trim();
    const gbp = db.prepare("SELECT * FROM directories WHERE name = 'Google Business Profile'").get();
    if (!gbp) return res.status(500).json({ error: 'Google Business Profile directory missing' });
    try {
      const place = await fetchPlaceByQuery(query, env);
      const now = Date.now();
      const existing = findListing.get(business.id, gbp.id);
      if (existing) {
        db.prepare(`
          UPDATE listings SET current_name = ?, current_address = ?, current_phone = ?, last_checked_at = ?
          WHERE id = ?
        `).run(place.name, place.address, place.phone, now, existing.id);
      } else {
        db.prepare(`
          INSERT INTO listings (business_id, directory_id, current_name, current_address, current_phone, last_checked_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(business.id, gbp.id, place.name, place.address, place.phone, now);
      }
      const listing = findListing.get(business.id, gbp.id);
      const diff = diffListing(business, listing);
      db.prepare('UPDATE listings SET status = ? WHERE id = ?').run(diff.overall, listing.id);
      syncTask(business, gbp, findListingById.get(listing.id), diff);
      res.json({ place, listing: serializeListing(findListingById.get(listing.id), business, gbp) });
    } catch (e) {
      const status = e.code === 'PLACES_NOT_FOUND' ? 404 : 502;
      res.status(status).json({ error: e.message });
    }
  });

  // ── static frontend ────────────────────────────────────────────────────────
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
