(() => {
  const currentPage = location.pathname.split("/").pop().replace(".html", "") || "index";
  if (currentPage === "auth") return;

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function getSelectedText() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    return sel.toString().trim();
  }

  function getCanvasShapeText() {
    const cv = window._canvasAppState;
    if (!cv) return "";
    if (cv.selected && cv.selected.size === 1) {
      const id = [...cv.selected][0];
      const shape = cv.shapes.find(s => s.id === id);
      if (shape && shape.label) return shape.label.trim();
    }
    if (cv.selectedArrows && cv.selectedArrows.size === 1) {
      const id = [...cv.selectedArrows][0];
      const arrow = cv.arrows.find(a => a.id === id);
      if (arrow && arrow.label) return arrow.label.trim();
    }
    return "";
  }

  function teamId() {
    return window.datascope?.activeTeamId || null;
  }

  const ICONS = {
    note: '<svg viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    board: '<svg viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="11" y="2" width="4" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>',
    slide: '<svg viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 12v2M6 14h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
    canvas: '<svg viewBox="0 0 16 16" fill="none"><text x="3" y="12" font-size="11" font-weight="700" fill="currentColor">T</text><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.1"/></svg>',
    chart: '<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="8" width="3" height="6" rx=".5" stroke="currentColor" stroke-width="1.1"/><rect x="6.5" y="5" width="3" height="9" rx=".5" stroke="currentColor" stroke-width="1.1"/><rect x="11" y="2" width="3" height="12" rx=".5" stroke="currentColor" stroke-width="1.1"/></svg>',
  };

  // ---- Save handlers ----
  function saveAsNote(text) {
    const key = "datascope_notes";
    let notes = [];
    try { const r = localStorage.getItem(key); if (r) notes = JSON.parse(r); } catch (_) {}
    notes.unshift({
      id: uid(), teamId: teamId(),
      title: text.length > 60 ? text.slice(0, 60) + "..." : text,
      body: text, tags: ["highlighted"], dueDate: "", projectId: "",
      colorIdx: 0, pinned: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(notes));
    window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "notes" } }));
    showToast("Saved to Notes", "notes.html");
  }

  function saveToBoard(text) {
    const key = "datascope_kanban";
    const tid = teamId();
    let boards = [];
    try { const r = localStorage.getItem(key); if (r) boards = JSON.parse(r); } catch (_) {}
    if (!Array.isArray(boards)) boards = boards ? [boards] : [];

    let board = boards.find(b => (b.teamId || null) === tid);
    if (!board) {
      board = {
        id: uid(), teamId: tid, boardTitle: tid ? "Team Board" : "My Board",
        columns: [
          { id: uid(), title: "To Do", cards: [] },
          { id: uid(), title: "In Progress", cards: [] },
          { id: uid(), title: "Done", cards: [] },
        ],
      };
      boards.push(board);
    }

    const col = board.columns[0];
    col.cards.push({
      id: uid(), title: text.length > 80 ? text.slice(0, 80) + "..." : text,
      description: text, priority: "medium", cardType: "story", parentId: null,
      startDate: "", dueDate: "", reminder: "", tags: ["highlighted"],
      projectId: "", attachments: { canvases: [], charts: [], decks: [] },
      comments: [], createdAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(boards));
    window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "board" } }));
    showToast("Added to Board", "kanban.html");
  }

  function buildSlide(text) {
    return {
      template: "title-body",
      content: {
        title: text.length > 60 ? text.slice(0, 60) + "..." : text,
        body: text,
      },
      font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      textColor: "#ffffff", bgColor: "#1a1a2e", comments: [],
    };
  }

  function saveToSlides(text) {
    const key = "datascope_slides";
    const tid = teamId();

    // If on slides page, push into live state via event
    if (document.getElementById("slidePreview")) {
      window.dispatchEvent(new CustomEvent("datascope:externalAdd", {
        detail: { target: "slides-push", slide: buildSlide(text), teamId: tid },
      }));
      showToast("Added to Slides", "slides.html");
      return;
    }

    let data = { projects: [], currentProject: 0, currentSlide: 0 };
    try { const r = localStorage.getItem(key); if (r) data = JSON.parse(r); } catch (_) {}
    if (!data.projects) data.projects = [];

    let proj = data.projects.find(p => (p.teamId || null) === tid);
    if (!proj) {
      proj = { id: uid(), teamId: tid, name: "My Deck", projectId: "", slides: [] };
      data.projects.push(proj);
    }

    proj.slides.push(buildSlide(text));
    localStorage.setItem(key, JSON.stringify(data));
    showToast("Added to Slides", "slides.html");
  }

  function buildTextShape(text) {
    const lines = text.split("\n");
    const estH = Math.max(40, lines.length * 20 + 16);
    const estW = Math.max(160, Math.min(400, Math.max(...lines.map(l => l.length)) * 8 + 24));
    return {
      id: uid(), type: "text",
      x: 100 + Math.random() * 200, y: 100 + Math.random() * 200,
      w: estW, h: estH,
      fill: "transparent", stroke: "#6ea8ff", strokeWidth: 1.5,
      label: text, textColor: "#e7ecff", textAlign: "left", fontSize: 14,
    };
  }

  function saveToCanvas(text) {
    const cv = window._canvasAppState;
    if (cv && cv.shapes) {
      cv.shapes.push(buildTextShape(text));
      window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "canvas-draw" } }));
      showToast("Added to Canvas", "canvas.html");
      return;
    }

    const key = "datascope_canvas";
    const tid = teamId();
    let canvases = [];
    try { const r = localStorage.getItem(key); if (r) canvases = JSON.parse(r); } catch (_) {}

    let c = canvases.find(cv2 => (cv2.teamId || null) === tid);
    if (!c) {
      c = { id: uid(), teamId: tid, name: "Canvas 1", shapes: [], arrows: [] };
      canvases.push(c);
    }

    c.shapes.push(buildTextShape(text));
    localStorage.setItem(key, JSON.stringify(canvases));
    showToast("Added to Canvas", "canvas.html");
  }

  function saveToChart(text) {
    const key = "datascope_saved_charts";
    let charts = [];
    try { const r = localStorage.getItem(key); if (r) charts = JSON.parse(r); } catch (_) {}

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const rows = lines.map((line) => [line, 1]);
    const headers = ["Label", "Value"];

    charts.push({
      id: uid(), teamId: teamId(),
      name: text.length > 40 ? text.slice(0, 40) + "..." : text,
      projectId: "", headers: headers, rows: rows,
      colors: ["#6ea8ff", "#8b5cf6"], seriesIndices: [1], xAxisIndex: 0,
      chartType: "bar", stacked: false,
      font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      fontSize: "13", thumbnail: null, savedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(charts));
    window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "charts" } }));
    showToast("Added to Charts", "charts.html");
  }

  // ---- Menu items ----
  const ACTIONS = [
    { label: "Save as Note", icon: "note", handler: saveAsNote },
    { label: "Add to Board", icon: "board", handler: saveToBoard },
    { label: "Add to Slides", icon: "slide", handler: saveToSlides },
    { label: "Add to Canvas", icon: "canvas", handler: saveToCanvas },
    { label: "Add to Charts", icon: "chart", handler: saveToChart },
  ];

  function buildMenuItem(action) {
    const btn = document.createElement("button");
    btn.className = "htn-item";
    btn.innerHTML = ICONS[action.icon] + " " + action.label;
    btn.addEventListener("click", () => {
      const text = pendingText || getSelectedText() || getCanvasShapeText();
      pendingText = null;
      hideMenu();
      hideExistingCtxMenus();
      if (text) action.handler(text);
      window.getSelection()?.removeAllRanges();
    });
    return btn;
  }

  // ---- Standalone menu ----
  let menu = null;
  let pendingText = null;

  function createMenu() {
    const el = document.createElement("div");
    el.className = "htn-menu";
    el.id = "htnMenu";
    el.hidden = true;

    const label = document.createElement("div");
    label.className = "htn-label";
    label.textContent = "Send to...";
    el.appendChild(label);

    ACTIONS.forEach(a => el.appendChild(buildMenuItem(a)));
    document.body.appendChild(el);
    return el;
  }

  function showMenu(x, y) {
    if (!menu) menu = createMenu();
    menu.hidden = false;
    menu.style.left = Math.min(x, window.innerWidth - 200) + "px";
    menu.style.top = Math.min(y, window.innerHeight - (ACTIONS.length * 38 + 40)) + "px";
  }

  function hideMenu() {
    if (menu) menu.hidden = true;
    pendingText = null;
  }

  // ---- Integration with existing context menus (docs + slides) ----
  function injectIntoExistingMenu(menuId) {
    const ctxMenu = document.getElementById(menuId);
    if (!ctxMenu || ctxMenu.querySelector(".htn-sep")) return;

    const sep = document.createElement("div");
    sep.className = "htn-sep";
    ctxMenu.appendChild(sep);

    ACTIONS.forEach(a => {
      const btn = buildMenuItem(a);
      btn.classList.add("ctx-menu-item");
      ctxMenu.appendChild(btn);
    });
  }

  function hideExistingCtxMenus() {
    ["docContextMenu", "slideContextMenu"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  // ---- Toast ----
  function showToast(message, href) {
    const existing = document.querySelector(".htn-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "htn-toast";
    toast.innerHTML = message + ' <a class="htn-toast-link" href="' + href + '">View &rarr;</a>';
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("out");
      toast.addEventListener("animationend", () => toast.remove());
    }, 2500);
  }

  // ---- Context menu listener ----
  function init() {
    injectIntoExistingMenu("docContextMenu");
    injectIntoExistingMenu("slideContextMenu");

    document.addEventListener("contextmenu", (e) => {
      const text = getSelectedText();

      if (e.target.closest(".htn-menu, #docContextMenu, #slideContextMenu")) return;

      // Pages with their own context menus handle the injection path
      const inDocProse = e.target.closest(".doc-prose");
      if (inDocProse && document.getElementById("docContextMenu")) return;

      const inSlidePreview = e.target.closest("#slidePreview [contenteditable]");
      if (inSlidePreview && document.getElementById("slideContextMenu")) return;

      if (text) {
        e.preventDefault();
        pendingText = text;
        showMenu(e.clientX, e.clientY);
        return;
      }

      // Canvas: right-click on a selected shape with a label
      const canvasText = getCanvasShapeText();
      if (canvasText && e.target.closest("#canvas, .canvas-viewport")) {
        e.preventDefault();
        pendingText = canvasText;
        showMenu(e.clientX, e.clientY);
        return;
      }

      hideMenu();
    });

    document.addEventListener("click", (e) => {
      if (menu && !menu.contains(e.target)) hideMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideMenu();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
