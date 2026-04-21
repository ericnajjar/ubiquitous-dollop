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

  function saveDocs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.docs)); } catch (_) {}
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
    currentDocId: null,
  };

  function currentDoc() {
    return state.docs.find((d) => d.id === state.currentDocId) || null;
  }

  // ---------- Sidebar ----------
  function renderSidebar() {
    const list = document.getElementById("docList");
    const empty = document.getElementById("docListEmpty");
    list.innerHTML = "";

    if (!state.docs.length) { empty.hidden = false; return; }
    empty.hidden = true;

    state.docs.forEach((doc) => {
      const li = document.createElement("li");
      li.className = "doc-item" + (doc.id === state.currentDocId ? " active" : "");
      li.innerHTML = `
        <span class="doc-item-title">${escapeHtml(doc.title || "Untitled")}</span>
        <span class="doc-item-count">${doc.stories.length} stor${doc.stories.length !== 1 ? "ies" : "y"}</span>
      `;
      li.addEventListener("click", () => selectDoc(doc.id));
      list.appendChild(li);
    });
  }

  // ---------- Editor ----------
  function bodyToHtml(body) {
    if (!body) return "";
    if (body.includes("<")) return body;
    return body.split(/\n\n+/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("") || "";
  }

  function renderEditor() {
    const doc = currentDoc();
    const container = document.getElementById("storiesContainer");
    const emptyMsg = document.getElementById("editorEmpty");
    const prose = document.getElementById("docProse");
    const proseArea = document.getElementById("proseArea");
    const divider = document.getElementById("storiesDivider");
    const titleInput = document.getElementById("docTitle");
    const deleteBtn = document.getElementById("deleteDocBtn");
    const addStoryBtn = document.getElementById("addStoryBtn");

    if (!doc) {
      emptyMsg.hidden = false;
      proseArea.hidden = true;
      document.getElementById("tasksArea").hidden = true;
      divider.hidden = true;
      container.innerHTML = "";
      titleInput.value = "";
      titleInput.disabled = true;
      deleteBtn.hidden = true;
      addStoryBtn.hidden = true;
      populateProjectSelect("");
      return;
    }

    emptyMsg.hidden = true;
    proseArea.hidden = false;
    titleInput.disabled = false;
    titleInput.value = doc.title;
    deleteBtn.hidden = false;
    addStoryBtn.hidden = false;
    populateProjectSelect(doc.projectId || "");

    // Only update prose content on doc switch (avoid resetting cursor mid-type)
    if (prose.dataset.docId !== doc.id) {
      prose.innerHTML = bodyToHtml(doc.body);
      prose.dataset.docId = doc.id;
    }

    renderTasks();

    divider.hidden = doc.stories.length === 0;
    container.innerHTML = "";
    doc.stories.forEach((story, idx) => {
      container.appendChild(buildStoryBlock(story, idx));
    });
  }

  // ---------- Tasks ----------
  let dragSrcTaskId = null;

  function clearDropIndicators() {
    document.querySelectorAll(".task-row.drop-above, .task-row.drop-below")
      .forEach((el) => el.classList.remove("drop-above", "drop-below"));
  }

  function renderTasks() {
    const doc = currentDoc();
    const area = document.getElementById("tasksArea");
    const list = document.getElementById("tasksList");
    if (!doc) { area.hidden = true; return; }

    if (!doc.tasks) doc.tasks = [];
    area.hidden = false;
    list.innerHTML = "";

    doc.tasks.forEach((task) => {
      list.appendChild(buildTaskRow(task));
    });
  }

  function buildTaskRow(task) {
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
    header.appendChild(delBtn);
    row.appendChild(header);

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
      const doc = currentDoc();
      if (!doc) return;
      const insertAfter = e.clientY >= row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      const srcIdx = doc.tasks.findIndex((t) => t.id === dragSrcTaskId);
      if (srcIdx === -1) return;
      const [moved] = doc.tasks.splice(srcIdx, 1);
      const dstIdx = doc.tasks.findIndex((t) => t.id === task.id);
      doc.tasks.splice(insertAfter ? dstIdx + 1 : dstIdx, 0, moved);
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

    text.addEventListener("input", () => { task.text = text.value; saveDocs(); });
    text.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const doc = currentDoc();
      if (!doc) return;
      const newTask = { id: uid(), text: "", expanded: false, children: [], linkedCard: null };
      const idx = doc.tasks.findIndex((t) => t.id === task.id);
      doc.tasks.splice(idx + 1, 0, newTask);
      saveDocs();
      renderTasks();
      const inputs = document.querySelectorAll("#tasksList .task-row-header .task-text");
      if (inputs[idx + 1]) inputs[idx + 1].focus();
    });

    linkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showCardPicker(linkBtn, (card) => { task.linkedCard = card; saveDocs(); renderTasks(); });
    });

    addChildBtn.addEventListener("click", () => {
      if (!task.children) task.children = [];
      task.children.push({ id: uid(), text: "", linkedCard: null });
      task.expanded = true;
      saveDocs();
      renderTasks();
      const allRows = document.querySelectorAll("#tasksList .task-child-text");
      if (allRows.length) allRows[allRows.length - 1].focus();
    });

    delBtn.addEventListener("click", () => {
      const doc = currentDoc();
      if (!doc) return;
      doc.tasks = doc.tasks.filter((t) => t.id !== task.id);
      saveDocs();
      renderTasks();
    });

    return row;
  }

  function buildChildRow(parent, child) {
    const row = document.createElement("div");
    row.className = "task-child-row";

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

    text.addEventListener("input", () => { child.text = text.value; saveDocs(); });
    text.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!parent.children) parent.children = [];
      const newChild = { id: uid(), text: "", linkedCard: null };
      const idx = parent.children.findIndex((c) => c.id === child.id);
      parent.children.splice(idx + 1, 0, newChild);
      saveDocs();
      renderTasks();
      const inputs = document.querySelectorAll("#tasksList .task-child-text");
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

    return row;
  }

  function buildCardChip(card, onUnlink) {
    const chip = document.createElement("div");
    chip.className = "task-card-chip";
    chip.title = card.columnName ? `${card.title} · ${card.columnName}` : card.title;
    const label = document.createElement("span");
    label.textContent = card.title;
    const remove = document.createElement("button");
    remove.className = "tcp-remove";
    remove.textContent = "×";
    remove.title = "Unlink";
    remove.addEventListener("click", (e) => { e.stopPropagation(); onUnlink(); });
    chip.appendChild(label);
    chip.appendChild(remove);
    return chip;
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
    if (!doc.tasks) doc.tasks = [];
    doc.tasks.push({ id: uid(), text: "", expanded: false, children: [] });
    saveDocs();
    renderTasks();
    const rows = document.querySelectorAll(".task-row-header .task-text");
    if (rows.length) rows[rows.length - 1].focus();
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

  // ---------- Actions ----------
  function createDoc() {
    const doc = {
      id: uid(),
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
      if (raw) return JSON.parse(raw).columns || [];
    } catch (_) {}
    return [];
  }

  function pushStoryToBoard(story, colId, pushBtn) {
    const KANBAN_KEY = "datascope_kanban";
    let kanban;
    try { kanban = JSON.parse(localStorage.getItem(KANBAN_KEY)); } catch (_) {}
    if (!kanban) {
      kanban = {
        title: "My Board",
        columns: [
          { id: uidLocal(), title: "To Do", cards: [] },
          { id: uidLocal(), title: "In Progress", cards: [] },
          { id: uidLocal(), title: "Done", cards: [] },
        ],
      };
    }

    const col = kanban.columns.find((c) => c.id === colId) || kanban.columns[0];
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

    try { localStorage.setItem(KANBAN_KEY, JSON.stringify(kanban)); } catch (_) {}

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

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    if (state.docs.length) state.currentDocId = state.docs[0].id;

    renderSidebar();
    renderEditor();

    document.getElementById("newDocBtn").addEventListener("click", createDoc);
    document.getElementById("addStoryBtn").addEventListener("click", addStory);
    document.getElementById("addTaskBtn").addEventListener("click", addTask);
    document.getElementById("deleteDocBtn").addEventListener("click", deleteDoc);

    const prose = document.getElementById("docProse");
    prose.addEventListener("input", () => {
      const doc = currentDoc();
      if (!doc) return;
      doc.body = prose.innerHTML;
      doc.updatedAt = new Date().toISOString();
      saveDocs();
    });

    document.querySelectorAll(".prose-btn").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep focus in prose
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val || null;
        document.execCommand(cmd, false, val);
        const doc = currentDoc();
        if (doc) { doc.body = prose.innerHTML; saveDocs(); }
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
