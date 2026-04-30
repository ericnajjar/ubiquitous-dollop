// DataScope Notes — colored sticky-note scratchpad.
(() => {
  const STORE_KEY = "datascope_notes";

  const NOTE_COLORS = [
    { bg: "#1e2a45", label: "Default" },
    { bg: "#2d1f3d", label: "Purple" },
    { bg: "#1f2d1f", label: "Green" },
    { bg: "#2d1f1f", label: "Red" },
    { bg: "#2d261a", label: "Amber" },
    { bg: "#1a2a2d", label: "Teal" },
    { bg: "#2a1f2d", label: "Pink" },
    { bg: "#202020", label: "Dark" },
  ];

  const NOTE_BORDER_COLORS = [
    "rgba(110,168,255,.25)",
    "rgba(167,139,250,.3)",
    "rgba(74,222,128,.25)",
    "rgba(248,113,113,.3)",
    "rgba(251,191,36,.25)",
    "rgba(34,211,238,.25)",
    "rgba(244,114,182,.3)",
    "rgba(255,255,255,.1)",
  ];

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function saveNotes() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.notes));
    } catch (_) {}
  }

  const state = {
    notes: loadNotes(),
    search: "",
    activeTag: null,
    editingId: null,
    editingColorIdx: 0,
  };

  // ---------- Derived ----------
  function allTags() {
    const tags = new Set();
    state.notes.forEach((n) => (n.tags || []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  }

  function filteredNotes() {
    const q = state.search.toLowerCase();
    const teamId = window.datascope?.activeTeamId || null;
    return state.notes.filter((n) => {
      if ((n.teamId || null) !== teamId) return false;
      if (state.activeTag && !(n.tags || []).includes(state.activeTag)) return false;
      if (!q) return true;
      return (
        (n.title || "").toLowerCase().includes(q) ||
        (n.body || "").toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }

  // ---------- Render ----------
  function render() {
    renderTagFilters();
    renderGrid();
  }

  function renderTagFilters() {
    const wrap = document.getElementById("tagFilters");
    wrap.innerHTML = "";
    const tags = allTags();
    if (!tags.length) return;

    const allBtn = makeTagBtn("All", null);
    wrap.appendChild(allBtn);
    tags.forEach((t) => wrap.appendChild(makeTagBtn(t, t)));
  }

  function makeTagBtn(label, value) {
    const btn = document.createElement("button");
    btn.className =
      "tag-filter-btn" + (state.activeTag === value ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      state.activeTag = state.activeTag === value ? null : value;
      render();
    });
    return btn;
  }

  function renderGrid() {
    const grid = document.getElementById("notesGrid");
    const empty = document.getElementById("emptyState");
    grid.innerHTML = "";

    // Pinned first, then by updated desc.
    const notes = filteredNotes().sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    if (!notes.length && !state.search && !state.activeTag) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    notes.forEach((note) => grid.appendChild(buildNoteCard(note)));
  }

  function buildNoteCard(note) {
    const colorIdx = note.colorIdx ?? 0;
    const bg = NOTE_COLORS[colorIdx]?.bg || NOTE_COLORS[0].bg;
    const border = NOTE_BORDER_COLORS[colorIdx] || NOTE_BORDER_COLORS[0];

    const el = document.createElement("div");
    el.className = "note-card";
    el.style.background = bg;
    el.style.borderColor = border;
    el.dataset.noteId = note.id;

    // Header
    const header = document.createElement("div");
    header.className = "note-card-header";

    if (note.title) {
      const title = document.createElement("div");
      title.className = "note-card-title";
      title.textContent = note.title;
      header.appendChild(title);
    }

    const actions = document.createElement("div");
    actions.className = "note-card-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "note-action-btn" + (note.pinned ? " pinned" : "");
    pinBtn.title = note.pinned ? "Unpin" : "Pin";
    pinBtn.textContent = note.pinned ? "📌" : "📍";
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      note.pinned = !note.pinned;
      note.updatedAt = new Date().toISOString();
      saveNotes();
      render();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "note-action-btn";
    deleteBtn.title = "Delete note";
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm("Delete this note?")) return;
      state.notes = state.notes.filter((n) => n.id !== note.id);
      saveNotes();
      render();
    });

    actions.append(pinBtn, deleteBtn);
    if (note.title) header.appendChild(actions);
    else header.append(document.createElement("span"), actions);
    el.appendChild(header);

    // Body
    if (note.body) {
      const body = document.createElement("div");
      body.className = "note-card-body";
      body.textContent = note.body;
      el.appendChild(body);
    }

    // Footer
    const footer = document.createElement("div");
    footer.className = "note-card-footer";

    if (note.tags?.length) {
      const tagsEl = document.createElement("div");
      tagsEl.className = "note-tags";
      note.tags.forEach((t) => {
        const span = document.createElement("span");
        span.className = "note-tag";
        span.textContent = t;
        tagsEl.appendChild(span);
      });
      footer.appendChild(tagsEl);
    }

    const cd = formatCountdown(note.dueDate);
    if (cd) {
      const badge = document.createElement("span");
      badge.className = "countdown " + cd.cls;
      badge.textContent = cd.text;
      footer.appendChild(badge);
    }

    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = formatDate(note.updatedAt);
    footer.appendChild(date);
    el.appendChild(footer);

    el.addEventListener("click", () => openModal(note));
    return el;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 7 * 86400000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  }

  function formatCountdown(dateStr) {
    if (!dateStr) return null;
    const due = new Date(dateStr + "T23:59:59");
    const now = new Date();
    const diffMs = due - now;
    const days = Math.ceil(diffMs / 86400000);
    if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, cls: "overdue" };
    if (days === 0) return { text: "Due today", cls: "urgent" };
    if (days === 1) return { text: "Tomorrow", cls: "soon" };
    if (days <= 3) return { text: `${days} days`, cls: "soon" };
    return { text: `${days} days`, cls: "ok" };
  }

  // ---------- Projects ----------
  function loadGlobalProjects() {
    try {
      const raw = localStorage.getItem("datascope_projects");
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function populateProjectSelect(selectedId) {
    const sel = document.getElementById("noteProjectSelect");
    sel.innerHTML = '<option value="">None</option>';
    loadGlobalProjects().forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ---------- Modal ----------
  function openModal(note) {
    state.editingId = note ? note.id : null;
    state.editingColorIdx = note?.colorIdx ?? 0;

    document.getElementById("noteTitleInput").value = note?.title || "";
    document.getElementById("noteBodyInput").value = note?.body || "";
    document.getElementById("noteTagsInput").value = note?.tags?.join(", ") || "";
    document.getElementById("noteDueInput").value = note?.dueDate || "";
    populateProjectSelect(note?.projectId || "");
    renderColorPalette();

    const moveWrap = document.getElementById("noteMoveWrap");
    moveWrap.innerHTML = "";
    const ds = window.datascope;
    if (ds?.userTeams?.length) {
      const lbl = document.createElement("label");
      lbl.className = "team-move-label";
      lbl.textContent = "Owner";
      moveWrap.appendChild(lbl);
      moveWrap.appendChild(ds.buildTeamMoveSelect(note?.teamId || null));
    }

    document.getElementById("modalOverlay").hidden = false;

    // Set modal background to match note color.
    const modal = document.getElementById("noteModal");
    modal.style.background = NOTE_COLORS[state.editingColorIdx]?.bg || NOTE_COLORS[0].bg;

    document.getElementById("noteBodyInput").focus();
  }

  function closeModal() {
    document.getElementById("modalOverlay").hidden = true;
    state.editingId = null;
  }

  function saveModal() {
    const title = document.getElementById("noteTitleInput").value.trim();
    const body = document.getElementById("noteBodyInput").value.trim();
    const tags = document.getElementById("noteTagsInput").value
      .split(",").map((t) => t.trim()).filter(Boolean);
    const dueDate = document.getElementById("noteDueInput").value || "";
    const projectId = document.getElementById("noteProjectSelect").value || "";
    const moveSel = document.querySelector("#noteMoveWrap .team-move-select");
    const newTeamId = moveSel ? (moveSel.value || null) : (window.datascope?.activeTeamId || null);

    if (!title && !body) { closeModal(); return; }

    const now = new Date().toISOString();

    if (state.editingId) {
      const note = state.notes.find((n) => n.id === state.editingId);
      if (note) {
        note.title = title;
        note.body = body;
        note.tags = tags;
        note.dueDate = dueDate;
        note.projectId = projectId;
        note.colorIdx = state.editingColorIdx;
        note.teamId = newTeamId;
        note.updatedAt = now;
      }
    } else {
      state.notes.unshift({
        id: uid(),
        teamId: newTeamId,
        title,
        body,
        tags,
        dueDate,
        projectId,
        colorIdx: state.editingColorIdx,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    saveNotes();
    closeModal();
    render();
  }

  function deleteNote() {
    if (!state.editingId) return;
    if (!confirm("Delete this note?")) return;
    state.notes = state.notes.filter((n) => n.id !== state.editingId);
    saveNotes();
    closeModal();
    render();
  }

  function renderColorPalette() {
    const wrap = document.getElementById("colorPalette");
    const modal = document.getElementById("noteModal");
    wrap.innerHTML = "";
    NOTE_COLORS.forEach((color, i) => {
      const sw = document.createElement("button");
      sw.type = "button";
      sw.className = "color-swatch" + (i === state.editingColorIdx ? " active" : "");
      sw.style.background = color.bg;
      sw.style.borderColor = NOTE_BORDER_COLORS[i];
      sw.title = color.label;
      sw.addEventListener("click", () => {
        state.editingColorIdx = i;
        modal.style.background = color.bg;
        wrap.querySelectorAll(".color-swatch").forEach((s, j) =>
          s.classList.toggle("active", j === i)
        );
      });
      wrap.appendChild(sw);
    });
  }

  // ---------- Search ----------
  function onSearch(value) {
    state.search = value.trim();
    renderGrid();
  }

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    render();

    document.getElementById("newNoteBtn").addEventListener("click", () => openModal(null));
    document.getElementById("searchInput").addEventListener("input", (e) => onSearch(e.target.value));

    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalSave").addEventListener("click", saveModal);
    document.getElementById("deleteNoteBtn").addEventListener("click", deleteNote);
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target === document.getElementById("modalOverlay")) saveModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") saveModal();
    });

    // Auto-resize textarea
    const textarea = document.getElementById("noteBodyInput");
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.max(260, textarea.scrollHeight) + "px";
    });

    document.addEventListener("datascope:teamchange", () => render());

    window.addEventListener("datascope:externalAdd", (e) => {
      if (e.detail?.target !== "notes") return;
      state.notes = loadNotes();
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
