import React from 'react';

const STYLES = {
  match: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  formatting: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  incomplete: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  mismatch: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  unchecked: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30'
};

const LABELS = {
  match: 'match',
  formatting: 'formatting only',
  incomplete: 'incomplete',
  mismatch: 'mismatch',
  unchecked: 'not audited'
};

export default function StatusPill({ status }) {
  const s = STYLES[status] ? status : 'unchecked';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${STYLES[s]}`}>
      {LABELS[s]}
    </span>
  );
}
