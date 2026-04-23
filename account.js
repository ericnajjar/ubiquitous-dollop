(() => {
  const ds = window.datascope || {};
  const sb = ds.sb;
  if (!sb) return;

  const PROFILE_KEY = 'datascope_profile';

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
    catch { return {}; }
  }

  function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

  async function getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  function buildPanel(email) {
    const overlay = document.createElement('div');
    overlay.className = 'account-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="account-panel">' +
        '<div class="account-panel-header">' +
          '<h2>Account</h2>' +
          '<button type="button" class="account-panel-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="account-panel-body">' +
          '<div class="account-profile-top">' +
            '<div class="account-avatar" id="acctAvatar">' + esc((email || '?')[0].toUpperCase()) + '</div>' +
            '<span class="account-email">' + esc(email) + '</span>' +
          '</div>' +
          '<div class="account-section">' +
            '<h3 class="account-section-title">Profile</h3>' +
            '<div class="account-field"><label for="profileName">Display Name</label>' +
              '<input type="text" id="profileName" placeholder="Your name" autocomplete="name" /></div>' +
            '<div class="account-field"><label for="profileTitle">Job Title</label>' +
              '<input type="text" id="profileTitle" placeholder="e.g. Designer" autocomplete="organization-title" /></div>' +
            '<div class="account-field"><label for="profileCompany">Company</label>' +
              '<input type="text" id="profileCompany" placeholder="Company name" autocomplete="organization" /></div>' +
            '<div class="account-field"><label for="profilePhone">Phone</label>' +
              '<input type="tel" id="profilePhone" placeholder="+1 (555) 000-0000" autocomplete="tel" /></div>' +
            '<div class="account-field"><label for="profileAddress">Address</label>' +
              '<textarea id="profileAddress" rows="2" placeholder="Street, City, State, ZIP" autocomplete="street-address"></textarea></div>' +
            '<button type="button" class="btn btn-primary btn-sm" id="saveProfileBtn">Save profile</button>' +
            '<span class="profile-saved-msg" id="profileSavedMsg" hidden>Saved!</span>' +
          '</div>' +
          '<div class="account-section">' +
            '<div class="account-section-row">' +
              '<h3 class="account-section-title">Teams</h3>' +
              '<div class="account-section-actions">' +
                '<button type="button" class="btn btn-ghost btn-sm" id="acctJoinTeamBtn">Join</button>' +
                '<button type="button" class="btn btn-primary btn-sm" id="acctCreateTeamBtn">+ Create</button>' +
              '</div>' +
            '</div>' +
            '<div class="acct-teams-form" id="acctCreateForm" hidden>' +
              '<input type="text" id="acctNewTeamName" placeholder="Team name…" autocomplete="off" />' +
              '<div class="acct-teams-form-actions">' +
                '<button type="button" class="btn btn-primary btn-sm" id="acctCreateConfirm">Create</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="acctCreateCancel">Cancel</button>' +
              '</div>' +
              '<span class="form-msg" id="acctCreateError"></span>' +
            '</div>' +
            '<div class="acct-teams-form" id="acctJoinForm" hidden>' +
              '<input type="text" id="acctJoinCode" placeholder="Invite code…" autocomplete="off" />' +
              '<div class="acct-teams-form-actions">' +
                '<button type="button" class="btn btn-primary btn-sm" id="acctJoinConfirm">Join</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="acctJoinCancel">Cancel</button>' +
              '</div>' +
              '<span class="form-msg" id="acctJoinError"></span>' +
            '</div>' +
            '<div class="acct-teams-list" id="acctTeamsList"></div>' +
            '<p class="acct-teams-empty" id="acctTeamsEmpty" hidden>No teams yet.</p>' +
          '</div>' +
        '</div>' +
        '<div class="account-panel-footer">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="accountSignOut">Sign out</button>' +
        '</div>' +
      '</div>';
    return overlay;
  }

  async function loadTeams() {
    const list = document.getElementById('acctTeamsList');
    const empty = document.getElementById('acctTeamsEmpty');
    if (!list) return;
    list.innerHTML = '';
    try {
      const session = await getSession();
      if (!session) return;
      const { data, error } = await sb.from('team_members')
        .select('team_id, role, teams(id, name, invite_code, created_at)')
        .eq('user_id', session.user.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      const teams = (data || []).map(m => ({
        id: m.teams.id, name: m.teams.name,
        invite_code: m.teams.invite_code, role: m.role
      }));
      if (!teams.length) { empty.hidden = false; return; }
      empty.hidden = true;
      teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'acct-team-card';
        const header = document.createElement('div');
        header.className = 'acct-team-card-header';
        const name = document.createElement('span');
        name.className = 'acct-team-name';
        name.textContent = team.name;
        const badge = document.createElement('span');
        badge.className = 'role-badge role-' + team.role;
        badge.textContent = team.role;
        header.appendChild(name);
        header.appendChild(badge);
        const codeRow = document.createElement('div');
        codeRow.className = 'acct-team-code';
        codeRow.innerHTML = '<span>Code:</span> <code>' + esc(team.invite_code) + '</code>';
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-ghost btn-sm acct-copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(team.invite_code).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          });
        });
        codeRow.appendChild(copyBtn);
        card.appendChild(header);
        card.appendChild(codeRow);
        list.appendChild(card);
      });
    } catch (err) {
      empty.hidden = false;
      empty.textContent = 'Failed to load teams.';
    }
  }

  async function handleCreate() {
    const input = document.getElementById('acctNewTeamName');
    const err = document.getElementById('acctCreateError');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    err.textContent = '';
    try {
      await sb.rpc('create_team', { team_name: name });
      input.value = '';
      document.getElementById('acctCreateForm').hidden = true;
      await loadTeams();
      await ds.loadUserTeams();
      refreshTeamSelect();
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('error');
    }
  }

  async function handleJoin() {
    const input = document.getElementById('acctJoinCode');
    const err = document.getElementById('acctJoinError');
    const code = input.value.trim();
    if (!code) { input.focus(); return; }
    err.textContent = '';
    try {
      await sb.rpc('join_team_by_code', { code });
      input.value = '';
      document.getElementById('acctJoinForm').hidden = true;
      await loadTeams();
      await ds.loadUserTeams();
      refreshTeamSelect();
    } catch (e) {
      err.textContent = e.message || 'Invalid invite code';
      err.classList.add('error');
    }
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

      const panel = buildPanel(email);
      document.body.appendChild(panel);

      if (profile.name) document.getElementById('profileName').value = profile.name;
      if (profile.title) document.getElementById('profileTitle').value = profile.title;
      if (profile.company) document.getElementById('profileCompany').value = profile.company;
      if (profile.phone) document.getElementById('profilePhone').value = profile.phone;
      if (profile.address) document.getElementById('profileAddress').value = profile.address;
      if (profile.name) {
        document.getElementById('acctAvatar').textContent = profile.name[0].toUpperCase();
        iconBtn.textContent = profile.name[0].toUpperCase();
      }

      iconBtn.addEventListener('click', () => { panel.hidden = false; loadTeams(); });
      panel.querySelector('.account-panel-close').addEventListener('click', () => { panel.hidden = true; });
      panel.addEventListener('click', (e) => { if (e.target === panel) panel.hidden = true; });

      document.getElementById('saveProfileBtn').addEventListener('click', () => {
        const p = {
          name: document.getElementById('profileName').value.trim(),
          title: document.getElementById('profileTitle').value.trim(),
          company: document.getElementById('profileCompany').value.trim(),
          phone: document.getElementById('profilePhone').value.trim(),
          address: document.getElementById('profileAddress').value.trim()
        };
        saveProfile(p);
        const msg = document.getElementById('profileSavedMsg');
        msg.hidden = false;
        setTimeout(() => { msg.hidden = true; }, 2000);
        if (p.name) {
          document.getElementById('acctAvatar').textContent = p.name[0].toUpperCase();
          iconBtn.textContent = p.name[0].toUpperCase();
        }
      });

      document.getElementById('acctCreateTeamBtn').addEventListener('click', () => {
        document.getElementById('acctCreateForm').hidden = false;
        document.getElementById('acctJoinForm').hidden = true;
        document.getElementById('acctNewTeamName').focus();
      });
      document.getElementById('acctCreateCancel').addEventListener('click', () => {
        document.getElementById('acctCreateForm').hidden = true;
      });
      document.getElementById('acctCreateConfirm').addEventListener('click', handleCreate);
      document.getElementById('acctNewTeamName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCreate();
      });

      document.getElementById('acctJoinTeamBtn').addEventListener('click', () => {
        document.getElementById('acctJoinForm').hidden = false;
        document.getElementById('acctCreateForm').hidden = true;
        document.getElementById('acctJoinCode').focus();
      });
      document.getElementById('acctJoinCancel').addEventListener('click', () => {
        document.getElementById('acctJoinForm').hidden = true;
      });
      document.getElementById('acctJoinConfirm').addEventListener('click', handleJoin);
      document.getElementById('acctJoinCode').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleJoin();
      });

      document.getElementById('accountSignOut').addEventListener('click', () => ds.signOut());

      document.addEventListener('datascope:teamchange', () => refreshTeamSelect());
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
