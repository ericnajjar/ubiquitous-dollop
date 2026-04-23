// DataScope Cloud Sync — auth guard + transparent localStorage-to-Supabase sync
// Supports team-scoped content: items with teamId sync to team_data table
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

  // --- Team context ---
  ds.activeTeamId = null;
  ds.activeTeamName = 'Personal';
  ds.userTeams = [];

  try {
    const ctx = JSON.parse(localStorage.getItem('datascope_team_context'));
    if (ctx && ctx.teamId) {
      ds.activeTeamId = ctx.teamId;
      ds.activeTeamName = ctx.teamName || 'Team';
    }
  } catch (_) {}

  ds.setTeamContext = function (teamId, teamName) {
    ds.activeTeamId = teamId || null;
    ds.activeTeamName = teamId ? (teamName || 'Team') : 'Personal';
    if (teamId) {
      localStorage.setItem('datascope_team_context', JSON.stringify({ teamId, teamName }));
    } else {
      localStorage.removeItem('datascope_team_context');
    }
    document.dispatchEvent(new CustomEvent('datascope:teamchange', {
      detail: { teamId: ds.activeTeamId, teamName: ds.activeTeamName }
    }));
  };

  ds.getTeamContext = function () {
    return { teamId: ds.activeTeamId, teamName: ds.activeTeamName };
  };

  ds.loadUserTeams = async function () {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data } = await sb.from('team_members')
        .select('team_id, teams(id, name)')
        .eq('user_id', session.user.id);
      ds.userTeams = (data || []).map(m => ({ id: m.teams.id, name: m.teams.name }));
    } catch (_) {
      ds.userTeams = [];
    }
  };

  // --- Helpers ---
  function groupBy(arr, key) {
    const map = {};
    arr.forEach(item => {
      const k = item[key];
      if (!map[k]) map[k] = [];
      map[k].push(item);
    });
    return map;
  }

  // --- Sync ---
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
        const userId = session.user.id;
        const now = new Date().toISOString();

        if (key === 'datascope_profile') {
          await sb.from('user_data').upsert({
            user_id: userId, data_key: key, data: parsed, updated_at: now
          }, { onConflict: 'user_id,data_key' });
          return;
        }

        if (key === 'datascope_kanban') {
          const boards = Array.isArray(parsed) ? parsed : [{ ...parsed, id: parsed.id || uid(), teamId: null }];
          const personal = boards.filter(b => !b.teamId);
          const teamGroups = groupBy(boards.filter(b => b.teamId), 'teamId');
          await sb.from('user_data').upsert({
            user_id: userId, data_key: key, data: personal, updated_at: now
          }, { onConflict: 'user_id,data_key' });
          for (const [teamId, tBoards] of Object.entries(teamGroups)) {
            await sb.from('team_data').upsert({
              team_id: teamId, data_key: key, data: tBoards, updated_at: now
            }, { onConflict: 'team_id,data_key' });
          }
          return;
        }

        if (key === 'datascope_slides') {
          const projects = parsed.projects || [];
          const personal = projects.filter(p => !p.teamId);
          const teamGroups = groupBy(projects.filter(p => p.teamId), 'teamId');
          await sb.from('user_data').upsert({
            user_id: userId, data_key: key,
            data: { projects: personal, currentProject: parsed.currentProject, currentSlide: parsed.currentSlide },
            updated_at: now
          }, { onConflict: 'user_id,data_key' });
          for (const [teamId, tProjects] of Object.entries(teamGroups)) {
            await sb.from('team_data').upsert({
              team_id: teamId, data_key: key, data: { projects: tProjects }, updated_at: now
            }, { onConflict: 'team_id,data_key' });
          }
          return;
        }

        // Array-based keys (notes, docs, canvas, charts, projects)
        if (Array.isArray(parsed)) {
          const personal = parsed.filter(item => !item.teamId);
          const teamGroups = groupBy(parsed.filter(item => item.teamId), 'teamId');
          await sb.from('user_data').upsert({
            user_id: userId, data_key: key, data: personal, updated_at: now
          }, { onConflict: 'user_id,data_key' });
          for (const [teamId, items] of Object.entries(teamGroups)) {
            await sb.from('team_data').upsert({
              team_id: teamId, data_key: key, data: items, updated_at: now
            }, { onConflict: 'team_id,data_key' });
          }
        } else {
          await sb.from('user_data').upsert({
            user_id: userId, data_key: key, data: parsed, updated_at: now
          }, { onConflict: 'user_id,data_key' });
        }
      } catch (_) {}
    }

    function uid() {
      return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    }
  }

  ds.pullFromCloud = async function () {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const origSet = Storage.prototype.setItem.bind(localStorage);

      // Pull personal data
      const { data: personalRows } = await sb.from('user_data')
        .select('data_key, data')
        .eq('user_id', session.user.id);

      // Pull team data
      const teamIds = ds.userTeams.map(t => t.id);
      let allTeamRows = [];
      if (teamIds.length) {
        const { data: tRows } = await sb.from('team_data')
          .select('team_id, data_key, data')
          .in('team_id', teamIds);
        allTeamRows = tRows || [];
      }

      // Group team rows by data_key
      const teamByKey = {};
      allTeamRows.forEach(row => {
        if (!teamByKey[row.data_key]) teamByKey[row.data_key] = [];
        teamByKey[row.data_key].push(row.data);
      });

      // Merge and write
      const processed = new Set();
      (personalRows || []).forEach(row => {
        const key = row.data_key;
        processed.add(key);
        const teamDataArrays = teamByKey[key] || [];

        if (key === 'datascope_profile') {
          origSet(key, JSON.stringify(row.data));
          return;
        }

        if (key === 'datascope_kanban') {
          const personal = Array.isArray(row.data) ? row.data : [];
          const merged = [...personal, ...teamDataArrays.flat()];
          origSet(key, JSON.stringify(merged));
          return;
        }

        if (key === 'datascope_slides') {
          const personalProjects = row.data?.projects || [];
          const teamProjects = teamDataArrays.flatMap(td => td.projects || []);
          origSet(key, JSON.stringify({
            projects: [...personalProjects, ...teamProjects],
            currentProject: row.data?.currentProject || 0,
            currentSlide: row.data?.currentSlide || 0,
          }));
          return;
        }

        // Array-based
        const personal = Array.isArray(row.data) ? row.data : [];
        const merged = [...personal, ...teamDataArrays.flat()];
        origSet(key, JSON.stringify(merged));
      });

      // Team-only keys with no personal counterpart
      for (const [key, dataArrays] of Object.entries(teamByKey)) {
        if (processed.has(key)) continue;
        if (key === 'datascope_kanban') {
          origSet(key, JSON.stringify(dataArrays.flat()));
        } else if (key === 'datascope_slides') {
          const teamProjects = dataArrays.flatMap(td => td.projects || []);
          origSet(key, JSON.stringify({ projects: teamProjects, currentProject: 0, currentSlide: 0 }));
        } else {
          origSet(key, JSON.stringify(dataArrays.flat()));
        }
      }
    } catch (_) {}
  };

  ds.buildTeamMoveSelect = function (currentTeamId) {
    const sel = document.createElement('select');
    sel.className = 'team-move-select';
    const personal = document.createElement('option');
    personal.value = '';
    personal.textContent = 'Personal';
    if (!currentTeamId) personal.selected = true;
    sel.appendChild(personal);
    (ds.userTeams || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === currentTeamId) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  };

  ds.signOut = async function () {
    try { await sb.auth.signOut(); } catch (_) {}
    SYNC_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('datascope_team_context');
    location.href = 'auth.html';
  };

  window.datascope = ds;
})();
