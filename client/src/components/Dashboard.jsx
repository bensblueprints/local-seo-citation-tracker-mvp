import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Phone, Globe, MapPin, Pencil, Trash2, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import { api } from '../api.js';

export default function Dashboard({ businesses, onOpen, onNew, onEdit, onDeleted }) {
  if (!businesses.length) {
    return (
      <div className="text-center py-24 space-y-4">
        <Building2 className="w-10 h-10 text-zinc-700 mx-auto" />
        <h2 className="text-lg font-medium">No businesses yet</h2>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          Add your business with its canonical name, address and phone — the single
          source of truth you'll audit every directory against.
        </p>
        <button
          onClick={onNew}
          className="text-sm bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Add your business
        </button>
      </div>
    );
  }

  const remove = async (e, b) => {
    e.stopPropagation();
    if (!confirm(`Delete "${b.name}" and all its audit data?`)) return;
    await api.deleteBusiness(b.id);
    onDeleted();
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {businesses.map((b, i) => (
        <motion.button
          key={b.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          onClick={() => onOpen(b.id)}
          className="text-left bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-5 transition-colors group"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold tracking-tight">{b.name}</h3>
            <span className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onEdit(b); }}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"
              >
                <Pencil className="w-3.5 h-3.5" />
              </span>
              <span
                role="button"
                onClick={(e) => remove(e, b)}
                className="p-1.5 rounded-md hover:bg-zinc-800 text-rose-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-zinc-400">
            {b.address && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{b.address}</p>}
            {b.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{b.phone}</p>}
            {b.website && <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 shrink-0" />{b.website}</p>}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> {b.matches} match
            </span>
            <span className={`flex items-center gap-1 ${b.mismatches ? 'text-rose-400' : 'text-zinc-500'}`}>
              <AlertTriangle className="w-3.5 h-3.5" /> {b.mismatches} mismatch
            </span>
            <span className={`flex items-center gap-1 ${b.open_tasks ? 'text-amber-400' : 'text-zinc-500'}`}>
              <ClipboardList className="w-3.5 h-3.5" /> {b.open_tasks} open task{b.open_tasks === 1 ? '' : 's'}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
