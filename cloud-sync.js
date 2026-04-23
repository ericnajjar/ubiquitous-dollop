// DataScope Cloud Sync — auth guard + transparent localStorage-to-Supabase sync
(function () {
  const ds = window.datascope || {};
  const sb = ds.sb;
  const isAuthPage = location.pathname.endsWith('auth.html');

  if (!sb) {
    if (isAuthPage) location.href = 'index.html';
    return;
  }

  let hasSession = false;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
      hasSession = !!localStorage.getItem(k);
      break;
    }
  }

  if (!hasSession && !isAuthPage) { location.href = 'auth.html'; return; }
  if (hasSession && isAuthPage) { location.href = 'index.html'; return; }

  const SYNC_KEYS = [
    'datascope_docs', 'datascope_projects', 'datascope_kanban',
    'datascope_slides', 'datascope_notes', 'datascope_canvas',
    'datascope_saved_charts', 'datascope_profile'
  ];

  if (hasSession && !isAuthPage) {
    const origSet = Storage.prototype.setItem.bind(localStorage);
    const timers = {};

    localStorage.setItem = function (key, value) {
      origSet(key, value);
      if (SYNC_KEYS.includes(key)) {
        clearTimeout(timers[key]);
        timers[key] = setTimeout(() => pushKey(key, value), 1500);
      }
    };

    async function pushKey(key, value) {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;
        let parsed;
        try { parsed = JSON.parse(value); } catch (_) { return; }
        await sb.from('user_data').upsert({
          user_id: session.user.id,
          data_key: key,
          data: parsed,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,data_key' });
      } catch (_) {}
    }

  }

  ds.pullFromCloud = async function () {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data } = await sb.from('user_data')
        .select('data_key, data')
        .eq('user_id', session.user.id);
      if (data) {
        const origSet = Storage.prototype.setItem.bind(localStorage);
        data.forEach(row => origSet(row.data_key, JSON.stringify(row.data)));
      }
    } catch (_) {}
  };

  ds.signOut = async function () {
    try { await sb.auth.signOut(); } catch (_) {}
    SYNC_KEYS.forEach(k => localStorage.removeItem(k));
    location.href = 'auth.html';
  };

  window.datascope = ds;
})();
