// DataScope Shared Tasks — central task store used by Docs, Canvas, and Slides.
(() => {
  const STORE_KEY = "datascope_shared_tasks";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { tasks: [], columns: [] };
  }

  function save(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) {}
  }

  function notify(type, taskId) {
    window.dispatchEvent(new CustomEvent("datascope:taskchange", {
      detail: { type, taskId },
    }));
  }

  const store = load();

  window.addEventListener("storage", (e) => {
    if (e.key === STORE_KEY) {
      const fresh = load();
      store.tasks = fresh.tasks;
      store.columns = fresh.columns;
      notify("external");
    }
  });

  function getTask(id) {
    return store.tasks.find(t => t.id === id) || null;
  }

  function getTasks(ids) {
    return ids.map(id => getTask(id)).filter(Boolean);
  }

  function getAllTasks() {
    return store.tasks;
  }

  function createTask(data) {
    const task = {
      id: uid(),
      text: "",
      colValues: {},
      children: [],
      localColumns: [],
      expanded: false,
      ...data,
    };
    if (!task.id) task.id = uid();
    store.tasks.push(task);
    save(store);
    notify("create", task.id);
    return task;
  }

  function updateTask(id, updates) {
    const task = getTask(id);
    if (!task) return null;
    Object.assign(task, updates);
    save(store);
    notify("update", id);
    return task;
  }

  function deleteTask(id) {
    const idx = store.tasks.findIndex(t => t.id === id);
    if (idx >= 0) {
      store.tasks.splice(idx, 1);
      save(store);
      notify("delete", id);
      return true;
    }
    return false;
  }

  function reorderTasks(ids) {
    const ordered = ids.map(id => getTask(id)).filter(Boolean);
    const rest = store.tasks.filter(t => !ids.includes(t.id));
    store.tasks = [...ordered, ...rest];
    save(store);
  }

  function getColumns() {
    return store.columns;
  }

  function addColumn(col) {
    if (!col.id) col.id = uid();
    store.columns.push(col);
    save(store);
    notify("column-add", col.id);
    return col;
  }

  function deleteColumn(colId) {
    store.columns = store.columns.filter(c => c.id !== colId);
    store.tasks.forEach(task => {
      if (task.colValues) delete task.colValues[colId];
      (task.children || []).forEach(child => {
        if (child.colValues) delete child.colValues[colId];
      });
    });
    save(store);
    notify("column-delete", colId);
  }

  function importTasks(tasks, columns) {
    const idMap = {};
    const imported = [];
    (tasks || []).forEach(t => {
      const existing = store.tasks.find(s => s.id === t.id);
      if (existing) {
        idMap[t.id] = t.id;
        Object.assign(existing, { text: t.text, colValues: t.colValues, children: t.children, localColumns: t.localColumns });
        imported.push(existing);
      } else {
        const newId = t.id || uid();
        idMap[t.id || newId] = newId;
        const task = { ...t, id: newId };
        store.tasks.push(task);
        imported.push(task);
      }
    });
    (columns || []).forEach(col => {
      if (!store.columns.find(c => c.id === col.id)) {
        store.columns.push({ ...col });
      }
    });
    save(store);
    return { idMap, imported };
  }

  function forceSave() {
    save(store);
  }

  function buildTaskPicker({ excludeIds = [], onSelect, anchorEl }) {
    document.querySelector(".shared-task-picker")?.remove();

    const picker = document.createElement("div");
    picker.className = "shared-task-picker";

    const search = document.createElement("input");
    search.type = "text";
    search.className = "stp-search";
    search.placeholder = "Search tasks…";
    picker.appendChild(search);

    const list = document.createElement("div");
    list.className = "stp-list";
    picker.appendChild(list);

    function renderList(filter) {
      list.innerHTML = "";
      const excluded = new Set(excludeIds);
      const available = store.tasks.filter(t =>
        !excluded.has(t.id) &&
        (!filter || (t.text || "").toLowerCase().includes(filter.toLowerCase()))
      );
      if (!available.length) {
        const empty = document.createElement("div");
        empty.className = "stp-empty";
        empty.textContent = filter ? "No matching tasks" : "No available tasks";
        list.appendChild(empty);
        return;
      }
      available.forEach(task => {
        const item = document.createElement("div");
        item.className = "stp-item";
        const label = document.createElement("span");
        label.className = "stp-item-text";
        label.textContent = task.text || "(empty)";
        item.appendChild(label);
        const cols = store.columns;
        if (cols.length) {
          const meta = document.createElement("span");
          meta.className = "stp-item-meta";
          const vals = cols.map(c => (task.colValues || {})[c.id]).filter(Boolean);
          meta.textContent = vals.slice(0, 2).join(", ");
          item.appendChild(meta);
        }
        item.addEventListener("click", () => {
          onSelect(task.id);
          picker.remove();
          document.removeEventListener("click", dismiss, true);
        });
        list.appendChild(item);
      });
    }

    search.addEventListener("input", () => renderList(search.value));
    renderList("");

    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      picker.style.top = (rect.bottom + 4) + "px";
      picker.style.left = Math.max(10, rect.left) + "px";
    }

    document.body.appendChild(picker);

    function dismiss(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener("click", dismiss, true);
      }
    }
    setTimeout(() => {
      document.addEventListener("click", dismiss, true);
      search.focus();
    }, 0);

    return picker;
  }

  // Inject picker styles
  const style = document.createElement("style");
  style.textContent = `
.shared-task-picker {
  position: fixed; width: 280px; max-height: 320px;
  background: #1a1f3a; border: 1px solid #2d3555; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4); overflow: hidden; z-index: 300;
  display: flex; flex-direction: column;
}
.stp-search {
  width: 100%; padding: 8px 12px; border: none;
  border-bottom: 1px solid #2d3555; background: #141829;
  color: #e7ecff; font-size: 13px; outline: none; flex-shrink: 0;
  box-sizing: border-box;
}
.stp-search::placeholder { color: #6b7a99; }
.stp-list { flex: 1; overflow-y: auto; }
.stp-item {
  padding: 8px 12px; cursor: pointer; color: #c8d0e7; font-size: 13px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}
.stp-item:hover { background: rgba(110, 168, 255, 0.1); }
.stp-item-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stp-item-meta { font-size: 11px; color: #6b7a99; flex-shrink: 0; }
.stp-empty { padding: 16px; text-align: center; color: #6b7a99; font-size: 13px; font-style: italic; }
`;
  document.head.appendChild(style);

  if (!window.datascope) window.datascope = {};
  window.datascope.sharedTasks = {
    uid,
    getTask,
    getTasks,
    getAllTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    getColumns,
    addColumn,
    deleteColumn,
    importTasks,
    forceSave,
    buildTaskPicker,
    _store: store,
  };
})();
