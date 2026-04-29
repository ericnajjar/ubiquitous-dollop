// DataScope Docs — simple document editor for user stories and acceptance criteria.
(() => {
  const STORE_KEY = "datascope_docs";
  const PROJECTS_KEY = "datascope_projects";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function loadDocs() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  const FOLDERS_KEY = "datascope_doc_folders";

  function saveDocs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.docs)); } catch (_) {}
    st().forceSave();
    const doc = currentDoc();
    if (doc && window.datascope?.versions) {
      const tasks = getDocTasks(doc);
      window.datascope.versions.saveSnapshot(STORE_KEY, doc.id, {
        title: doc.title,
        body: doc.body,
        blocks: doc.blocks,
        tasks: tasks,
        taskColumns: st().getColumns(),
        stories: doc.stories,
        comments: doc.comments,
      });
    }
  }

  function openVersionHistory() {
    const doc = currentDoc();
    if (!doc || !window.datascope?.versions) return;
    window.datascope.versions.openPanel(STORE_KEY, doc.id, {
      formatLabel(snap) {
        const title = snap.title || "Untitled";
        const tasks = (snap.tasks || []).length;
        let desc = title;
        if (tasks) desc += " — " + tasks + " task" + (tasks !== 1 ? "s" : "");
        return desc;
      },
      getCurrentData() {
        saveAllProse();
        const tasks = getDocTasks(doc);
        return {
          title: doc.title, body: doc.body, blocks: doc.blocks,
          tasks, taskColumns: st().getColumns(),
          stories: doc.stories, comments: doc.comments,
        };
      },
      onRestore(snap) {
        doc.title = snap.title || doc.title;
        doc.body = snap.body || "";
        doc.blocks = snap.blocks || null;
        if (snap.tasks) st().importTasks(snap.tasks, snap.taskColumns || []);
        doc.stories = snap.stories || [];
        doc.comments = snap.comments || [];
        saveDocs();
        renderEditor();
        renderSidebar();
      },
    });
  }

  function loadFolders() {
    try {
      const raw = localStorage.getItem(FOLDERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function saveFolders() {
    try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(state.folders)); } catch (_) {}
  }

  function loadProjects() {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  const state = {
    docs: loadDocs(),
    folders: loadFolders(),
    currentDocId: null,
    openFolders: new Set(),
  };

  function st() { return window.datascope.sharedTasks; }

  function migrateDocsToSharedTasks() {
    const shared = st();
    state.docs.forEach(doc => {
      if (doc.tasks && doc.tasks.length) {
        shared.importTasks(doc.tasks, doc.taskColumns || []);
        delete doc.tasks;
        delete doc.taskColumns;
      } else if (doc.taskColumns && doc.taskColumns.length) {
        shared.importTasks([], doc.taskColumns);
        delete doc.taskColumns;
      }
    });
    saveDocs();
  }

  function getDocTasks(doc) {
    if (!doc || !doc.blocks) return [];
    const ids = [];
    doc.blocks.forEach(b => { if (b.type === "tasks" && b.taskIds) ids.push(...b.taskIds); });
    return st().getTasks(ids);
  }

  function currentDoc() {
    return state.docs.find((d) => d.id === state.currentDocId) || null;
  }

  function teamFilteredDocs() {
    const teamId = window.datascope?.activeTeamId || null;
    return state.docs.filter(d => (d.teamId || null) === teamId);
  }

  // ---------- Sidebar ----------
  function renderSidebar() {
    const list = document.getElementById("sidebarList");
    const empty = document.getElementById("docListEmpty");
    list.innerHTML = "";

    const docs = teamFilteredDocs();
    const teamId = window.datascope?.activeTeamId || null;
    const folders = state.folders.filter(f => (f.teamId || null) === teamId);

    if (!docs.length && !folders.length) { empty.hidden = false; return; }
    empty.hidden = true;

    folders.forEach(folder => {
      const docsInFolder = docs.filter(d => d.folderId === folder.id);
      list.appendChild(buildSidebarFolder(folder, docsInFolder));
    });

    const ungrouped = docs.filter(d => !d.folderId || !folders.find(f => f.id === d.folderId));
    ungrouped.forEach(doc => {
      list.appendChild(buildSidebarDoc(doc, false));
    });
  }

  function buildSidebarDoc(doc, nested) {
    const el = document.createElement("div");
    el.className = "sidebar-doc" + (nested ? " nested" : "") + (doc.id === state.currentDocId ? " active" : "");
    const name = document.createElement("span");
    name.className = "sidebar-doc-name";
    name.textContent = doc.title || "Untitled";
    const arrow = document.createElement("span");
    arrow.className = "sidebar-doc-arrow";
    arrow.textContent = "›";
    el.appendChild(name);
    el.appendChild(arrow);
    el.addEventListener("click", () => selectDoc(doc.id));
    return el;
  }

  function buildSidebarFolder(folder, docs) {
    const el = document.createElement("div");
    el.className = "sidebar-folder" + (state.openFolders.has(folder.id) ? " open" : "");

    const header = document.createElement("div");
    header.className = "sidebar-folder-header";

    const toggle = document.createElement("span");
    toggle.className = "sidebar-folder-toggle";
    toggle.textContent = "▸";

    const name = document.createElement("span");
    name.className = "sidebar-folder-name";
    name.textContent = folder.name || "Untitled Folder";

    const count = document.createElement("span");
    count.className = "sidebar-folder-count";
    count.textContent = docs.length || "";

    const actions = document.createElement("div");
    actions.className = "sidebar-folder-actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "sidebar-folder-action";
    renameBtn.textContent = "✎";
    renameBtn.title = "Rename folder";
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      startFolderRename(folder, name);
    });

    const delBtn = document.createElement("button");
    delBtn.className = "sidebar-folder-action danger";
    delBtn.textContent = "×";
    delBtn.title = "Delete folder";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteFolder(folder.id);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    header.appendChild(toggle);
    header.appendChild(name);
    header.appendChild(count);
    header.appendChild(actions);
    el.appendChild(header);

    const children = document.createElement("div");
    children.className = "sidebar-folder-children";
    docs.forEach(doc => {
      children.appendChild(buildSidebarDoc(doc, true));
    });
    el.appendChild(children);

    header.addEventListener("click", () => {
      if (state.openFolders.has(folder.id)) {
        state.openFolders.delete(folder.id);
      } else {
        state.openFolders.add(folder.id);
      }
      el.classList.toggle("open", state.openFolders.has(folder.id));
    });

    return el;
  }

  function startFolderRename(folder, nameEl) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sidebar-folder-rename";
    input.value = folder.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    function finish() {
      const val = input.value.trim();
      if (val) folder.name = val;
      saveFolders();
      renderSidebar();
    }
    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = folder.name; input.blur(); }
    });
  }

  // ---------- Folder actions ----------
  function createFolder() {
    const teamId = window.datascope?.activeTeamId || null;
    const folder = { id: uid(), teamId, name: "New Folder" };
    state.folders.push(folder);
    state.openFolders.add(folder.id);
    saveFolders();
    renderSidebar();
    const el = document.querySelector(`.sidebar-folder-name`);
    if (el) startFolderRename(folder, el);
  }

  function deleteFolder(folderId) {
    if (!confirm("Delete this folder? Documents inside will be moved out, not deleted.")) return;
    state.docs.forEach(d => { if (d.folderId === folderId) d.folderId = null; });
    state.folders = state.folders.filter(f => f.id !== folderId);
    saveDocs();
    saveFolders();
    renderSidebar();
  }

  // ---------- Editor ----------
  function bodyToHtml(body) {
    if (!body) return "";
    if (body.includes("<")) return body;
    return body.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("") || "";
  }

  // ---------- Document Blocks ----------
  let activeProse = null;

  function ensureBlocks(doc) {
    if (Array.isArray(doc.blocks)) return;
    doc.blocks = [];
    if (doc.body) doc.blocks.push({ id: uid(), type: "prose", content: doc.body });
    if (doc.tasks && doc.tasks.length) {
      st().importTasks(doc.tasks, doc.taskColumns || []);
      doc.blocks.push({ id: uid(), type: "tasks", taskIds: doc.tasks.map(t => t.id) });
      delete doc.tasks;
      delete doc.taskColumns;
    }
    if (!doc.blocks.length) doc.blocks.push({ id: uid(), type: "prose", content: "" });
  }

  function saveAllProse() {
    const doc = currentDoc();
    if (!doc || !doc.blocks) return;
    document.querySelectorAll(".doc-prose[data-block-id]").forEach(el => {
      const block = doc.blocks.find(b => b.id === el.dataset.blockId);
      if (block && block.type === "prose") block.content = el.innerHTML;
    });
    doc.body = doc.blocks.filter(b => b.type === "prose").map(b => b.content || "").join("\n");
  }

  function renderBlocks(tasksOnly) {
    const doc = currentDoc();
    const container = document.getElementById("docBlocks");
    if (!doc) { container.innerHTML = ""; return; }
    ensureBlocks(doc);

    if (tasksOnly) {
      container.querySelectorAll(".doc-task-block").forEach(el => {
        const block = doc.blocks.find(b => b.id === el.dataset.blockId);
        if (block) el.replaceWith(buildTaskBlock(block, doc));
      });
      return;
    }

    saveAllProse();
    container.innerHTML = "";
    container.appendChild(buildBlockInsert(0));
    doc.blocks.forEach((block, i) => {
      if (block.type === "prose") container.appendChild(buildProseBlock(block));
      else if (block.type === "tasks") container.appendChild(buildTaskBlock(block, doc));
      container.appendChild(buildBlockInsert(i + 1));
    });
  }

  function buildProseBlock(block) {
    const wrap = document.createElement("div");
    wrap.className = "doc-block doc-prose-block";
    wrap.dataset.blockId = block.id;

    const prose = document.createElement("div");
    prose.className = "doc-prose";
    prose.contentEditable = "true";
    prose.dataset.blockId = block.id;
    prose.dataset.placeholder = "Start writing…";
    prose.innerHTML = bodyToHtml(block.content || "");

    prose.addEventListener("focus", () => {
      activeProse = prose;
      document.getElementById("proseToolbar").hidden = false;
    });

    prose.addEventListener("input", () => {
      block.content = prose.innerHTML;
      const doc = currentDoc();
      if (doc) {
        doc.body = doc.blocks.filter(b => b.type === "prose").map(b => b.content || "").join("\n");
        doc.updatedAt = new Date().toISOString();
        saveDocs();
      }
    });

    prose.addEventListener("click", (e) => {
      const mark = e.target.closest("mark[data-comment-id]");
      if (mark) highlightCommentInProse(mark.dataset.commentId);
    });

    wrap.appendChild(prose);
    return wrap;
  }

  function buildTaskBlock(block, doc) {
    const wrap = document.createElement("div");
    wrap.className = "doc-block doc-task-block";
    wrap.dataset.blockId = block.id;

    const tasks = st().getTasks(block.taskIds || []);

    const header = document.createElement("div");
    header.className = "tasks-header";

    const label = document.createElement("span");
    label.className = "tasks-label";
    label.textContent = "Tasks";
    header.appendChild(label);

    const colChips = document.createElement("div");
    colChips.className = "tasks-col-chips";
    st().getColumns().forEach(col => {
      const chip = document.createElement("span");
      chip.className = "tasks-col-chip";
      const name = document.createElement("span");
      name.textContent = col.name;
      const del = document.createElement("button");
      del.className = "tasks-col-chip-del";
      del.textContent = "x";
      del.title = "Remove global column";
      del.addEventListener("click", (e) => { e.stopPropagation(); deleteGlobalColumn(col.id); });
      chip.appendChild(name);
      chip.appendChild(del);
      colChips.appendChild(chip);
    });
    header.appendChild(colChips);

    const addColBtn = document.createElement("button");
    addColBtn.className = "btn btn-ghost btn-sm";
    addColBtn.textContent = "+ Column";
    addColBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showAddColumnPopup(addColBtn, "global", null);
    });
    header.appendChild(addColBtn);

    const addTaskBtn = document.createElement("button");
    addTaskBtn.className = "btn btn-ghost btn-sm";
    addTaskBtn.textContent = "+ Task";
    addTaskBtn.addEventListener("click", () => addTaskToBlock(block.id));
    header.appendChild(addTaskBtn);

    const linkTaskBtn = document.createElement("button");
    linkTaskBtn.className = "btn btn-ghost btn-sm";
    linkTaskBtn.textContent = "Link";
    linkTaskBtn.title = "Link existing task from other tools";
    linkTaskBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showTaskPicker(linkTaskBtn, block);
    });
    header.appendChild(linkTaskBtn);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-ghost btn-sm danger";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove task block";
    removeBtn.addEventListener("click", () => removeBlock(block.id));
    header.appendChild(removeBtn);

    wrap.appendChild(header);

    const list = document.createElement("div");
    list.className = "tasks-list";
    tasks.forEach(task => list.appendChild(buildTaskRow(task, block)));
    wrap.appendChild(list);

    return wrap;
  }

  function buildBlockInsert(position) {
    const row = document.createElement("div");
    row.className = "block-insert-row";
    const btn = document.createElement("button");
    btn.className = "block-insert-btn";
    btn.textContent = "+";
    btn.title = "Insert block";
    btn.addEventListener("click", () => showBlockMenu(btn, position));
    row.appendChild(btn);
    return row;
  }

  function showBlockMenu(anchor, position) {
    document.querySelector(".block-menu")?.remove();
    const menu = document.createElement("div");
    menu.className = "block-menu";

    [["prose", "Text"], ["tasks", "Task Table"]].forEach(([type, label]) => {
      const btn = document.createElement("button");
      btn.className = "block-menu-item";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        insertBlock(position, type);
        menu.remove();
      });
      menu.appendChild(btn);
    });

    const rect = anchor.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.top = (rect.bottom + 4) + "px";
    menu.style.left = Math.max(10, rect.left - 30) + "px";
    menu.style.zIndex = "200";
    document.body.appendChild(menu);

    setTimeout(() => {
      const dismiss = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", dismiss, true); }
      };
      document.addEventListener("click", dismiss, true);
    }, 0);
  }

  function insertBlock(position, type) {
    const doc = currentDoc();
    if (!doc) return;
    ensureBlocks(doc);
    saveAllProse();

    const block = { id: uid(), type };
    if (type === "prose") {
      block.content = "";
    } else if (type === "tasks") {
      const task = st().createTask({ text: "" });
      block.taskIds = [task.id];
    }

    doc.blocks.splice(position, 0, block);
    saveDocs();
    renderBlocks(false);

    if (type === "prose") {
      setTimeout(() => {
        const el = document.querySelector(`.doc-prose[data-block-id="${block.id}"]`);
        if (el) el.focus();
      }, 50);
    } else if (type === "tasks") {
      setTimeout(() => {
        const rows = document.querySelectorAll(`.doc-task-block[data-block-id="${block.id}"] .task-text`);
        if (rows.length) rows[rows.length - 1].focus();
      }, 50);
    }
  }

  function removeBlock(blockId) {
    const doc = currentDoc();
    if (!doc) return;
    const block = doc.blocks.find(b => b.id === blockId);
    if (!block) return;

    if (block.type === "tasks") {
      (block.taskIds || []).forEach(id => st().deleteTask(id));
    }

    doc.blocks = doc.blocks.filter(b => b.id !== blockId);
    if (!doc.blocks.length) doc.blocks.push({ id: uid(), type: "prose", content: "" });
    saveDocs();
    renderBlocks(false);
  }

  function addTaskToBlock(blockId) {
    const doc = currentDoc();
    if (!doc) return;
    const block = doc.blocks.find(b => b.id === blockId);
    if (!block || block.type !== "tasks") return;
    const task = st().createTask({ text: "" });
    if (!block.taskIds) block.taskIds = [];
    block.taskIds.push(task.id);
    saveDocs();
    renderBlocks(true);
    setTimeout(() => {
      const rows = document.querySelectorAll(`.doc-task-block[data-block-id="${blockId}"] .task-text`);
      if (rows.length) rows[rows.length - 1].focus();
    }, 50);
  }

  function renderEditor() {
    const doc = currentDoc();
    const storiesContainer = document.getElementById("storiesContainer");
    const emptyMsg = document.getElementById("editorEmpty");
    const divider = document.getElementById("storiesDivider");
    const titleInput = document.getElementById("docTitle");
    const deleteBtn = document.getElementById("deleteDocBtn");
    const addStoryBtn = document.getElementById("addStoryBtn");
    const addTaskBtn2 = document.getElementById("addTaskBtn2");
    const toolbar = document.getElementById("proseToolbar");
    const blocksContainer = document.getElementById("docBlocks");
    const editorHeader = document.getElementById("editorHeader");

    if (!doc) {
      emptyMsg.hidden = false;
      editorHeader.hidden = true;
      toolbar.hidden = true;
      blocksContainer.innerHTML = "";
      divider.hidden = true;
      storiesContainer.innerHTML = "";
      titleInput.value = "";
      titleInput.disabled = true;
      deleteBtn.hidden = true;
      addStoryBtn.hidden = true;
      if (addTaskBtn2) addTaskBtn2.hidden = true;
      populateProjectSelect("");
      populateFolderSelect("");
      renderComments();
      return;
    }

    emptyMsg.hidden = true;
    editorHeader.hidden = false;
    toolbar.hidden = false;
    titleInput.disabled = false;
    titleInput.value = doc.title;
    deleteBtn.hidden = false;
    addStoryBtn.hidden = false;
    if (addTaskBtn2) addTaskBtn2.hidden = false;
    populateProjectSelect(doc.projectId || "");
    populateFolderSelect(doc.folderId || "");

    const moveWrap = document.getElementById("docMoveWrap");
    moveWrap.innerHTML = "";
    const ds = window.datascope;
    if (ds?.userTeams?.length) {
      const lbl = document.createElement("label");
      lbl.className = "team-move-label";
      lbl.textContent = "Owner";
      moveWrap.appendChild(lbl);
      const sel = ds.buildTeamMoveSelect(doc.teamId || null);
      sel.addEventListener("change", () => {
        doc.teamId = sel.value || null;
        doc.updatedAt = new Date().toISOString();
        saveDocs();
        renderSidebar();
      });
      moveWrap.appendChild(sel);
    }

    renderBlocks(false);

    divider.hidden = doc.stories.length === 0;
    storiesContainer.innerHTML = "";
    doc.stories.forEach((story, idx) => {
      storiesContainer.appendChild(buildStoryBlock(story, idx));
    });

    renderComments();
  }

  // ---------- Tasks ----------
  let dragSrcTaskId = null;
  let dragSrcChildInfo = null;

  function clearDropIndicators() {
    document.querySelectorAll(".task-row.drop-above, .task-row.drop-below")
      .forEach((el) => el.classList.remove("drop-above", "drop-below"));
  }

  function clearChildDropIndicators() {
    document.querySelectorAll(".task-child-row.drop-above, .task-child-row.drop-below")
      .forEach((el) => el.classList.remove("drop-above", "drop-below"));
  }

  function buildColField(item, col, onDelete) {
    const field = document.createElement("div");
    field.className = "task-col-field";
    const labelRow = document.createElement("div");
    labelRow.className = "task-col-label-row";
    const label = document.createElement("span");
    label.className = "task-col-label";
    label.textContent = col.name;
    labelRow.appendChild(label);
    if (onDelete) {
      const del = document.createElement("button");
      del.className = "task-col-del";
      del.textContent = "×";
      del.title = "Remove column";
      del.addEventListener("click", (e) => { e.stopPropagation(); onDelete(); });
      labelRow.appendChild(del);
    }
    field.appendChild(labelRow);

    const colType = col.type || "text";
    const currentVal = (item.colValues || {})[col.id] || "";

    if (colType === "dropdown") {
      const sel = document.createElement("select");
      sel.className = "task-col-select";
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "—";
      sel.appendChild(emptyOpt);
      (col.options || []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (opt === currentVal) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => {
        if (!item.colValues) item.colValues = {};
        item.colValues[col.id] = sel.value;
        saveDocs();
      });
      field.appendChild(sel);
    } else if (colType === "tags") {
      const tagsWrap = document.createElement("div");
      tagsWrap.className = "task-col-tags";
      const selected = currentVal ? currentVal.split(",").filter(Boolean) : [];
      (col.options || []).forEach((tag, ti) => {
        const chip = document.createElement("button");
        chip.className = "task-tag-chip";
        if (selected.includes(tag)) chip.classList.add("active");
        chip.style.setProperty("--tag-hue", (ti * 47 + 200) % 360);
        chip.textContent = tag;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = selected.indexOf(tag);
          if (idx >= 0) { selected.splice(idx, 1); chip.classList.remove("active"); }
          else { selected.push(tag); chip.classList.add("active"); }
          if (!item.colValues) item.colValues = {};
          item.colValues[col.id] = selected.join(",");
          saveDocs();
        });
        tagsWrap.appendChild(chip);
      });
      field.appendChild(tagsWrap);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "task-col-input";
      input.value = currentVal;
      input.placeholder = "—";
      input.addEventListener("input", () => {
        if (!item.colValues) item.colValues = {};
        item.colValues[col.id] = input.value;
        saveDocs();
      });
      field.appendChild(input);
    }

    return field;
  }

  function deleteGlobalColumn(colId) {
    st().deleteColumn(colId);
    saveDocs();
    renderTasks();
  }

  function deleteLocalColumn(task, colId) {
    task.localColumns = (task.localColumns || []).filter((c) => c.id !== colId);
    if (task.colValues) delete task.colValues[colId];
    (task.children || []).forEach((child) => {
      if (child.colValues) delete child.colValues[colId];
    });
    saveDocs();
    renderTasks();
  }

  function showAddColumnPopup(anchor, defaultScope, relatedTaskId) {
    document.querySelector(".add-col-popup")?.remove();
    const doc = currentDoc();
    if (!doc) return;

    const popup = document.createElement("div");
    popup.className = "add-col-popup";

    const titleEl = document.createElement("div");
    titleEl.className = "acp-title";
    titleEl.textContent = "New Column";
    popup.appendChild(titleEl);

    const nameWrap = document.createElement("div");
    nameWrap.className = "acp-field";
    const nameLbl = document.createElement("label");
    nameLbl.className = "acp-label";
    nameLbl.textContent = "Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "acp-input";
    nameInput.placeholder = "e.g. Status, Owner, Sprint…";
    nameWrap.appendChild(nameLbl);
    nameWrap.appendChild(nameInput);
    popup.appendChild(nameWrap);

    const scopeWrap = document.createElement("div");
    scopeWrap.className = "acp-scope";
    const scopeLbl = document.createElement("div");
    scopeLbl.className = "acp-label";
    scopeLbl.textContent = "Scope";
    const scopeOpts = document.createElement("div");
    scopeOpts.className = "acp-scope-options";
    ["global", "local"].forEach((s) => {
      const lbl = document.createElement("label");
      lbl.className = "acp-scope-option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "acp-scope-radio";
      radio.value = s;
      radio.checked = s === defaultScope;
      const txt = document.createElement("span");
      txt.textContent = s === "global" ? "Global — all tasks" : "Local — one task only";
      lbl.appendChild(radio);
      lbl.appendChild(txt);
      scopeOpts.appendChild(lbl);
    });
    scopeWrap.appendChild(scopeLbl);
    scopeWrap.appendChild(scopeOpts);
    popup.appendChild(scopeWrap);

    let taskSelWrap = null;
    if (relatedTaskId === null) {
      taskSelWrap = document.createElement("div");
      taskSelWrap.className = "acp-field";
      taskSelWrap.hidden = defaultScope === "global";
      const taskSelLbl = document.createElement("label");
      taskSelLbl.className = "acp-label";
      taskSelLbl.textContent = "Apply to task";
      const taskSel = document.createElement("select");
      taskSel.className = "acp-select";
      taskSel.id = "acp-task-sel";
      const allTasks = getDocTasks(doc);
      if (allTasks.length) {
        allTasks.forEach((t) => {
          const opt = document.createElement("option");
          opt.value = t.id;
          opt.textContent = t.text || "Untitled task";
          taskSel.appendChild(opt);
        });
      } else {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No tasks yet";
        taskSel.appendChild(opt);
      }
      taskSelWrap.appendChild(taskSelLbl);
      taskSelWrap.appendChild(taskSel);
      popup.appendChild(taskSelWrap);

      scopeOpts.querySelectorAll("input[type='radio']").forEach((r) => {
        r.addEventListener("change", () => {
          const sel = popup.querySelector("input[name='acp-scope-radio']:checked")?.value;
          taskSelWrap.hidden = sel !== "local";
        });
      });
    }

    const typeWrap = document.createElement("div");
    typeWrap.className = "acp-field";
    const typeLbl = document.createElement("label");
    typeLbl.className = "acp-label";
    typeLbl.textContent = "Type";
    const typeSel = document.createElement("select");
    typeSel.className = "acp-select";
    [["text", "Text"], ["dropdown", "Dropdown"], ["tags", "Tags"]].forEach(([val, txt]) => {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = txt;
      typeSel.appendChild(o);
    });
    typeWrap.appendChild(typeLbl);
    typeWrap.appendChild(typeSel);
    popup.appendChild(typeWrap);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "acp-field";
    optionsWrap.hidden = true;
    const optionsLbl = document.createElement("label");
    optionsLbl.className = "acp-label";
    optionsLbl.textContent = "Options (one per line)";
    const optionsInput = document.createElement("textarea");
    optionsInput.className = "acp-textarea";
    optionsInput.rows = 3;
    optionsInput.placeholder = "e.g.\nTo Do\nIn Progress\nDone";
    optionsWrap.appendChild(optionsLbl);
    optionsWrap.appendChild(optionsInput);
    popup.appendChild(optionsWrap);

    typeSel.addEventListener("change", () => {
      optionsWrap.hidden = typeSel.value === "text";
      optionsLbl.textContent = typeSel.value === "tags" ? "Tags (one per line)" : "Options (one per line)";
    });

    const addBtn = document.createElement("button");
    addBtn.className = "btn btn-primary btn-sm acp-add-btn";
    addBtn.textContent = "Add Column";
    addBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const colType = typeSel.value;
      const options = colType !== "text"
        ? optionsInput.value.split("\n").map(s => s.trim()).filter(Boolean)
        : [];
      if (colType !== "text" && !options.length) { optionsInput.focus(); return; }
      const colDef = { id: uid(), name, type: colType };
      if (options.length) colDef.options = options;
      const scope = popup.querySelector("input[name='acp-scope-radio']:checked")?.value || "global";
      if (scope === "global") {
        st().addColumn(colDef);
      } else {
        const taskId = relatedTaskId !== null ? relatedTaskId : (popup.querySelector("#acp-task-sel")?.value || null);
        if (!taskId) return;
        const task = st().getTask(taskId);
        if (!task) return;
        if (!task.localColumns) task.localColumns = [];
        task.localColumns.push(colDef);
      }
      saveDocs();
      renderTasks();
      popup.remove();
      document.removeEventListener("click", dismiss, true);
    });
    popup.appendChild(addBtn);

    document.body.appendChild(popup);
    const rect = anchor.getBoundingClientRect();
    popup.style.top = (rect.bottom + 6) + "px";
    popup.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 270)) + "px";

    function dismiss(e) {
      if (!popup.contains(e.target) && e.target !== anchor) {
        popup.remove();
        document.removeEventListener("click", dismiss, true);
      }
    }
    setTimeout(() => { document.addEventListener("click", dismiss, true); nameInput.focus(); }, 0);
  }

  function renderTasks() {
    renderBlocks(true);
  }

  function showTaskPicker(anchor, block) {
    st().buildTaskPicker({
      excludeIds: block.taskIds || [],
      anchorEl: anchor,
      onSelect(taskId) {
        if (!block.taskIds) block.taskIds = [];
        block.taskIds.push(taskId);
        saveDocs();
        renderBlocks(true);
      },
    });
  }

  function buildTaskRow(task, block) {
    const row = document.createElement("div");
    row.className = "task-row";
    row.draggable = true;

    const header = document.createElement("div");
    header.className = "task-row-header";

    const grip = document.createElement("div");
    grip.className = "task-grip";
    grip.textContent = "⠿";
    grip.title = "Drag to reorder";

    const toggle = document.createElement("button");
    toggle.className = "task-toggle" + (task.expanded ? " open" : "");
    toggle.textContent = "▸";
    toggle.title = task.expanded ? "Collapse" : "Expand";
    if (!task.children || !task.children.length) toggle.classList.add("empty");

    const text = document.createElement("input");
    text.type = "text";
    text.className = "task-text";
    text.value = task.text || "";
    text.placeholder = "Task description…";

    const chipWrap = document.createElement("div");
    chipWrap.className = "task-chip-wrap";
    if (task.linkedCard) {
      chipWrap.appendChild(buildCardChip(task.linkedCard, () => {
        task.linkedCard = null; saveDocs(); renderTasks();
      }));
    }

    const linkBtn = document.createElement("button");
    linkBtn.className = "task-action-btn link-btn";
    linkBtn.title = "Link a board card";
    linkBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" width="13" height="13"><path d="M6.5 10.5l-1 1a2.5 2.5 0 01-3.5-3.5l1-1M9.5 5.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M6 8.5l4-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

    const addChildBtn = document.createElement("button");
    addChildBtn.className = "task-action-btn";
    addChildBtn.title = "Add sub-task";
    addChildBtn.textContent = "+";

    const addLocalColBtn = document.createElement("button");
    addLocalColBtn.className = "task-action-btn";
    addLocalColBtn.title = "Add local column (this task only)";
    addLocalColBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" width="12" height="12"><rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M9 8h4M11 6v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;

    const delBtn = document.createElement("button");
    delBtn.className = "task-action-btn danger";
    delBtn.title = "Delete task";
    delBtn.textContent = "×";

    header.appendChild(grip);
    header.appendChild(toggle);
    header.appendChild(text);
    header.appendChild(chipWrap);
    header.appendChild(linkBtn);
    header.appendChild(addChildBtn);
    header.appendChild(addLocalColBtn);
    header.appendChild(delBtn);
    row.appendChild(header);

    // Column value fields
    const globalCols = st().getColumns();
    const localCols = task.localColumns || [];
    if (globalCols.length || localCols.length) {
      const colValues = document.createElement("div");
      colValues.className = "task-col-values";
      globalCols.forEach((col) => colValues.appendChild(buildColField(task, col, null)));
      localCols.forEach((col) => colValues.appendChild(buildColField(task, col, () => deleteLocalColumn(task, col.id))));
      row.appendChild(colValues);
    }

    const children = document.createElement("div");
    children.className = "task-children";
    if (!task.expanded) children.hidden = true;

    if (task.children) {
      task.children.forEach((child) => {
        children.appendChild(buildChildRow(task, child));
      });
    }
    row.appendChild(children);

    // Drag events
    row.addEventListener("dragstart", (e) => {
      dragSrcTaskId = task.id;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => row.classList.add("dragging"), 0);
    });
    row.addEventListener("dragend", () => {
      dragSrcTaskId = null;
      row.classList.remove("dragging");
      clearDropIndicators();
    });
    row.addEventListener("dragover", (e) => {
      if (!dragSrcTaskId || dragSrcTaskId === task.id) return;
      e.preventDefault();
      clearDropIndicators();
      const rect = row.getBoundingClientRect();
      row.classList.add(e.clientY < rect.top + rect.height / 2 ? "drop-above" : "drop-below");
    });
    row.addEventListener("dragleave", (e) => {
      if (!row.contains(e.relatedTarget)) clearDropIndicators();
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragSrcTaskId || dragSrcTaskId === task.id) return;
      if (!block || !block.taskIds) return;
      const insertAfter = e.clientY >= row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      block.taskIds = block.taskIds.filter(id => id !== dragSrcTaskId);
      const dstBlockIdx = block.taskIds.indexOf(task.id);
      block.taskIds.splice(insertAfter ? dstBlockIdx + 1 : dstBlockIdx, 0, dragSrcTaskId);
      clearDropIndicators();
      saveDocs();
      renderTasks();
    });

    toggle.addEventListener("click", () => {
      task.expanded = !task.expanded;
      toggle.classList.toggle("open", task.expanded);
      toggle.title = task.expanded ? "Collapse" : "Expand";
      children.hidden = !task.expanded;
      saveDocs();
    });

    text.addEventListener("input", () => { task.text = text.value; st().forceSave(); saveDocs(); });
    text.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!block || !block.taskIds) return;
      const newTask = st().createTask({ text: "" });
      const blockIdx = block.taskIds.indexOf(task.id);
      block.taskIds.splice(blockIdx + 1, 0, newTask.id);
      saveDocs();
      renderTasks();
      if (block) {
        const inputs = document.querySelectorAll(`.doc-task-block[data-block-id="${block.id}"] .task-text`);
        const localIdx = block.taskIds ? block.taskIds.indexOf(newTask.id) : -1;
        if (localIdx >= 0 && inputs[localIdx]) inputs[localIdx].focus();
      }
    });

    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showCardPicker(linkBtn, (card) => { task.linkedCard = card; saveDocs(); renderTasks(); });
    });

    addLocalColBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showAddColumnPopup(addLocalColBtn, "local", task.id);
    });

    addChildBtn.addEventListener("click", () => {
      if (!task.children) task.children = [];
      task.children.push({ id: uid(), text: "", linkedCard: null, colValues: {} });
      task.expanded = true;
      saveDocs();
      renderTasks();
      const scope = block ? `.doc-task-block[data-block-id="${block.id}"]` : ".doc-task-block";
      const allRows = document.querySelectorAll(`${scope} .task-child-text`);
      if (allRows.length) allRows[allRows.length - 1].focus();
    });

    delBtn.addEventListener("click", () => {
      st().deleteTask(task.id);
      if (block && block.taskIds) {
        block.taskIds = block.taskIds.filter(id => id !== task.id);
      }
      saveDocs();
      renderTasks();
    });

    return row;
  }

  function buildChildRow(parent, child) {
    const wrap = document.createElement("div");
    wrap.className = "task-child-wrap";

    const row = document.createElement("div");
    row.className = "task-child-row";
    row.draggable = true;

    const grip = document.createElement("div");
    grip.className = "task-grip small";
    grip.textContent = "⠿";

    const text = document.createElement("input");
    text.type = "text";
    text.className = "task-child-text";
    text.value = child.text || "";
    text.placeholder = "Sub-task…";

    const chipWrap = document.createElement("div");
    chipWrap.className = "task-chip-wrap";
    if (child.linkedCard) {
      chipWrap.appendChild(buildCardChip(child.linkedCard, () => {
        child.linkedCard = null; saveDocs(); renderTasks();
      }));
    }

    const linkBtn = document.createElement("button");
    linkBtn.className = "task-action-btn link-btn small";
    linkBtn.title = "Link a board card";
    linkBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" width="12" height="12"><path d="M6.5 10.5l-1 1a2.5 2.5 0 01-3.5-3.5l1-1M9.5 5.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M6 8.5l4-5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

    const delBtn = document.createElement("button");
    delBtn.className = "task-action-btn danger small";
    delBtn.title = "Delete sub-task";
    delBtn.textContent = "×";

    row.appendChild(grip);
    row.appendChild(text);
    row.appendChild(chipWrap);
    row.appendChild(linkBtn);
    row.appendChild(delBtn);
    wrap.appendChild(row);

    // Child drag events
    row.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      dragSrcChildInfo = { parentId: parent.id, childId: child.id };
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => row.classList.add("dragging"), 0);
    });
    row.addEventListener("dragend", () => {
      dragSrcChildInfo = null;
      row.classList.remove("dragging");
      clearChildDropIndicators();
    });
    row.addEventListener("dragover", (e) => {
      if (!dragSrcChildInfo || dragSrcChildInfo.parentId !== parent.id || dragSrcChildInfo.childId === child.id) return;
      e.preventDefault();
      e.stopPropagation();
      clearChildDropIndicators();
      const rect = row.getBoundingClientRect();
      row.classList.add(e.clientY < rect.top + rect.height / 2 ? "drop-above" : "drop-below");
    });
    row.addEventListener("dragleave", (e) => {
      if (!row.contains(e.relatedTarget)) row.classList.remove("drop-above", "drop-below");
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragSrcChildInfo || dragSrcChildInfo.parentId !== parent.id || dragSrcChildInfo.childId === child.id) return;
      const insertAfter = e.clientY >= row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      const srcIdx = parent.children.findIndex((c) => c.id === dragSrcChildInfo.childId);
      if (srcIdx === -1) return;
      const [moved] = parent.children.splice(srcIdx, 1);
      const dstIdx = parent.children.findIndex((c) => c.id === child.id);
      parent.children.splice(insertAfter ? dstIdx + 1 : dstIdx, 0, moved);
      clearChildDropIndicators();
      saveDocs();
      renderTasks();
    });

    text.addEventListener("input", () => { child.text = text.value; saveDocs(); });
    text.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!parent.children) parent.children = [];
      const newChild = { id: uid(), text: "", linkedCard: null, colValues: {} };
      const idx = parent.children.findIndex((c) => c.id === child.id);
      parent.children.splice(idx + 1, 0, newChild);
      saveDocs();
      renderTasks();
      const taskRow = wrap.closest(".task-row");
      const inputs = taskRow ? taskRow.querySelectorAll(".task-child-text") : document.querySelectorAll(".task-child-text");
      if (inputs[idx + 1]) inputs[idx + 1].focus();
    });

    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showCardPicker(linkBtn, (card) => { child.linkedCard = card; saveDocs(); renderTasks(); });
    });

    delBtn.addEventListener("click", () => {
      parent.children = parent.children.filter((c) => c.id !== child.id);
      if (!parent.children.length) parent.expanded = false;
      saveDocs();
      renderTasks();
    });

    // Column value fields (global + parent local)
    const globalCols = st().getColumns();
    const localCols = parent.localColumns || [];
    if (globalCols.length || localCols.length) {
      const colValues = document.createElement("div");
      colValues.className = "task-col-values task-child-col-values";
      globalCols.forEach((col) => colValues.appendChild(buildColField(child, col, null)));
      localCols.forEach((col) => colValues.appendChild(buildColField(child, col, null)));
      wrap.appendChild(colValues);
    }

    return wrap;
  }

  function buildCardChip(card, onUnlink) {
    const chip = document.createElement("div");
    chip.className = "task-card-chip";
    chip.title = "Click to view details";
    const label = document.createElement("span");
    label.className = "tcp-chip-label";
    label.textContent = card.title;
    label.addEventListener("click", (e) => {
      e.stopPropagation();
      showCardDetail(card, chip);
    });
    const remove = document.createElement("button");
    remove.className = "tcp-remove";
    remove.textContent = "×";
    remove.title = "Unlink";
    remove.addEventListener("click", (e) => { e.stopPropagation(); onUnlink(); });
    chip.appendChild(label);
    chip.appendChild(remove);
    return chip;
  }

  function findKanbanCard(cardId) {
    const columns = loadKanbanColumns();
    for (const col of columns) {
      for (const card of (col.cards || [])) {
        if (card.id === cardId) return { ...card, columnName: col.title };
      }
    }
    return null;
  }

  function showCardDetail(linkedCard, anchor) {
    document.querySelector(".task-card-detail")?.remove();
    const full = findKanbanCard(linkedCard.id);
    const card = full || linkedCard;

    const detail = document.createElement("div");
    detail.className = "task-card-detail";

    const header = document.createElement("div");
    header.className = "tcd-header";
    const title = document.createElement("span");
    title.className = "tcd-title";
    title.textContent = card.title || "Untitled";
    const closeBtn = document.createElement("button");
    closeBtn.className = "tcd-close";
    closeBtn.textContent = "×";
    header.appendChild(title);
    header.appendChild(closeBtn);
    detail.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "tcd-meta";
    if (card.columnName) { const b = document.createElement("span"); b.className = "tcd-badge"; b.textContent = card.columnName; meta.appendChild(b); }
    if (card.priority) { const b = document.createElement("span"); b.className = "tcd-badge tcd-priority-" + card.priority; b.textContent = card.priority; meta.appendChild(b); }
    (card.tags || []).forEach((t) => { const b = document.createElement("span"); b.className = "tcd-tag"; b.textContent = t; meta.appendChild(b); });
    detail.appendChild(meta);

    const desc = document.createElement("div");
    desc.className = "tcd-desc";
    desc.textContent = card.description || "No description";
    if (!card.description) desc.classList.add("tcd-empty");
    detail.appendChild(desc);

    const link = document.createElement("a");
    link.className = "tcd-link";
    link.href = "kanban.html";
    link.textContent = "View on Board →";
    detail.appendChild(link);

    closeBtn.addEventListener("click", () => { detail.remove(); document.removeEventListener("click", dismiss, true); });

    document.body.appendChild(detail);
    const rect = anchor.getBoundingClientRect();
    detail.style.top = Math.min(rect.bottom + 4, window.innerHeight - 280) + "px";
    detail.style.left = Math.min(rect.left, window.innerWidth - 310) + "px";

    function dismiss(e) {
      if (!detail.contains(e.target)) { detail.remove(); document.removeEventListener("click", dismiss, true); }
    }
    setTimeout(() => document.addEventListener("click", dismiss, true), 0);
  }

  function showCardPicker(anchor, onSelect) {
    document.querySelector(".task-card-picker")?.remove();

    const columns = loadKanbanColumns();
    const allCards = [];
    columns.forEach((col) => {
      (col.cards || []).forEach((card) => {
        allCards.push({ id: card.id, title: card.title || "Untitled", columnName: col.title });
      });
    });

    const picker = document.createElement("div");
    picker.className = "task-card-picker";

    if (!allCards.length) {
      const empty = document.createElement("div");
      empty.className = "tcp-empty";
      empty.textContent = "No board cards yet";
      picker.appendChild(empty);
    } else {
      allCards.forEach((card) => {
        const item = document.createElement("div");
        item.className = "task-card-picker-item";
        const t = document.createElement("span");
        t.className = "tcp-title";
        t.textContent = card.title;
        const c = document.createElement("span");
        c.className = "tcp-col";
        c.textContent = card.columnName;
        item.appendChild(t);
        item.appendChild(c);
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect(card);
          picker.remove();
          document.removeEventListener("click", dismiss, true);
        });
        picker.appendChild(item);
      });
    }

    document.body.appendChild(picker);
    const rect = anchor.getBoundingClientRect();
    picker.style.top = (rect.bottom + 4) + "px";
    const left = Math.min(rect.left, window.innerWidth - 244);
    picker.style.left = left + "px";

    function dismiss(e) {
      if (!picker.contains(e.target)) {
        picker.remove();
        document.removeEventListener("click", dismiss, true);
      }
    }
    setTimeout(() => document.addEventListener("click", dismiss, true), 0);
  }

  function addTask() {
    const doc = currentDoc();
    if (!doc) return;
    ensureBlocks(doc);

    const taskBlock = doc.blocks.find(b => b.type === "tasks");
    if (taskBlock) {
      addTaskToBlock(taskBlock.id);
    } else {
      const task = st().createTask({ text: "" });
      const block = { id: uid(), type: "tasks", taskIds: [task.id] };
      doc.blocks.push(block);
      saveDocs();
      renderBlocks(false);
      setTimeout(() => {
        const rows = document.querySelectorAll(`.doc-task-block[data-block-id="${block.id}"] .task-text`);
        if (rows.length) rows[rows.length - 1].focus();
      }, 50);
    }
  }

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 160) + "px";
  }

  function buildStoryBlock(story, idx) {
    const block = document.createElement("div");
    block.className = "story-block";

    block.innerHTML = `
      <div class="story-header">
        <span class="story-number">#${idx + 1}</span>
        <input type="text" class="story-title-input" value="${escapeAttr(story.title)}" placeholder="Story title…" />
        <button class="story-delete" title="Remove story">&times;</button>
      </div>
      <div class="story-field">
        <label>User Story</label>
        <textarea class="story-textarea story-body" rows="3" placeholder="As a [role], I want [feature] so that [benefit]…">${escapeHtml(story.body)}</textarea>
      </div>
      <div class="story-field">
        <label>Acceptance Criteria</label>
        <textarea class="story-textarea story-ac" rows="4" placeholder="Given [context]&#10;When [action]&#10;Then [result]&#10;&#10;Add one criterion per line…">${escapeHtml(story.acceptanceCriteria)}</textarea>
      </div>
      <div class="story-meta">
        <select class="story-status">
          <option value="draft"${story.status === "draft" ? " selected" : ""}>Draft</option>
          <option value="ready"${story.status === "ready" ? " selected" : ""}>Ready</option>
          <option value="in-progress"${story.status === "in-progress" ? " selected" : ""}>In Progress</option>
          <option value="done"${story.status === "done" ? " selected" : ""}>Done</option>
        </select>
        <select class="story-priority">
          <option value="low"${story.priority === "low" ? " selected" : ""}>Low</option>
          <option value="medium"${story.priority === "medium" ? " selected" : ""}>Medium</option>
          <option value="high"${story.priority === "high" ? " selected" : ""}>High</option>
        </select>
        <span class="story-meta-spacer"></span>
        <div class="story-push">
          <select class="story-col-sel"></select>
          <button class="btn btn-ghost btn-sm story-push-btn">Push to Board</button>
        </div>
      </div>
    `;

    const titleInput = block.querySelector(".story-title-input");
    const bodyInput = block.querySelector(".story-body");
    const acInput = block.querySelector(".story-ac");
    const statusSel = block.querySelector(".story-status");
    const prioritySel = block.querySelector(".story-priority");
    const deleteBtn = block.querySelector(".story-delete");
    const colSel = block.querySelector(".story-col-sel");
    const pushBtn = block.querySelector(".story-push-btn");

    // Populate column selector from kanban state
    const columns = loadKanbanColumns();
    if (columns.length) {
      columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col.id;
        opt.textContent = col.title;
        colSel.appendChild(opt);
      });
    } else {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "No board yet";
      colSel.appendChild(opt);
      pushBtn.disabled = true;
    }

    pushBtn.addEventListener("click", () => {
      if (!colSel.value) return;
      pushStoryToBoard(story, colSel.value, pushBtn);
    });

    const autoSave = () => {
      story.title = titleInput.value;
      story.body = bodyInput.value;
      story.acceptanceCriteria = acInput.value;
      story.status = statusSel.value;
      story.priority = prioritySel.value;
      saveDocs();
      renderSidebar();
    };

    titleInput.addEventListener("input", autoSave);
    bodyInput.addEventListener("input", autoSave);
    acInput.addEventListener("input", autoSave);
    statusSel.addEventListener("change", autoSave);
    prioritySel.addEventListener("change", autoSave);

    deleteBtn.addEventListener("click", () => {
      if (!confirm(`Delete story "${story.title || "Untitled"}"?`)) return;
      const doc = currentDoc();
      if (!doc) return;
      doc.stories = doc.stories.filter((s) => s.id !== story.id);
      saveDocs();
      renderEditor();
      renderSidebar();
    });

    return block;
  }

  function populateProjectSelect(selectedId) {
    const sel = document.getElementById("docProject");
    sel.innerHTML = '<option value="">None</option>';
    loadProjects().forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function populateFolderSelect(selectedId) {
    const sel = document.getElementById("docFolder");
    if (!sel) return;
    const teamId = window.datascope?.activeTeamId || null;
    const folders = state.folders.filter(f => (f.teamId || null) === teamId);
    sel.innerHTML = '<option value="">No Folder</option>';
    folders.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      if (f.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ---------- Actions ----------
  function createDoc() {
    const doc = {
      id: uid(),
      teamId: window.datascope?.activeTeamId || null,
      title: "Untitled Document",
      body: "",
      tasks: [],
      stories: [],
      projectId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.docs.unshift(doc);
    state.currentDocId = doc.id;
    saveDocs();
    renderSidebar();
    renderEditor();
    document.getElementById("docTitle").focus();
    document.getElementById("docTitle").select();
  }

  function selectDoc(id) {
    state.currentDocId = id;
    renderSidebar();
    renderEditor();
  }

  function addStory() {
    const doc = currentDoc();
    if (!doc) return;
    doc.stories.push({
      id: uid(),
      title: "",
      body: "",
      acceptanceCriteria: "",
      status: "draft",
      priority: "medium",
    });
    saveDocs();
    renderEditor();
    renderSidebar();
    document.getElementById("storiesDivider").hidden = false;
    const blocks = document.querySelectorAll(".story-block");
    const last = blocks[blocks.length - 1];
    if (last) {
      last.scrollIntoView({ behavior: "smooth", block: "center" });
      last.querySelector(".story-title-input")?.focus();
    }
  }

  function deleteDoc() {
    const doc = currentDoc();
    if (!doc) return;
    if (!confirm(`Delete "${doc.title}"?`)) return;
    state.docs = state.docs.filter((d) => d.id !== doc.id);
    state.currentDocId = state.docs[0]?.id || null;
    saveDocs();
    renderSidebar();
    renderEditor();
  }

  // ---------- Push to board ----------
  function loadKanbanColumns() {
    try {
      const raw = localStorage.getItem("datascope_kanban");
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        const teamId = window.datascope?.activeTeamId || null;
        const board = data.find(b => (b.teamId || null) === teamId);
        return board ? board.columns || [] : [];
      }
      return data.columns || [];
    } catch (_) {}
    return [];
  }

  function pushStoryToBoard(story, colId, pushBtn) {
    const KANBAN_KEY = "datascope_kanban";
    const teamId = window.datascope?.activeTeamId || null;
    let boards;
    try {
      const raw = localStorage.getItem(KANBAN_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (Array.isArray(data)) boards = data;
      else if (data) boards = [{ ...data, id: data.id || uidLocal(), teamId: null }];
      else boards = [];
    } catch (_) { boards = []; }

    let board = boards.find(b => (b.teamId || null) === teamId);
    if (!board) {
      board = {
        id: uidLocal(), teamId, boardTitle: teamId ? "Team Board" : "My Board",
        columns: [
          { id: uidLocal(), title: "To Do", cards: [] },
          { id: uidLocal(), title: "In Progress", cards: [] },
          { id: uidLocal(), title: "Done", cards: [] },
        ],
      };
      boards.push(board);
    }

    const col = board.columns.find((c) => c.id === colId) || board.columns[0];
    if (!col) return;

    const doc = currentDoc();
    const parts = [];
    if (story.body) parts.push(story.body);
    if (story.acceptanceCriteria) parts.push("Acceptance Criteria:\n" + story.acceptanceCriteria);
    const description = parts.join("\n\n");

    col.cards.push({
      id: uidLocal(),
      title: story.title || "Untitled Story",
      description,
      priority: story.priority || "medium",
      startDate: "",
      dueDate: "",
      reminder: "",
      tags: ["story"],
      projectId: doc?.projectId || "",
      createdAt: new Date().toISOString(),
    });

    try { localStorage.setItem(KANBAN_KEY, JSON.stringify(boards)); } catch (_) {}

    pushBtn.textContent = "✓ Added to Board";
    pushBtn.disabled = true;
    pushBtn.classList.add("push-success");
    setTimeout(() => {
      pushBtn.textContent = "Push to Board";
      pushBtn.disabled = false;
      pushBtn.classList.remove("push-success");
    }, 2500);
  }

  function uidLocal() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ---------- Helpers ----------
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ---------- Comments ----------
  let pendingCommentRange = null;

  function getAuthorInfo() {
    let name = "";
    let email = "";
    try {
      const profile = JSON.parse(localStorage.getItem("datascope_profile")) || {};
      name = profile.name || "";
    } catch (_) {}
    const ds = window.datascope;
    if (ds && ds._sessionEmail) email = ds._sessionEmail;
    return { name: name || email || "Anonymous", email };
  }

  function getDocComments() {
    const doc = currentDoc();
    if (!doc) return [];
    if (!doc.comments) doc.comments = [];
    return doc.comments;
  }

  function renderComments() {
    const doc = currentDoc();
    const panel = document.getElementById("commentsPanel");
    const list = document.getElementById("commentsList");
    const empty = document.getElementById("commentsEmpty");
    const countEl = document.getElementById("commentsCount");
    const app = document.querySelector(".docs-app");

    if (!doc) {
      panel.hidden = true;
      app.classList.remove("has-comments");
      return;
    }

    const comments = getDocComments();
    if (!comments.length) {
      panel.hidden = true;
      app.classList.remove("has-comments");
      return;
    }

    panel.hidden = false;
    app.classList.add("has-comments");
    countEl.textContent = comments.length;
    list.innerHTML = "";
    empty.hidden = comments.length > 0;

    comments.forEach(comment => {
      list.appendChild(buildCommentCard(comment));
    });
  }

  function buildCommentCard(comment) {
    const card = document.createElement("div");
    card.className = "comment-card";
    card.dataset.commentId = comment.id;

    const quote = document.createElement("p");
    quote.className = "comment-quote";
    quote.textContent = comment.selectedText;
    card.appendChild(quote);

    const authorEl = document.createElement("span");
    authorEl.className = "comment-author";
    authorEl.textContent = comment.author || "Anonymous";
    if (comment.email) authorEl.title = comment.email;
    card.appendChild(authorEl);

    const text = document.createElement("div");
    text.className = "comment-text";
    text.contentEditable = "true";
    text.textContent = comment.text;
    text.addEventListener("input", () => {
      comment.text = text.textContent;
      saveDocs();
    });
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        text.blur();
      }
    });
    card.appendChild(text);

    const footer = document.createElement("div");
    footer.className = "comment-footer";
    const time = document.createElement("span");
    time.className = "comment-time";
    time.textContent = formatCommentTime(comment.createdAt);
    const actions = document.createElement("div");
    actions.className = "comment-actions";
    const delBtn = document.createElement("button");
    delBtn.className = "comment-action-btn";
    delBtn.textContent = "×";
    delBtn.title = "Delete comment";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteComment(comment.id);
    });
    actions.appendChild(delBtn);
    footer.appendChild(time);
    footer.appendChild(actions);
    card.appendChild(footer);

    if (!comment.replies) comment.replies = [];
    if (comment.replies.length) {
      const repliesWrap = document.createElement("div");
      repliesWrap.className = "comment-replies";
      comment.replies.forEach(reply => {
        repliesWrap.appendChild(buildReplyBubble(comment, reply));
      });
      card.appendChild(repliesWrap);
    }

    const replyBar = document.createElement("div");
    replyBar.className = "comment-reply-bar";
    const replyInput = document.createElement("input");
    replyInput.type = "text";
    replyInput.className = "comment-reply-input";
    replyInput.placeholder = "Reply…";
    replyInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const val = replyInput.value.trim();
      if (!val) return;
      addReply(comment, val);
      replyInput.value = "";
    });
    const replyBtn = document.createElement("button");
    replyBtn.className = "comment-reply-btn";
    replyBtn.textContent = "↵";
    replyBtn.title = "Send reply";
    replyBtn.addEventListener("click", () => {
      const val = replyInput.value.trim();
      if (!val) { replyInput.focus(); return; }
      addReply(comment, val);
      replyInput.value = "";
    });
    replyBar.appendChild(replyInput);
    replyBar.appendChild(replyBtn);
    card.appendChild(replyBar);

    card.addEventListener("click", (e) => {
      if (e.target.closest(".comment-text, .comment-reply-input, .comment-reply-btn, .comment-action-btn, .reply-del-btn")) return;
      highlightCommentInProse(comment.id);
    });

    return card;
  }

  function buildReplyBubble(comment, reply) {
    const el = document.createElement("div");
    el.className = "comment-reply";

    const header = document.createElement("div");
    header.className = "reply-header";
    const author = document.createElement("span");
    author.className = "reply-author";
    author.textContent = reply.author || "Anonymous";
    if (reply.email) author.title = reply.email;
    const time = document.createElement("span");
    time.className = "reply-time";
    time.textContent = formatCommentTime(reply.createdAt);
    const delBtn = document.createElement("button");
    delBtn.className = "reply-del-btn";
    delBtn.textContent = "×";
    delBtn.title = "Delete reply";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      comment.replies = comment.replies.filter(r => r.id !== reply.id);
      saveDocs();
      renderComments();
    });
    header.appendChild(author);
    header.appendChild(time);
    header.appendChild(delBtn);
    el.appendChild(header);

    const body = document.createElement("p");
    body.className = "reply-text";
    body.textContent = reply.text;
    el.appendChild(body);

    return el;
  }

  function addReply(comment, text) {
    if (!comment.replies) comment.replies = [];
    const authorInfo = getAuthorInfo();
    comment.replies.push({
      id: uid(),
      author: authorInfo.name,
      email: authorInfo.email,
      text,
      createdAt: new Date().toISOString(),
    });
    saveDocs();
    renderComments();
  }

  function formatCommentTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return d.toLocaleDateString();
  }

  function addComment(selectedText, range) {
    const doc = currentDoc();
    if (!doc) return;
    if (!doc.comments) doc.comments = [];

    const commentId = uid();
    const authorInfo = getAuthorInfo();
    const comment = {
      id: commentId,
      author: authorInfo.name,
      email: authorInfo.email,
      selectedText,
      text: "",
      replies: [],
      createdAt: new Date().toISOString(),
    };
    doc.comments.push(comment);

    wrapRangeWithMark(range, commentId);

    saveAllProse();
    saveDocs();
    renderComments();

    setTimeout(() => {
      const card = document.querySelector(`.comment-card[data-comment-id="${commentId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.querySelector(".comment-text")?.focus();
      }
    }, 50);
  }

  function wrapRangeWithMark(range, commentId) {
    const mark = document.createElement("mark");
    mark.dataset.commentId = commentId;
    range.surroundContents(mark);
  }

  function deleteComment(commentId) {
    const doc = currentDoc();
    if (!doc) return;
    doc.comments = (doc.comments || []).filter(c => c.id !== commentId);

    document.querySelectorAll(`.doc-prose mark[data-comment-id="${commentId}"]`).forEach(mark => {
      const parent = mark.parentNode;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });

    saveAllProse();
    saveDocs();
    renderComments();
  }

  function highlightCommentInProse(commentId) {
    document.querySelectorAll(".doc-prose mark.comment-active").forEach(m => m.classList.remove("comment-active"));
    document.querySelectorAll(".comment-card.active").forEach(c => c.classList.remove("active"));

    const mark = document.querySelector(`.doc-prose mark[data-comment-id="${commentId}"]`);
    if (mark) {
      mark.classList.add("comment-active");
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const card = document.querySelector(`.comment-card[data-comment-id="${commentId}"]`);
    if (card) card.classList.add("active");
  }

  function setupContextMenu() {
    const menu = document.getElementById("docContextMenu");
    const addCommentBtn = document.getElementById("ctxAddComment");

    document.addEventListener("contextmenu", (e) => {
      const prose = e.target.closest(".doc-prose");
      if (!prose) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

      const range = sel.getRangeAt(0);
      if (!prose.contains(range.commonAncestorContainer)) return;

      e.preventDefault();
      pendingCommentRange = range.cloneRange();

      menu.hidden = false;
      menu.style.left = Math.min(e.clientX, window.innerWidth - 170) + "px";
      menu.style.top = Math.min(e.clientY, window.innerHeight - 50) + "px";
    });

    addCommentBtn.addEventListener("click", () => {
      menu.hidden = true;
      if (!pendingCommentRange) return;

      const sel = window.getSelection();
      const selectedText = pendingCommentRange.toString().trim();
      if (!selectedText) { pendingCommentRange = null; return; }

      try {
        addComment(selectedText, pendingCommentRange);
      } catch (_) {
        addComment(selectedText, pendingCommentRange);
      }

      if (sel) sel.removeAllRanges();
      pendingCommentRange = null;
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) menu.hidden = true;
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") menu.hidden = true;
    });
  }

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    migrateDocsToSharedTasks();

    if (state.docs.length) state.currentDocId = state.docs[0].id;

    renderSidebar();
    renderEditor();
    setupContextMenu();

    document.getElementById("newDocBtn").addEventListener("click", createDoc);
    document.getElementById("newFolderBtn").addEventListener("click", createFolder);
    document.getElementById("addStoryBtn").addEventListener("click", addStory);
    document.getElementById("addTaskBtn2").addEventListener("click", addTask);
    document.getElementById("deleteDocBtn").addEventListener("click", deleteDoc);
    document.getElementById("historyBtn").addEventListener("click", openVersionHistory);

    document.querySelectorAll(".prose-btn").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (!activeProse) return;
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val || null;
        document.execCommand(cmd, false, val);
        const doc = currentDoc();
        if (doc) {
          const blockId = activeProse.dataset.blockId;
          const block = doc.blocks?.find(b => b.id === blockId);
          if (block) { block.content = activeProse.innerHTML; doc.body = doc.blocks.filter(b => b.type === "prose").map(b => b.content || "").join("\n"); }
          saveDocs();
        }
      });
    });

    document.getElementById("docTitle").addEventListener("input", () => {
      const doc = currentDoc();
      if (!doc) return;
      doc.title = document.getElementById("docTitle").value;
      doc.updatedAt = new Date().toISOString();
      saveDocs();
      renderSidebar();
    });

    document.getElementById("docProject").addEventListener("change", () => {
      const doc = currentDoc();
      if (!doc) return;
      doc.projectId = document.getElementById("docProject").value;
      saveDocs();
    });

    const folderSel = document.getElementById("docFolder");
    if (folderSel) {
      folderSel.addEventListener("change", () => {
        const doc = currentDoc();
        if (!doc) return;
        doc.folderId = folderSel.value || null;
        saveDocs();
        renderSidebar();
      });
    }

    document.addEventListener("datascope:teamchange", () => {
      const docs = teamFilteredDocs();
      state.currentDocId = docs.length ? docs[0].id : null;
      renderSidebar();
      renderEditor();
    });

    window.addEventListener("datascope:taskchange", (e) => {
      if (e.detail?.type === "external") renderBlocks(true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
