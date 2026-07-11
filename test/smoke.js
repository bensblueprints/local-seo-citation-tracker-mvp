// Citewatch smoke test — boots the real server against a temp DB and exercises
// the full audit pipeline: canonical NAP → directory audits → normalization
// diff (formatting vs real mismatch) → auto fix-tasks → recheck-due →
// BYO-key Places pull against a LOCAL FIXTURE server (no live network, ever).
// Kills ONLY the spawned server child.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
const TEST_PORT = 5463; // offset port — other build agents run concurrently
const PLACES_FIXTURE_PORT = 5464;
const ADMIN_PASSWORD = 'smoke-test-password';
const DB_PATH = path.join(__dirname, 'smoke.db');
const BASE = `http://127.0.0.1:${TEST_PORT}`;

for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

let serverProc = null;
let placesFixture = null;
const placesHits = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, label, tries = 40, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* retry */ }
    await sleep(delay);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Local fixture standing in for the Google Places API — returns a canned
// place whose address subtly disagrees with the canonical NAP.
function startPlacesFixture() {
  return new Promise((resolve) => {
    placesFixture = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        placesHits.push({ url: req.url, headers: req.headers, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          places: [{
            id: 'fixture-place-1',
            displayName: { text: "Joe's Pizza" },
            formattedAddress: '123 Main Street, Springfield, IL 62701', // missing Suite 4!
            nationalPhoneNumber: '(217) 555-0134',
            websiteUri: 'https://joespizza.example'
          }]
        }));
      });
    });
    placesFixture.listen(PLACES_FIXTURE_PORT, '127.0.0.1', resolve);
  });
}

async function main() {
  console.log('0. Starting local Places fixture server (mock — no live network)');
  await startPlacesFixture();

  console.log('1. Booting Citewatch on port', TEST_PORT, 'with temp DB + fixture Places base');
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      ADMIN_PASSWORD,
      DB_PATH,
      GOOGLE_PLACES_API_KEY: 'smoke-fixture-key',
      PLACES_API_BASE: `http://127.0.0.1:${PLACES_FIXTURE_PORT}`
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => process.stdout.write(`   [server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`   [server] ${d}`));

  await waitFor(async () => (await api('/api/health')).data.ok, 'server health');

  console.log('   Auth: wrong password → 401, unauthenticated → 401, login → 200');
  assert.strictEqual((await api('/api/login', { method: 'POST', body: { password: 'nope' } })).status, 401);
  cookie = '';
  assert.strictEqual((await api('/api/businesses')).status, 401, 'admin API must require auth');
  assert.strictEqual((await api('/api/login', { method: 'POST', body: { password: ADMIN_PASSWORD } })).status, 200);

  console.log('2. Seeded directories present');
  const dirs = (await api('/api/directories')).data;
  assert.ok(dirs.length >= 11, 'must seed at least 11 directories');
  const names = dirs.map((d) => d.name);
  for (const expect of ['Google Business Profile', 'Yelp', 'Facebook', 'Bing Places']) {
    assert.ok(names.includes(expect), `seeded directories must include ${expect}`);
  }
  const yelp = dirs.find((d) => d.name === 'Yelp');
  const facebook = dirs.find((d) => d.name === 'Facebook');
  const bing = dirs.find((d) => d.name === 'Bing Places');

  console.log('3. Create business (canonical NAP)');
  const biz = await api('/api/businesses', {
    method: 'POST',
    body: {
      name: "Joe's Pizza",
      address: '123 Main St, Suite 4, Springfield, IL 62701',
      phone: '(217) 555-0134',
      website: 'https://joespizza.example',
      hours_json: { 'Mon-Fri': '9am-9pm' }
    }
  });
  assert.strictEqual(biz.status, 201);
  const bizId = biz.data.id;

  console.log('4. Audit Yelp: formatting-only differences → classified formatting, NO task');
  const yelpAudit = await api(`/api/businesses/${bizId}/listings/${yelp.id}`, {
    method: 'PUT',
    body: {
      current_name: "JOE'S PIZZA",                                  // case only
      current_address: '123 Main Street, Ste 4, Springfield, IL 62701', // St↔Street, Suite↔Ste
      current_phone: '+1 217-555-0134'                              // format only
    }
  });
  assert.strictEqual(yelpAudit.data.status, 'formatting', 'Yelp must classify as formatting-only');
  assert.strictEqual(yelpAudit.data.diff.fields.name.status, 'formatting');
  assert.strictEqual(yelpAudit.data.diff.fields.address.status, 'formatting');
  assert.strictEqual(yelpAudit.data.diff.fields.phone.status, 'formatting');

  console.log('5. Audit Facebook: wrong phone + missing suite → mismatch + auto fix-task w/ deep link');
  const fbAudit = await api(`/api/businesses/${bizId}/listings/${facebook.id}`, {
    method: 'PUT',
    body: {
      current_name: "Joe's Pizza",
      current_address: '123 Main St, Springfield, IL 62701',  // suite number missing
      current_phone: '(217) 555-9999'                          // WRONG number
    }
  });
  assert.strictEqual(fbAudit.data.status, 'mismatch', 'Facebook must classify as mismatch');
  assert.strictEqual(fbAudit.data.diff.fields.phone.status, 'mismatch');
  assert.strictEqual(fbAudit.data.diff.fields.address.status, 'mismatch');
  assert.strictEqual(fbAudit.data.diff.fields.name.status, 'match');

  let tasks = (await api(`/api/businesses/${bizId}/tasks`)).data;
  const openTasks = tasks.filter((t) => t.status === 'open');
  assert.strictEqual(openTasks.length, 1, 'exactly one open fix task (Yelp formatting must NOT create one)');
  assert.strictEqual(openTasks[0].title, 'Fix listing on Facebook');
  assert.ok(openTasks[0].detail.includes('555-9999'), 'task detail must cite the bad phone');
  assert.ok(openTasks[0].deep_link.length > 0, 'task must carry a deep link');

  console.log('6. Fix the listing → re-audit → task auto-completes');
  await api(`/api/businesses/${bizId}/listings/${facebook.id}`, {
    method: 'PUT',
    body: {
      current_name: "Joe's Pizza",
      current_address: '123 Main St, Suite 4, Springfield, IL 62701',
      current_phone: '(217) 555-0134'
    }
  });
  tasks = (await api(`/api/businesses/${bizId}/tasks`)).data;
  assert.strictEqual(tasks.filter((t) => t.status === 'open').length, 0, 'task must auto-complete after fix');
  assert.strictEqual(tasks.filter((t) => t.status === 'done').length, 1);

  console.log('7. Recheck-due: backfilled 90-day-old audit is flagged due (interval 30d)');
  await api(`/api/businesses/${bizId}/listings/${bing.id}`, {
    method: 'PUT',
    body: {
      current_name: "Joe's Pizza",
      current_address: '123 Main St, Suite 4, Springfield, IL 62701',
      current_phone: '(217) 555-0134',
      recheck_interval_days: 30,
      last_checked_at: Date.now() - 90 * 24 * 3600 * 1000
    }
  });
  const listings = (await api(`/api/businesses/${bizId}/listings`)).data;
  const bingRow = listings.find((l) => l.directory_id === bing.id);
  assert.strictEqual(bingRow.recheck_due, true, '90-day-old audit must be recheck-due');
  const yelpRow = listings.find((l) => l.directory_id === yelp.id);
  assert.strictEqual(yelpRow.recheck_due, false, 'fresh audit must not be due');
  const unchecked = listings.filter((l) => l.status === 'unchecked');
  assert.ok(unchecked.length >= 8, 'unaudited directories must appear as unchecked rows');
  assert.ok(unchecked.every((l) => l.recheck_due === true), 'never-audited directories are always due');

  console.log('8. Diff report summary math');
  const diff = (await api(`/api/businesses/${bizId}/diff`)).data;
  assert.strictEqual(diff.summary.checked, 3);
  assert.strictEqual(diff.summary.match, 2, 'Facebook (fixed) + Bing are exact matches');
  assert.strictEqual(diff.summary.formatting, 1, 'Yelp is formatting-only');
  assert.strictEqual(diff.summary.mismatch, 0);
  assert.strictEqual(diff.summary.recheck_due, 1);

  console.log('9. Places pull hits the FIXTURE server only, upserts the GBP listing, files a task');
  const pull = await api(`/api/businesses/${bizId}/places-pull`, { method: 'POST', body: {} });
  assert.strictEqual(pull.status, 200, `places pull must succeed: ${JSON.stringify(pull.data)}`);
  assert.strictEqual(placesHits.length, 1, 'exactly one request must hit the local fixture');
  assert.strictEqual(placesHits[0].headers['x-goog-api-key'], 'smoke-fixture-key', 'BYO key must be forwarded');
  assert.ok(placesHits[0].url.includes('/v1/places:searchText'));
  assert.strictEqual(pull.data.place.name, "Joe's Pizza");
  // fixture address is missing "Suite 4" → genuine mismatch → task filed
  assert.strictEqual(pull.data.listing.status, 'mismatch');
  tasks = (await api(`/api/businesses/${bizId}/tasks`)).data;
  const gbpTask = tasks.find((t) => t.status === 'open' && t.title === 'Fix listing on Google Business Profile');
  assert.ok(gbpTask, 'GBP mismatch from Places pull must file a fix task');

  console.log('10. Rows persisted in SQLite');
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM listings').get().n, 4);
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM tasks").get().n, 2);
  assert.strictEqual(db.prepare("SELECT status FROM listings WHERE directory_id = ?").get(yelp.id).status, 'formatting');
  db.close();

  console.log('\n✅ All Citewatch smoke tests passed (Places lookups fixture-only — zero live network)');
}

async function cleanup(code) {
  if (serverProc && !serverProc.killed) serverProc.kill(); // ONLY the spawned child
  if (placesFixture) {
    await new Promise((r) => { placesFixture.close(r); placesFixture.closeAllConnections?.(); });
  }
  await sleep(300);
  for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* windows lock */ }
  }
  process.exit(code);
}

main()
  .then(() => cleanup(0))
  .catch(async (err) => {
    console.error('\n❌ Smoke test failed:', err.message);
    await cleanup(1);
  });
