require('dotenv').config();
const path = require('path');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5363;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'citewatch.db');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

const app = createApp({ dbPath: DB_PATH, adminPassword: ADMIN_PASSWORD });

app.listen(PORT, () => {
  console.log(`Citewatch listening on http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === 'admin') {
    console.log('⚠ Using default admin password — set ADMIN_PASSWORD in .env for production.');
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.log('ℹ Google Places auto-pull disabled (optional — set GOOGLE_PLACES_API_KEY to enable).');
  }
});
