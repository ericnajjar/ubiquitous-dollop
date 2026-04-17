// DataScope Projects — global project hub linking charts, decks, cards, and notes.
(() => {
  const STORE_KEY = "datascope_projects";
  const CHARTS_KEY = "datascope_saved_charts";
  const SLIDES_KEY = "datascope_slides";
  const KANBAN_KEY = "datascope_kanban";
  const NOTES_KEY = "datascope_notes";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ---------- Persistence ----------
  function loadProjects() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function saveProjects() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.projects));
    } catch (_) {}
  }

  function loadStore(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function saveStore(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  // ---------- State ----------
  const state = {
    projects: loadProjects(),
    editingId: null,
  };

  // ---------- Gather linked items ----------
  function getLinkedCharts(projectId) {
    const charts = loadStore(CHARTS_KEY) || [];
    return charts.filter((c) => c.projectId === projectId);
  }

  function getLinkedDecks(projectId) {
    const data = loadStore(SLIDES_KEY);
    if (!data || !Array.isArray(data.projects)) return [];
    return data.projects.filter((d) => d.projectId === projectId);
  }

  function getLinkedCards(projectId) {
    const data = loadStore(KANBAN_KEY);
    if (!data || !Array.isArray(data.columns)) return [];
    const cards = [];
    data.columns.forEach((col) => {
      (col.cards || []).forEach((card) => {
        if (card.projectId === projectId) cards.push({ ...card, columnName: col.name });
      });
    });
    return cards;
  }

  function getLinkedNotes(projectId) {
    const notes = loadStore(NOTES_KEY) || [];
    return notes.filter((n) => n.projectId === projectId);
  }

  // ---------- Unlink helpers ----------
  function unlinkChart(chartId) {
    const charts = loadStore(CHARTS_KEY) || [];
    const chart = charts.find((c) => c.id === chartId);
    if (chart) {
      chart.projectId = "";
      saveStore(CHARTS_KEY, charts);
    }
  }

  function unlinkDeck(deckId) {
    const data = loadStore(SLIDES_KEY);
    if (!data || !Array.isArray(data.projects)) return;
    const deck = data.projects.find((d) => d.id === deckId);
    if (deck) {
      deck.projectId = "";
      saveStore(SLIDES_KEY, data);
    }
  }

  function unlinkCard(cardId) {
    const data = loadStore(KANBAN_KEY);
    if (!data || !Array.isArray(data.columns)) return;
    data.columns.forEach((col) => {
      (col.cards || []).forEach((card) => {
        if (card.id === cardId) card.projectId = "";
      });
    });
    saveStore(KANBAN_KEY, data);
  }

  function unlinkNote(noteId) {
    const notes = loadStore(NOTES_KEY) || [];
    const note = notes.find((n) => n.id === noteId);
    if (note) {
      note.projectId = "";
      saveStore(NOTES_KEY, notes);
    }
  }

  // ---------- Render ----------
  function render() {
    const grid = document.getElementById("projectsGrid");
    const empty = document.getElementById("emptyState");
    grid.innerHTML = "";

    if (!state.projects.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    state.projects
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .forEach((proj) => grid.appendChild(buildProjectCard(proj)));
  }

  function buildProjectCard(proj) {
    const el = document.createElement("div");
    el.className = "project-card";

    const charts = getLinkedCharts(proj.id);
    const decks = getLinkedDecks(proj.id);
    const cards = getLinkedCards(proj.id);
    const notes = getLinkedNotes(proj.id);

    const name = document.createElement("h3");
    name.className = "project-card-name";
    name.textContent = proj.name;
    el.appendChild(name);

    if (proj.description) {
      const desc = document.createElement("p");
      desc.className = "project-card-desc";
      desc.textContent = proj.description;
      el.appendChild(desc);
    }

    const stats = document.createElement("div");
    stats.className = "project-card-stats";

    if (charts.length) addBadge(stats, `${charts.length} chart${charts.length > 1 ? "s" : ""}`, "");
    if (decks.length) addBadge(stats, `${decks.length} deck${decks.length > 1 ? "s" : ""}`, "purple");
    if (cards.length) addBadge(stats, `${cards.length} card${cards.length > 1 ? "s" : ""}`, "green");
    if (notes.length) addBadge(stats, `${notes.length} note${notes.length > 1 ? "s" : ""}`, "pink");

    if (!charts.length && !decks.length && !cards.length && !notes.length) {
      addBadge(stats, "No items yet", "");
    }

    el.appendChild(stats);
    el.addEventListener("click", () => openModal(proj));
    return el;
  }

  function addBadge(parent, text, cls) {
    const span = document.createElement("span");
    span.className = "stat-badge" + (cls ? " " + cls : "");
    span.textContent = text;
    parent.appendChild(span);
  }

  // ---------- Modal ----------
  function openModal(proj) {
    state.editingId = proj ? proj.id : null;
    document.getElementById("projectNameInput").value = proj?.name || "";
    document.getElementById("projectDescInput").value = proj?.description || "";

    const deleteBtn = document.getElementById("deleteProjectBtn");
    deleteBtn.hidden = !proj;

    renderLinkedItems(proj?.id);

    document.getElementById("modalOverlay").hidden = false;
    document.getElementById("projectNameInput").focus();
  }

  function closeModal() {
    document.getElementById("modalOverlay").hidden = true;
    state.editingId = null;
  }

  function saveModal() {
    const name = document.getElementById("projectNameInput").value.trim();
    if (!name) {
      document.getElementById("projectNameInput").focus();
      return;
    }
    const description = document.getElementById("projectDescInput").value.trim();
    const now = new Date().toISOString();

    if (state.editingId) {
      const proj = state.projects.find((p) => p.id === state.editingId);
      if (proj) {
        proj.name = name;
        proj.description = description;
        proj.updatedAt = now;
      }
    } else {
      state.projects.push({
        id: uid(),
        name,
        description,
        createdAt: now,
        updatedAt: now,
      });
    }

    saveProjects();
    closeModal();
    render();
  }

  function deleteProject() {
    if (!state.editingId) return;
    const proj = state.projects.find((p) => p.id === state.editingId);
    if (!confirm(`Delete project "${proj?.name}"? Linked items will be unlinked but not deleted.`)) return;

    // Unlink all items
    getLinkedCharts(state.editingId).forEach((c) => unlinkChart(c.id));
    getLinkedDecks(state.editingId).forEach((d) => unlinkDeck(d.id));
    getLinkedCards(state.editingId).forEach((c) => unlinkCard(c.id));
    getLinkedNotes(state.editingId).forEach((n) => unlinkNote(n.id));

    state.projects = state.projects.filter((p) => p.id !== state.editingId);
    saveProjects();
    closeModal();
    render();
  }

  function renderLinkedItems(projectId) {
    renderLinkedSection("linkedCharts", projectId ? getLinkedCharts(projectId) : [], (c) => c.name, (c) => `Saved ${new Date(c.savedAt).toLocaleDateString()}`, (c) => { unlinkChart(c.id); renderLinkedItems(projectId); render(); });
    renderLinkedSection("linkedDecks", projectId ? getLinkedDecks(projectId) : [], (d) => d.name, () => "Slide deck", (d) => { unlinkDeck(d.id); renderLinkedItems(projectId); render(); });
    renderLinkedSection("linkedCards", projectId ? getLinkedCards(projectId) : [], (c) => c.title, (c) => c.columnName || "", (c) => { unlinkCard(c.id); renderLinkedItems(projectId); render(); });
    renderLinkedSection("linkedNotes", projectId ? getLinkedNotes(projectId) : [], (n) => n.title || n.body?.slice(0, 40) || "Untitled", () => "Note", (n) => { unlinkNote(n.id); renderLinkedItems(projectId); render(); });
  }

  function renderLinkedSection(containerId, items, nameGetter, metaGetter, onUnlink) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    if (!items.length) return;

    items.forEach((item) => {
      const el = document.createElement("div");
      el.className = "linked-item";

      const nameSpan = document.createElement("span");
      nameSpan.className = "linked-item-name";
      nameSpan.textContent = nameGetter(item);
      el.appendChild(nameSpan);

      const meta = metaGetter(item);
      if (meta) {
        const metaSpan = document.createElement("span");
        metaSpan.className = "linked-item-meta";
        metaSpan.textContent = meta;
        el.appendChild(metaSpan);
      }

      const unlinkBtn = document.createElement("button");
      unlinkBtn.className = "unlink-btn";
      unlinkBtn.title = "Unlink from project";
      unlinkBtn.textContent = "×";
      unlinkBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onUnlink(item);
      });
      el.appendChild(unlinkBtn);

      container.appendChild(el);
    });
  }

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();
    render();

    document.getElementById("newProjectBtn").addEventListener("click", () => openModal(null));
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalCancel").addEventListener("click", closeModal);
    document.getElementById("modalSave").addEventListener("click", saveModal);
    document.getElementById("deleteProjectBtn").addEventListener("click", deleteProject);

    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target === document.getElementById("modalOverlay")) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.getElementById("modalOverlay").hidden) closeModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
