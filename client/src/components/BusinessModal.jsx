import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500';

export default function BusinessModal({ business, onClose, onSave }) {
  const [form, setForm] = useState({
    name: business?.name || '',
    address: business?.address || '',
    phone: business?.phone || '',
    website: business?.website || '',
    hours: business ? formatHours(business.hours_json) : ''
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      onSave(
        {
          name: form.name,
          address: form.address,
          phone: form.phone,
          website: form.website,
          hours_json: JSON.stringify(parseHours(form.hours))
        },
        business
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.form
        initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        onSubmit={submit}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{business ? 'Edit business' : 'New business'}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          This is your <b>canonical NAP</b> — the exact name, address and phone every
          directory should show. Every audit is diffed against these values.
        </p>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-400">Business name *</span>
          <input className={field} value={form.name} onChange={set('name')} required autoFocus placeholder="Joe's Pizza" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-400">Address</span>
          <input className={field} value={form.address} onChange={set('address')} placeholder="123 Main St, Suite 4, Springfield, IL 62701" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Phone</span>
            <input className={field} value={form.phone} onChange={set('phone')} placeholder="(217) 555-0134" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Website</span>
            <input className={field} value={form.website} onChange={set('website')} placeholder="https://joespizza.com" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-400">Hours (one per line, e.g. "Mon: 9–5")</span>
          <textarea className={field} rows={3} value={form.hours} onChange={set('hours')} placeholder={'Mon-Fri: 9am-9pm\nSat-Sun: 11am-11pm'} />
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
            Cancel
          </button>
          <button className="text-sm bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium px-4 py-1.5 rounded-lg transition-colors">
            Save
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function parseHours(text) {
  const out = {};
  for (const line of String(text || '').split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function formatHours(json) {
  try {
    return Object.entries(JSON.parse(json || '{}'))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
  } catch {
    return '';
  }
}
