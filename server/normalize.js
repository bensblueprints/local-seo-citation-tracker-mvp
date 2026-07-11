// NAP normalization + diff classification.
// The whole point of Citewatch: "(217) 555-0134" vs "217-555-0134" is NOT a
// citation problem, but "123 Main St" vs "456 Oak Ave" is. We normalize
// phone formats, whitespace, case, punctuation and common street/unit
// abbreviations before comparing, then classify each field as:
//   match       — byte-identical (after trim)
//   formatting  — same data, different formatting (safe to ignore)
//   mismatch    — genuinely different data (hurts local rankings — fix it)
//   missing     — directory listing has no value entered yet

const ABBREVIATIONS = {
  // street types (USPS-style)
  street: 'st', avenue: 'ave', boulevard: 'blvd', drive: 'dr', road: 'rd',
  lane: 'ln', court: 'ct', place: 'pl', square: 'sq', terrace: 'ter',
  highway: 'hwy', parkway: 'pkwy', circle: 'cir', trail: 'trl',
  // unit designators
  suite: 'ste', apartment: 'apt', building: 'bldg', floor: 'fl',
  department: 'dept', room: 'rm', number: 'no',
  // directionals
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw'
};

function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  // drop US country code so "+1 (217) 555-0134" == "217-555-0134"
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits;
}

function normalizeName(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddress(raw) {
  const cleaned = String(raw || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split(' ')
    .map((tok) => ABBREVIATIONS[tok] || tok)
    .join(' ');
}

const NORMALIZERS = {
  name: normalizeName,
  address: normalizeAddress,
  phone: normalizePhone
};

// → 'match' | 'formatting' | 'mismatch' | 'missing'
function compareField(canonical, current, type) {
  const can = String(canonical || '').trim();
  const cur = String(current || '').trim();
  if (!cur) return 'missing';
  if (can === cur) return 'match';
  const norm = NORMALIZERS[type] || normalizeName;
  return norm(can) === norm(cur) ? 'formatting' : 'mismatch';
}

// Compares a business's canonical NAP against one directory listing.
// Returns per-field classification + an overall status:
//   any mismatch → 'mismatch'; else any missing → 'incomplete';
//   else any formatting → 'formatting'; else 'match'.
function diffListing(business, listing) {
  const fields = {
    name: {
      canonical: business.name || '',
      current: listing.current_name || '',
      status: compareField(business.name, listing.current_name, 'name')
    },
    address: {
      canonical: business.address || '',
      current: listing.current_address || '',
      status: compareField(business.address, listing.current_address, 'address')
    },
    phone: {
      canonical: business.phone || '',
      current: listing.current_phone || '',
      status: compareField(business.phone, listing.current_phone, 'phone')
    }
  };
  const statuses = Object.values(fields).map((f) => f.status);
  let overall = 'match';
  if (statuses.includes('mismatch')) overall = 'mismatch';
  else if (statuses.includes('missing')) overall = 'incomplete';
  else if (statuses.includes('formatting')) overall = 'formatting';
  return { fields, overall };
}

module.exports = { normalizePhone, normalizeName, normalizeAddress, compareField, diffListing };
