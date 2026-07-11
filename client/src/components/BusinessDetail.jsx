import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Pencil, ExternalLink, ClipboardList, RefreshCw, Clock,
  CheckCircle2, AlertTriangle, X, Check, Download, Plus, Trash2
} from 'lucide-react';
import { api, timeAgo } from '../api.js';
import StatusPill from './StatusPill.jsx';

const field = 'w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500';

function FieldDiff({ label, f }) {
  const color = {
    match: 'text-emerald-400',
    formatting: 'text-sky-400',
    mismatch: 'text-rose-400',
    missing: 'text-amber-400'
  }[f.status];
  return (
    <div className="text-xs">
      <span className="text-zinc-500 uppercase tracking-wide">{label}</span>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className={color}>{f.current || '—'}</span>
        {f.status !== 'match' && f.status !== 'formatting' && f.canonical && (
          <span className="text-zinc-500">should be <span className="text-zinc-300">{f.canonical}</span></span>
        )}
        {f.status === 'formatting' && <span className="text-zinc-600">(formatting only — same data)</span>}
      </div>
    </div>
  );
}

function AuditModal({ listing, business, onClose, onSaved }) {
  const [form, setForm] = useState({
    current_name: listing.current_name || '',
    current_address: listing.current_address || '',
    current_phone: listing.current_phone || '',
    listing_url: listing.listing_url || '',
    notes: listing.notes || '',
    recheck_interval_days: listing.recheck_interval_days || 30
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.saveListing(business.id, listing.directory_id, form);
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.form initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        onSubmit={save}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Audit — {listing.directory_name}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-zinc-500">
          Open the directory, copy what it <b>currently shows</b> for your business, paste it here.
          Citewatch diffs it against your canonical NAP and files a fix task if something's genuinely wrong.
        </p>
        {[
          ['current_name', `Name as listed (canonical: ${business.name})`],
          ['current_address', `Address as listed${business.address ? ` (canonical: ${business.address})` : ''}`],
          ['current_phone', `Phone as listed${business.phone ? ` (canonical: ${business.phone})` : ''}`],
          ['listing_url', 'Listing URL (your public page on this directory)']
        ].map(([k, label]) => (
          <label key={k} className="block space-y-1">
            <span className="text-sm text-zinc-400">{label}</span>
            <input className={field} value={form[k]} onChange={set(k)} />
          </label>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Recheck every (days)</span>
            <input className={field} type="number" min="1" value={form.recheck_interval_days} onChange={set('recheck_interval_days')} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Notes</span>
            <input className={field} value={form.notes} onChange={set('notes')} placeholder="claimed via support email…" />
          </label>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">Cancel</button>
          <button className="text-sm bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium px-4 py-1.5 rounded-lg transition-colors">
            Save audit
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default function BusinessDetail({ id, onBack, onEdit }) {
  const [business, setBusiness] = useState(null);
  const [listings, setListings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [places, setPlaces] = useState({ enabled: false });
  const [audit, setAudit] = useState(null); // listing row being audited
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState('');
  const [dirForm, setDirForm] = useState(null); // { name, edit_url_template }

  const load = useCallback(async () => {
    try {
      const [b, l, t] = await Promise.all([api.business(id), api.listings(id), api.tasks(id)]);
      setBusiness(b); setListings(l); setTasks(t);
    } catch (e) { setError(e.message); }
  }, [id]);

  useEffect(() => { load(); api.placesStatus().then(setPlaces).catch(() => {}); }, [load]);

  if (!business) return <p className="text-zinc-500 text-sm">{error || 'Loading…'}</p>;

  const checked = listings.filter((l) => l.last_checked_at);
  const summary = {
    mismatch: checked.filter((l) => l.status === 'mismatch').length,
    match: checked.filter((l) => l.status === 'match').length,
    due: listings.filter((l) => l.recheck_due).length
  };
  const openTasks = tasks.filter((t) => t.status === 'open');

  const pull = async () => {
    setPulling(true); setError('');
    try { await api.placesPull(id); await load(); }
    catch (e) { setError(`Places pull failed: ${e.message}`); }
    finally { setPulling(false); }
  };

  const addDirectory = async (e) => {
    e.preventDefault();
    try {
      await api.createDirectory(dirForm);
      setDirForm(null); load();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 mt-0.5"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{business.name}</h1>
            <button onClick={() => onEdit(business)} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"><Pencil className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            {[business.address, business.phone, business.website].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> {summary.match} clean</span>
            <span className={`flex items-center gap-1 ${summary.mismatch ? 'text-rose-400' : 'text-zinc-500'}`}><AlertTriangle className="w-3.5 h-3.5" /> {summary.mismatch} mismatched</span>
            <span className={`flex items-center gap-1 ${summary.due ? 'text-amber-400' : 'text-zinc-500'}`}><Clock className="w-3.5 h-3.5" /> {summary.due} recheck due</span>
          </div>
        </div>
        {places.enabled && (
          <button onClick={pull} disabled={pulling}
            className="flex items-center gap-1.5 text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            <Download className={`w-4 h-4 ${pulling ? 'animate-pulse' : ''}`} /> Pull from Google
          </button>
        )}
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}

      {openTasks.length > 0 && (
        <section className="bg-zinc-900/60 border border-amber-500/20 rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium text-amber-400 mb-3">
            <ClipboardList className="w-4 h-4" /> Fix tasks ({openTasks.length})
          </h2>
          <div className="space-y-2">
            {openTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 text-sm">
                <button onClick={async () => { await api.toggleTask(t.id); load(); }}
                  className="mt-0.5 w-4 h-4 rounded border border-zinc-600 hover:border-emerald-400 grid place-items-center shrink-0"
                  title="Mark done" />
                <div className="flex-1">
                  <span className="font-medium">{t.title}</span>
                  {t.detail && <p className="text-xs text-zinc-500 mt-0.5">{t.detail}</p>}
                </div>
                {t.deep_link && (
                  <a href={t.deep_link} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 shrink-0">
                    open <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-300">Directory audit checklist</h2>
          <button onClick={() => setDirForm({ name: '', edit_url_template: '' })}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
            <Plus className="w-3.5 h-3.5" /> add directory
          </button>
        </div>
        {dirForm && (
          <form onSubmit={addDirectory} className="mb-3 flex gap-2">
            <input className={field} placeholder="Directory name (e.g. Angi)" value={dirForm.name}
              onChange={(e) => setDirForm({ ...dirForm, name: e.target.value })} required />
            <input className={field} placeholder="Edit page URL (optional)" value={dirForm.edit_url_template}
              onChange={(e) => setDirForm({ ...dirForm, edit_url_template: e.target.value })} />
            <button className="text-sm bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium px-4 rounded-lg shrink-0"><Check className="w-4 h-4" /></button>
            <button type="button" onClick={() => setDirForm(null)} className="text-sm px-2 text-zinc-500 shrink-0"><X className="w-4 h-4" /></button>
          </form>
        )}
        <div className="space-y-2">
          {listings.map((l) => (
            <div key={l.directory_id}
              className={`bg-zinc-900/60 border rounded-xl p-4 ${l.status === 'mismatch' ? 'border-rose-500/30' : 'border-zinc-800'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium text-sm">{l.directory_name}</span>
                <StatusPill status={l.status} />
                {l.recheck_due && l.last_checked_at && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-400"><Clock className="w-3 h-3" /> recheck due</span>
                )}
                <span className="text-xs text-zinc-600">checked {timeAgo(l.last_checked_at)}</span>
                <div className="flex-1" />
                {l.edit_url && (
                  <a href={l.edit_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-sky-400">
                    edit page <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button onClick={() => setAudit(l)}
                  className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-lg transition-colors">
                  <RefreshCw className="w-3 h-3" /> {l.last_checked_at ? 'Re-audit' : 'Audit'}
                </button>
              </div>
              {l.diff && (
                <div className="mt-3 grid sm:grid-cols-3 gap-3 border-t border-zinc-800/70 pt-3">
                  <FieldDiff label="Name" f={l.diff.fields.name} />
                  <FieldDiff label="Address" f={l.diff.fields.address} />
                  <FieldDiff label="Phone" f={l.diff.fields.phone} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {tasks.some((t) => t.status === 'done') && (
        <section>
          <h2 className="text-sm font-medium text-zinc-500 mb-2">Completed tasks</h2>
          <div className="space-y-1">
            {tasks.filter((t) => t.status === 'done').map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs text-zinc-600">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60" />
                <span className="line-through">{t.title}</span>
                <span>· {timeAgo(t.completed_at)}</span>
                <button onClick={async () => { await api.toggleTask(t.id); load(); }} className="text-zinc-500 hover:text-zinc-300">reopen</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {audit && (
          <AuditModal listing={audit} business={business} onClose={() => setAudit(null)}
            onSaved={() => { setAudit(null); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}
