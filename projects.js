// DataScope Collections — two-panel layout with sidebar list + detail view.
(() => {
  const STORE_KEY = "datascope_projects";
  const CHARTS_KEY = "datascope_saved_charts";
  const SLIDES_KEY = "datascope_slides";
  const KANBAN_KEY = "datascope_kanban";
  const NOTES_KEY = "datascope_notes";
  const DOCS_KEY = "datascope_docs";
  const CANVAS_KEY = "datascope_canvas";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ---------- Persistence ----------
  function loadCollections() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function saveCollections() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state.collections));
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
    collections: loadCollections(),
    activeId: null,
    saveTimeout: null,
  };

  // ---------- Gather linked items ----------
  function getLinkedCharts(id) {
    return (loadStore(CHARTS_KEY) || []).filter(c => c.projectId === id);
  }

  function getLinkedDecks(id) {
    const data = loadStore(SLIDES_KEY);
    if (!data || !Array.isArray(data.projects)) return [];
    return data.projects.filter(d => d.projectId === id);
  }

  function getLinkedCards(id) {
    const data = loadStore(KANBAN_KEY);
    if (!data) return [];
    const cards = [];
    const boards = Array.isArray(data) ? data : [data];
    boards.forEach(board => {
      (board.columns || []).forEach(col => {
        (col.cards || []).forEach(card => {
          if (card.projectId === id) cards.push({ ...card, columnName: col.title || col.name });
        });
      });
    });
    return cards;
  }

  function getLinkedNotes(id) {
    return (loadStore(NOTES_KEY) || []).filter(n => n.projectId === id);
  }

  function getLinkedDocs(id) {
    return (loadStore(DOCS_KEY) || []).filter(d => d.projectId === id);
  }

  // ---------- Unlink helpers ----------
  function unlinkChart(chartId) {
    const charts = loadStore(CHARTS_KEY) || [];
    const c = charts.find(x => x.id === chartId);
    if (c) { c.projectId = ""; saveStore(CHARTS_KEY, charts); }
  }

  function unlinkDeck(deckId) {
    const data = loadStore(SLIDES_KEY);
    if (!data || !Array.isArray(data.projects)) return;
    const d = data.projects.find(x => x.id === deckId);
    if (d) { d.projectId = ""; saveStore(SLIDES_KEY, data); }
  }

  function unlinkCard(cardId) {
    const data = loadStore(KANBAN_KEY);
    if (!data) return;
    const boards = Array.isArray(data) ? data : [data];
    boards.forEach(board => {
      (board.columns || []).forEach(col => {
        (col.cards || []).forEach(card => {
          if (card.id === cardId) card.projectId = "";
        });
      });
    });
    saveStore(KANBAN_KEY, Array.isArray(data) ? boards : boards[0]);
  }

  function unlinkNote(noteId) {
    const notes = loadStore(NOTES_KEY) || [];
    const n = notes.find(x => x.id === noteId);
    if (n) { n.projectId = ""; saveStore(NOTES_KEY, notes); }
  }

  function unlinkDoc(docId) {
    const docs = loadStore(DOCS_KEY) || [];
    const d = docs.find(x => x.id === docId);
    if (d) { d.projectId = ""; saveStore(DOCS_KEY, docs); }
  }

  function teamFiltered() {
    const teamId = window.datascope?.activeTeamId || null;
    return state.collections.filter(p => (p.teamId || null) === teamId);
  }

  // ---------- Link URLs for opening items ----------
  const linkUrls = {
    charts: "charts.html",
    slides: "slides.html",
    cards: "kanban.html",
    notes: "notes.html",
    docs: "docs.html",
    canvas: "canvas.html",
  };

  // ---------- Content type configs ----------
  const contentTypes = [
    { key: "charts", label: "Charts", getter: getLinkedCharts, nameGetter: c => c.name, unlinker: unlinkChart, url: "charts.html" },
    { key: "slides", label: "Slides", getter: getLinkedDecks, nameGetter: d => d.name, unlinker: unlinkDeck, url: "slides.html" },
    { key: "cards",  label: "Board Cards", getter: getLinkedCards, nameGetter: c => c.title, unlinker: unlinkCard, url: "kanban.html" },
    { key: "notes",  label: "Notes", getter: getLinkedNotes, nameGetter: n => n.title || n.body?.slice(0, 40) || "Untitled", unlinker: unlinkNote, url: "notes.html" },
    { key: "docs",   label: "Docs", getter: getLinkedDocs, nameGetter: d => d.title || "Untitled", unlinker: unlinkDoc, url: "docs.html" },
  ];

  // Types that can be hinted as "add" at the bottom
  const addableTypes = [
    { key: "charts", label: "Add Charts", url: "charts.html" },
    { key: "slides", label: "Add Slides", url: "slides.html" },
    { key: "notes",  label: "Add Notes", url: "notes.html" },
    { key: "canvas", label: "Add Canvas", url: "canvas.html" },
    { key: "docs",   label: "Add Docs", url: "docs.html" },
  ];

  // ---------- Sidebar ----------
  function renderSidebar() {
    const list = document.getElementById("sidebarList");
    const empty = document.getElementById("sidebarEmpty");
    list.innerHTML = "";

    const collections = teamFiltered()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (!collections.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    collections.forEach(col => {
      const item = document.createElement("div");
      item.className = "sidebar-item" + (col.id === state.activeId ? " active" : "");
      item.dataset.id = col.id;

      const header = document.createElement("div");
      header.className = "sidebar-item-header";
      const name = document.createElement("span");
      name.className = "sidebar-item-name";
      name.textContent = col.name || "Untitled";
      header.appendChild(name);
      item.appendChild(header);

      const stats = document.createElement("div");
      stats.className = "sidebar-item-stats";
      contentTypes.forEach(ct => {
        const items = ct.getter(col.id);
        if (items.length) {
          const line = document.createElement("div");
          line.className = "sidebar-stat-line";
          line.textContent = ct.label + " (" + items.length + ")";
          stats.appendChild(line);
        }
      });
      item.appendChild(stats);

      header.addEventListener("click", () => selectCollection(col.id));
      list.appendChild(item);
    });
  }

  // ---------- Detail ----------
  function selectCollection(id) {
    state.activeId = id;
    renderSidebar();
    renderDetail();
  }

  function renderDetail() {
    const placeholder = document.getElementById("detailPlaceholder");
    const content = document.getElementById("detailContent");

    if (!state.activeId) {
      placeholder.hidden = false;
      content.hidden = true;
      return;
    }

    const col = state.collections.find(c => c.id === state.activeId);
    if (!col) {
      placeholder.hidden = false;
      content.hidden = true;
      return;
    }

    placeholder.hidden = true;
    content.hidden = false;

    const nameEl = document.getElementById("detailName");
    nameEl.textContent = col.name || "";

    document.getElementById("detailDesc").value = col.description || "";

    renderDetailSections(col.id);
    renderAddBar(col.id);
  }

  function renderDetailSections(id) {
    const container = document.getElementById("detailSections");
    container.innerHTML = "";

    contentTypes.forEach(ct => {
      const items = ct.getter(id);
      if (!items.length) return;

      const section = document.createElement("div");
      section.className = "detail-section";

      const header = document.createElement("h3");
      header.className = "detail-section-header";
      header.textContent = ct.label;
      section.appendChild(header);

      const list = document.createElement("div");
      list.className = "detail-items";

      items.forEach(item => {
        const row = document.createElement("div");
        row.className = "detail-item";

        const name = document.createElement("span");
        name.className = "detail-item-name";
        name.textContent = ct.nameGetter(item);
        row.appendChild(name);

        const unlink = document.createElement("button");
        unlink.className = "detail-item-unlink";
        unlink.textContent = "×";
        unlink.title = "Unlink";
        unlink.addEventListener("click", (e) => {
          e.stopPropagation();
          ct.unlinker(item.id);
          renderDetail();
          renderSidebar();
        });
        row.appendChild(unlink);

        const arrow = document.createElement("span");
        arrow.className = "detail-item-arrow";
        arrow.textContent = "›";
        row.appendChild(arrow);

        row.addEventListener("click", () => {
          window.location.href = ct.url;
        });

        list.appendChild(row);
      });

      section.appendChild(list);
      container.appendChild(section);
    });

    if (!container.children.length) {
      const hint = document.createElement("p");
      hint.className = "detail-section-hint";
      hint.style.textAlign = "center";
      hint.style.padding = "24px 0";
      hint.textContent = "No items linked yet. Assign items from each tool, or use the links below.";
      container.appendChild(hint);
    }
  }

  function renderAddBar(id) {
    const bar = document.getElementById("detailAddBar");
    bar.innerHTML = "";

    const linkedKeys = new Set();
    contentTypes.forEach(ct => {
      if (ct.getter(id).length) linkedKeys.add(ct.key);
    });

    addableTypes.forEach(at => {
      const btn = document.createElement("button");
      btn.className = "add-bar-btn";
      btn.textContent = at.label;
      btn.addEventListener("click", () => {
        window.location.href = at.url;
      });
      bar.appendChild(btn);
    });
  }

  // ---------- Auto-save ----------
  function scheduleSave() {
    clearTimeout(state.saveTimeout);
    state.saveTimeout = setTimeout(() => {
      const col = state.collections.find(c => c.id === state.activeId);
      if (!col) return;
      col.name = document.getElementById("detailName").textContent.trim();
      col.description = document.getElementById("detailDesc").value.trim();
      col.updatedAt = new Date().toISOString();
      saveCollections();
      renderSidebar();
    }, 600);
  }

  // ---------- Actions ----------
  function createCollection() {
    const now = new Date().toISOString();
    const teamId = window.datascope?.activeTeamId || null;
    const col = {
      id: uid(),
      teamId,
      name: "New Collection",
      description: "",
      createdAt: now,
      updatedAt: now,
    };
    state.collections.push(col);
    saveCollections();
    selectCollection(col.id);
    renderSidebar();

    setTimeout(() => {
      const nameEl = document.getElementById("detailName");
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }, 50);
  }

  function deleteCollection() {
    const col = state.collections.find(c => c.id === state.activeId);
    if (!col) return;
    if (!confirm('Delete "' + col.name + '"? Linked items will be unlinked but not deleted.')) return;

    getLinkedCharts(col.id).forEach(c => unlinkChart(c.id));
    getLinkedDecks(col.id).forEach(d => unlinkDeck(d.id));
    getLinkedCards(col.id).forEach(c => unlinkCard(c.id));
    getLinkedNotes(col.id).forEach(n => unlinkNote(n.id));
    getLinkedDocs(col.id).forEach(d => unlinkDoc(d.id));

    state.collections = state.collections.filter(c => c.id !== col.id);
    saveCollections();
    state.activeId = null;
    renderSidebar();
    renderDetail();
  }

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    renderSidebar();
    renderDetail();

    document.getElementById("newCollectionBtn").addEventListener("click", createCollection);
    document.getElementById("deleteCollectionBtn").addEventListener("click", deleteCollection);

    document.getElementById("detailName").addEventListener("input", scheduleSave);
    document.getElementById("detailDesc").addEventListener("input", scheduleSave);

    document.addEventListener("datascope:teamchange", () => {
      state.activeId = null;
      renderSidebar();
      renderDetail();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
