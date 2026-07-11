const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

// Directories seeded on first run. edit_url_template supports {name}, {phone},
// {website} placeholders (URL-encoded at deep-link time).
const SEED_DIRECTORIES = [
  { name: 'Google Business Profile', edit_url_template: 'https://business.google.com/locations', category: 'core' },
  { name: 'Yelp', edit_url_template: 'https://biz.yelp.com/', category: 'core' },
  { name: 'Facebook', edit_url_template: 'https://www.facebook.com/pages/?category=your_pages', category: 'core' },
  { name: 'Apple Maps (Business Connect)', edit_url_template: 'https://businessconnect.apple.com/', category: 'core' },
  { name: 'Bing Places', edit_url_template: 'https://www.bingplaces.com/', category: 'core' },
  { name: 'Yellow Pages', edit_url_template: 'https://accounts.yellowpages.com/login', category: 'general' },
  { name: 'Foursquare', edit_url_template: 'https://foursquare.com/venue/claim', category: 'general' },
  { name: 'TripAdvisor', edit_url_template: 'https://www.tripadvisor.com/Owners?query={name}', category: 'hospitality' },
  { name: 'Healthgrades', edit_url_template: 'https://update.healthgrades.com/', category: 'medical' },
  { name: 'Avvo', edit_url_template: 'https://www.avvo.com/claim-your-profile', category: 'legal' },
  { name: 'Houzz', edit_url_template: 'https://www.houzz.com/pro', category: 'home-services' }
];

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(dbPath, nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      hours_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS directories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      edit_url_template TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'custom',
      is_seeded INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      directory_id INTEGER NOT NULL,
      current_name TEXT NOT NULL DEFAULT '',
      current_address TEXT NOT NULL DEFAULT '',
      current_phone TEXT NOT NULL DEFAULT '',
      listing_url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      last_checked_at INTEGER,
      recheck_interval_days INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'unchecked',  -- unchecked|match|formatting|incomplete|mismatch
      UNIQUE(business_id, directory_id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER NOT NULL,
      directory_id INTEGER NOT NULL,
      listing_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      deep_link TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',       -- open|done
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_listings_business ON listings(business_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_business ON tasks(business_id, status);
  `);

  // idempotent directory seeding (won't duplicate, won't clobber user edits)
  const insert = db.prepare(
    'INSERT INTO directories (name, edit_url_template, category, is_seeded) VALUES (?, ?, ?, 1) ON CONFLICT(name) DO NOTHING'
  );
  const seedTx = db.transaction(() => {
    for (const d of SEED_DIRECTORIES) insert.run(d.name, d.edit_url_template, d.category);
  });
  seedTx();

  return db;
}

module.exports = { openDb, SEED_DIRECTORIES };
