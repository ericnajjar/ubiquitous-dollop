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
    'datascope_saved_charts'
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

    document.addEventListener('DOMContentLoaded', async () => {
      const nav = document.querySelector('.site-nav');
      if (!nav) return;
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return;
        const style = document.createElement('style');
        style.textContent =
          '.user-menu{display:flex;align-items:center;gap:10px;margin-left:16px}' +
          '.user-email{font-size:12px;color:#9aa4c7;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
          '.user-logout{font:inherit;font-size:12px;color:#9aa4c7;background:transparent;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:4px 10px;cursor:pointer;transition:color .2s,border-color .2s}' +
          '.user-logout:hover{color:#e7ecff;border-color:#6ea8ff}';
        document.head.appendChild(style);
        const menu = document.createElement('div');
        menu.className = 'user-menu';
        const email = document.createElement('span');
        email.className = 'user-email';
        email.textContent = session.user.email;
        const btn = document.createElement('button');
        btn.className = 'user-logout';
        btn.textContent = 'Sign out';
        btn.addEventListener('click', () => ds.signOut());
        menu.appendChild(email);
        menu.appendChild(btn);
        nav.parentElement.appendChild(menu);
      } catch (_) {}
    });
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
