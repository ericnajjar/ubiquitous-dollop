// DataScope Version History — shared snapshot system for Canvas, Slides, and Docs.
(() => {
  const MAX_VERSIONS = 30;
  const DEBOUNCE_MS = 60000;

  const lastSaveTime = {};

  function storeKey(key) { return key + "_versions"; }

  function loadStore(key) {
    try { return JSON.parse(localStorage.getItem(storeKey(key))) || {}; }
    catch { return {}; }
  }

  function writeStore(key, data) {
    try { localStorage.setItem(storeKey(key), JSON.stringify(data)); }
    catch {}
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function saveSnapshot(key, itemId, snapshot, force) {
    if (!itemId) return;
    const ck = key + ":" + itemId;
    const now = Date.now();
    if (!force && lastSaveTime[ck] && (now - lastSaveTime[ck]) < DEBOUNCE_MS) return;

    const store = loadStore(key);
    if (!store[itemId]) store[itemId] = [];

    store[itemId].push({
      id: uid(),
      timestamp: new Date().toISOString(),
      snapshot: JSON.parse(JSON.stringify(snapshot)),
    });

    if (store[itemId].length > MAX_VERSIONS) {
      store[itemId] = store[itemId].slice(-MAX_VERSIONS);
    }

    writeStore(key, store);
    lastSaveTime[ck] = now;
  }

  function getSnapshots(key, itemId) {
    if (!itemId) return [];
    const store = loadStore(key);
    return (store[itemId] || []).slice().reverse();
  }

  function deleteSnapshot(key, itemId, versionId) {
    const store = loadStore(key);
    if (!store[itemId]) return;
    store[itemId] = store[itemId].filter(v => v.id !== versionId);
    writeStore(key, store);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return diffMin + "m ago";
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return diffH + "h ago";
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function openPanel(key, itemId, opts) {
    const { onRestore, formatLabel, getCurrentData } = opts;
    closePanel();

    const backdrop = document.createElement("div");
    backdrop.className = "vh-backdrop";
    backdrop.id = "vhBackdrop";

    const panel = document.createElement("div");
    panel.className = "vh-panel";

    const header = document.createElement("div");
    header.className = "vh-header";
    const title = document.createElement("h3");
    title.textContent = "Version History";
    const closeBtn = document.createElement("button");
    closeBtn.className = "vh-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => closePanel());
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const list = document.createElement("div");
    list.className = "vh-list";

    const versions = getSnapshots(key, itemId);

    if (!versions.length) {
      const empty = document.createElement("p");
      empty.className = "vh-empty";
      empty.textContent = "No versions saved yet. Versions are created automatically as you work.";
      list.appendChild(empty);
    }

    versions.forEach((ver, i) => {
      const item = document.createElement("div");
      item.className = "vh-item";
      if (i === 0) item.classList.add("vh-current");

      const meta = document.createElement("div");
      meta.className = "vh-meta";

      const time = document.createElement("span");
      time.className = "vh-time";
      time.textContent = formatTime(ver.timestamp);
      meta.appendChild(time);

      if (i === 0) {
        const badge = document.createElement("span");
        badge.className = "vh-badge";
        badge.textContent = "Latest";
        meta.appendChild(badge);
      }

      item.appendChild(meta);

      if (formatLabel) {
        const label = document.createElement("div");
        label.className = "vh-label";
        label.textContent = formatLabel(ver.snapshot);
        item.appendChild(label);
      }

      const actions = document.createElement("div");
      actions.className = "vh-actions";

      if (i > 0) {
        const restoreBtn = document.createElement("button");
        restoreBtn.className = "vh-restore-btn";
        restoreBtn.textContent = "Restore";
        restoreBtn.addEventListener("click", () => {
          if (!confirm("Restore this version? Current changes will be saved as a new version first.")) return;
          if (getCurrentData) saveSnapshot(key, itemId, getCurrentData(), true);
          onRestore(ver.snapshot);
          closePanel();
        });
        actions.appendChild(restoreBtn);
      }

      const delBtn = document.createElement("button");
      delBtn.className = "vh-delete-btn";
      delBtn.textContent = "Remove";
      delBtn.addEventListener("click", () => {
        deleteSnapshot(key, itemId, ver.id);
        item.remove();
        const remaining = list.querySelectorAll(".vh-item");
        if (!remaining.length) {
          const empty = document.createElement("p");
          empty.className = "vh-empty";
          empty.textContent = "No versions saved yet.";
          list.appendChild(empty);
        }
      });
      actions.appendChild(delBtn);

      item.appendChild(actions);
      list.appendChild(item);
    });

    panel.appendChild(list);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePanel();
    });

    document.addEventListener("keydown", handleEsc);
  }

  function handleEsc(e) {
    if (e.key === "Escape") closePanel();
  }

  function closePanel() {
    const existing = document.getElementById("vhBackdrop");
    if (existing) existing.remove();
    document.removeEventListener("keydown", handleEsc);
  }

  window.datascope = window.datascope || {};
  window.datascope.versions = {
    saveSnapshot,
    getSnapshots,
    deleteSnapshot,
    openPanel,
    closePanel,
  };
})();
