(() => {
  const ds = window.datascope || {};
  const sb = ds.sb;
  let currentTeam = null;

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
  }

  async function loadMyTeams() {
    const session = await getSession();
    if (!session) return [];
    const { data, error } = await sb.from('team_members')
      .select('team_id, role, teams(id, name, invite_code, created_at)')
      .eq('user_id', session.user.id)
      .order('joined_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(m => ({
      id: m.teams.id,
      name: m.teams.name,
      invite_code: m.teams.invite_code,
      created_at: m.teams.created_at,
      role: m.role
    }));
  }

  async function loadMembers(teamId) {
    const { data, error } = await sb.from('team_members')
      .select('user_id, email, role, joined_at')
      .eq('team_id', teamId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function renderTeams() {
    const grid = document.getElementById('teamsGrid');
    const empty = document.getElementById('teamsEmpty');
    const loading = document.getElementById('teamsLoading');
    grid.innerHTML = '';

    try {
      const teams = await loadMyTeams();
      loading.hidden = true;

      if (!teams.length) {
        empty.hidden = false;
        grid.hidden = true;
        return;
      }
      empty.hidden = true;
      grid.hidden = false;

      teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'team-card';
        const header = document.createElement('div');
        header.className = 'team-card-header';
        const name = document.createElement('h3');
        name.textContent = team.name;
        const badge = document.createElement('span');
        badge.className = 'role-badge role-' + team.role;
        badge.textContent = team.role;
        header.appendChild(name);
        header.appendChild(badge);
        const meta = document.createElement('div');
        meta.className = 'team-card-meta';
        meta.innerHTML = '<span class="team-code-label">Code:</span> <code>' + escapeHtml(team.invite_code) + '</code>';
        card.appendChild(header);
        card.appendChild(meta);
        card.addEventListener('click', () => openTeamModal(team));
        grid.appendChild(card);
      });
    } catch (err) {
      loading.hidden = true;
      empty.hidden = false;
      empty.textContent = 'Failed to load teams: ' + err.message;
    }
  }

  async function openTeamModal(team) {
    currentTeam = team;
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTeamName').textContent = team.name;
    document.getElementById('modalInviteCode').textContent = team.invite_code;
    const list = document.getElementById('modalMembers');
    list.innerHTML = '<p class="members-loading">Loading…</p>';
    overlay.hidden = false;

    try {
      const session = await getSession();
      const members = await loadMembers(team.id);
      list.innerHTML = '';
      members.forEach(m => {
        const row = document.createElement('div');
        row.className = 'member-row';
        const info = document.createElement('div');
        info.className = 'member-info';
        const email = document.createElement('span');
        email.className = 'member-email';
        email.textContent = m.email || 'Unknown';
        const badge = document.createElement('span');
        badge.className = 'role-badge role-' + m.role;
        badge.textContent = m.role;
        info.appendChild(email);
        info.appendChild(badge);
        row.appendChild(info);

        if (team.role === 'owner' && m.user_id !== session.user.id) {
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn btn-ghost btn-sm danger';
          removeBtn.textContent = 'Remove';
          removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Remove ' + (m.email || 'this member') + ' from the team?')) return;
            try {
              await sb.from('team_members').delete()
                .eq('team_id', team.id).eq('user_id', m.user_id);
              openTeamModal(team);
            } catch (err) { alert(err.message); }
          });
          row.appendChild(removeBtn);
        }
        list.appendChild(row);
      });
    } catch (err) {
      list.innerHTML = '<p class="members-loading">Error: ' + escapeHtml(err.message) + '</p>';
    }
  }

  function closeModal() {
    document.getElementById('modalOverlay').hidden = true;
    currentTeam = null;
  }

  async function handleCreate() {
    const input = document.getElementById('newTeamName');
    const err = document.getElementById('createError');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    err.textContent = '';
    try {
      await sb.rpc('create_team', { team_name: name });
      input.value = '';
      document.getElementById('createForm').hidden = true;
      await renderTeams();
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('error');
    }
  }

  async function handleJoin() {
    const input = document.getElementById('joinCode');
    const err = document.getElementById('joinError');
    const code = input.value.trim();
    if (!code) { input.focus(); return; }
    err.textContent = '';
    try {
      const result = await sb.rpc('join_team_by_code', { code });
      input.value = '';
      document.getElementById('joinForm').hidden = true;
      err.classList.remove('error');
      await renderTeams();
    } catch (e) {
      err.textContent = e.message || 'Invalid invite code';
      err.classList.add('error');
    }
  }

  async function handleLeave() {
    if (!currentTeam) return;
    const msg = currentTeam.role === 'owner'
      ? 'You are the owner. Leaving will not delete the team but it will have no owner. Continue?'
      : 'Leave "' + currentTeam.name + '"?';
    if (!confirm(msg)) return;
    try {
      const session = await getSession();
      await sb.from('team_members').delete()
        .eq('team_id', currentTeam.id).eq('user_id', session.user.id);
      closeModal();
      await renderTeams();
    } catch (e) { alert(e.message); }
  }

  function init() {
    document.getElementById('year').textContent = new Date().getFullYear();

    if (!sb) {
      document.getElementById('teamsLoading').hidden = true;
      document.getElementById('teamsEmpty').hidden = false;
      document.getElementById('teamsEmpty').textContent = 'Cloud sync required. Configure Supabase in supabase-config.js.';
      return;
    }

    document.getElementById('createTeamBtn').addEventListener('click', () => {
      document.getElementById('createForm').hidden = false;
      document.getElementById('joinForm').hidden = true;
      document.getElementById('newTeamName').focus();
    });
    document.getElementById('createCancel').addEventListener('click', () => {
      document.getElementById('createForm').hidden = true;
    });
    document.getElementById('createConfirm').addEventListener('click', handleCreate);
    document.getElementById('newTeamName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCreate();
    });

    document.getElementById('joinTeamBtn').addEventListener('click', () => {
      document.getElementById('joinForm').hidden = false;
      document.getElementById('createForm').hidden = true;
      document.getElementById('joinCode').focus();
    });
    document.getElementById('joinCancel').addEventListener('click', () => {
      document.getElementById('joinForm').hidden = true;
    });
    document.getElementById('joinConfirm').addEventListener('click', handleJoin);
    document.getElementById('joinCode').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleJoin();
    });

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalDone').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.getElementById('leaveTeamBtn').addEventListener('click', handleLeave);
    document.getElementById('copyCodeBtn').addEventListener('click', () => {
      const code = document.getElementById('modalInviteCode').textContent;
      const btn = document.getElementById('copyCodeBtn');
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });

    renderTeams();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
