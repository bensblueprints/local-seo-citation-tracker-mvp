import React, { useEffect, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MapPin, LogOut, Plus } from 'lucide-react';
import { api } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import BusinessDetail from './components/BusinessDetail.jsx';
import BusinessModal from './components/BusinessModal.jsx';

export default function App() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [view, setView] = useState({ name: 'dashboard' });
  const [businesses, setBusinesses] = useState([]);
  const [modal, setModal] = useState(null); // null | { business? }

  const refresh = useCallback(async () => {
    try {
      setBusinesses(await api.businesses());
    } catch (e) {
      if (e.status === 401) setAuthed(false);
    }
  }, []);

  useEffect(() => {
    api.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);

  if (authed === null) {
    return <div className="min-h-screen grid place-items-center text-zinc-500">Loading…</div>;
  }
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const saveBusiness = async (data, existing) => {
    if (existing) await api.updateBusiness(existing.id, data);
    else await api.createBusiness(data);
    setModal(null);
    refresh();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => setView({ name: 'dashboard' })}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <MapPin className="w-5 h-5 text-sky-400" />
            Citewatch
          </button>
          <span className="text-xs text-zinc-500 hidden sm:block">
            one NAP, everywhere, always
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setModal({})}
            className="flex items-center gap-1.5 text-sm bg-sky-500 hover:bg-sky-400 text-zinc-950 font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New business
          </button>
          <button
            onClick={async () => { await api.logout(); setAuthed(false); }}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view.name === 'dashboard' && (
          <Dashboard
            businesses={businesses}
            onOpen={(id) => setView({ name: 'detail', id })}
            onNew={() => setModal({})}
            onEdit={(business) => setModal({ business })}
            onDeleted={refresh}
          />
        )}
        {view.name === 'detail' && (
          <BusinessDetail
            id={view.id}
            onBack={() => { setView({ name: 'dashboard' }); refresh(); }}
            onEdit={(business) => setModal({ business })}
          />
        )}
      </main>

      <AnimatePresence>
        {modal && (
          <BusinessModal
            business={modal.business}
            onClose={() => setModal(null)}
            onSave={saveBusiness}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
