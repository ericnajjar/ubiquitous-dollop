(() => {
  const NOTES_KEY = "datascope_notes";
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

  let menu = null;

  function createMenu() {
    const el = document.createElement("div");
    el.className = "htn-menu";
    el.id = "htnMenu";
    el.hidden = true;

    el.appendChild(buildNoteButton());
    document.body.appendChild(el);
    return el;
  }

  function buildNoteButton() {
    const btn = document.createElement("button");
    btn.className = "htn-item";
    btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> Save as Note';
    btn.addEventListener("click", handleSaveAsNote);
    return btn;
  }

  function showMenu(x, y) {
    if (!menu) menu = createMenu();
    menu.hidden = false;
    menu.style.left = Math.min(x, window.innerWidth - 180) + "px";
    menu.style.top = Math.min(y, window.innerHeight - 50) + "px";
  }

  function hideMenu() {
    if (menu) menu.hidden = true;
  }

  function saveSelectedAsNote() {
    const text = getSelectedText();
    if (!text) return;

    const title = text.length > 60 ? text.slice(0, 60) + "..." : text;
    const now = new Date().toISOString();
    const teamId = window.datascope?.activeTeamId || null;

    const note = {
      id: uid(),
      teamId: teamId,
      title: title,
      body: text,
      tags: ["highlighted"],
      dueDate: "",
      projectId: "",
      colorIdx: 0,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };

    let notes = [];
    try {
      const raw = localStorage.getItem(NOTES_KEY);
      if (raw) notes = JSON.parse(raw);
    } catch (_) {}

    notes.unshift(note);
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));

    window.getSelection()?.removeAllRanges();
    showToast();
  }

  function handleSaveAsNote() {
    hideMenu();
    hideDocsCtxBtn();
    saveSelectedAsNote();
  }

  function showToast() {
    const existing = document.querySelector(".htn-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "htn-toast";
    toast.innerHTML = 'Saved to Notes <a class="htn-toast-link" href="notes.html">View &rarr;</a>';
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("out");
      toast.addEventListener("animationend", () => toast.remove());
    }, 2500);
  }

  let docsCtxBtn = null;

  function injectIntoDocsMenu() {
    const docsMenu = document.getElementById("docContextMenu");
    if (!docsMenu) return false;
    if (!docsMenu.querySelector(".htn-item")) {
      docsCtxBtn = buildNoteButton();
      docsCtxBtn.classList.add("ctx-menu-item");
      docsMenu.appendChild(docsCtxBtn);
    }
    return true;
  }

  function hideDocsCtxBtn() {
    const docsMenu = document.getElementById("docContextMenu");
    if (docsMenu) docsMenu.hidden = true;
  }

  function init() {
    injectIntoDocsMenu();

    document.addEventListener("contextmenu", (e) => {
      const text = getSelectedText();
      if (!text) {
        hideMenu();
        return;
      }

      if (e.target.closest(".htn-menu, #docContextMenu")) return;

      const inDocProse = e.target.closest(".doc-prose");
      if (inDocProse && document.getElementById("docContextMenu")) return;

      if (e.target.closest("input, textarea, [contenteditable='true']") && !inDocProse) return;

      e.preventDefault();
      showMenu(e.clientX, e.clientY);
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
