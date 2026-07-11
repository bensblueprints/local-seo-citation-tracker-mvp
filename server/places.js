// Optional BYO-key Google Places auto-pull — Google Business Profile ONLY.
// Disabled unless GOOGLE_PLACES_API_KEY is set. Every other directory stays a
// manual audit on purpose (no scraping, no ToS fragility).
//
// PLACES_API_BASE is overridable so tests can point at a local fixture server —
// the smoke test NEVER makes a live network call.

const DEFAULT_BASE = 'https://places.googleapis.com';

function placesEnabled(env = process.env) {
  return Boolean(env.GOOGLE_PLACES_API_KEY);
}

// Text-search the Places API (New) and return the top result parsed down to
// the three NAP fields we care about.
async function fetchPlaceByQuery(query, env = process.env) {
  if (!placesEnabled(env)) {
    const err = new Error('Google Places is not configured (set GOOGLE_PLACES_API_KEY)');
    err.code = 'PLACES_DISABLED';
    throw err;
  }
  const base = (env.PLACES_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
  const res = await fetch(`${base}/v1/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.id'
    },
    body: JSON.stringify({ textQuery: query })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Places API error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const place = (data.places || [])[0];
  if (!place) {
    const err = new Error('No place found for that query');
    err.code = 'PLACES_NOT_FOUND';
    throw err;
  }
  return {
    place_id: place.id || null,
    name: place.displayName?.text || '',
    address: place.formattedAddress || '',
    phone: place.nationalPhoneNumber || '',
    website: place.websiteUri || ''
  };
}

module.exports = { placesEnabled, fetchPlaceByQuery, DEFAULT_BASE };
