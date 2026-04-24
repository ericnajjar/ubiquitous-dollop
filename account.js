(() => {
  const ds = window.datascope || {};
  const sb = ds.sb;
  if (!sb) return;

  const PROFILE_KEY = 'datascope_profile';

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
    catch { return {}; }
  }

  async function getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
  }

  function buildIcon(email, profile) {
    const btn = document.createElement('button');
    btn.className = 'account-icon-btn';
    btn.setAttribute('aria-label', 'Account');
    btn.title = email;
    const initial = (profile.name || email || '?')[0].toUpperCase();
    btn.textContent = initial;
    return btn;
  }

  function buildTeamSelect() {
    const sel = document.createElement('select');
    sel.className = 'team-context-select';
    sel.innerHTML = '<option value="">Personal</option>';
    (ds.userTeams || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === ds.activeTeamId) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!ds.activeTeamId) sel.value = '';
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      ds.setTeamContext(sel.value || null, opt.textContent);
    });
    return sel;
  }

  function refreshTeamSelect() {
    const wrap = document.querySelector('.account-icon-wrap');
    if (!wrap) return;
    const old = wrap.querySelector('.team-context-select');
    const sel = buildTeamSelect();
    if (old) old.replaceWith(sel);
    else wrap.insertBefore(sel, wrap.firstChild);
  }

  function init() {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;

    getSession().then(async session => {
      if (!session) return;
      const email = session.user.email;
      const profile = getProfile();

      await ds.loadUserTeams();

      const teamSelect = buildTeamSelect();
      const iconBtn = buildIcon(email, profile);
      const wrap = document.createElement('div');
      wrap.className = 'account-icon-wrap';
      wrap.appendChild(teamSelect);
      wrap.appendChild(iconBtn);
      nav.parentElement.appendChild(wrap);

      iconBtn.addEventListener('click', () => {
        window.location.href = 'settings.html';
      });

      document.addEventListener('datascope:teamchange', () => refreshTeamSelect());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
