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
  function renderEditor() {
    const doc = currentDoc();
    const container = document.getElementById("storiesContainer");
    const emptyMsg = document.getElementById("editorEmpty");
    const prose = document.getElementById("docProse");
    const divider = document.getElementById("storiesDivider");
    const titleInput = document.getElementById("docTitle");
    const deleteBtn = document.getElementById("deleteDocBtn");
    const addStoryBtn = document.getElementById("addStoryBtn");

    if (!doc) {
      emptyMsg.hidden = false;
      prose.hidden = true;
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
    prose.hidden = false;
    titleInput.disabled = false;
    titleInput.value = doc.title;
    deleteBtn.hidden = false;
    addStoryBtn.hidden = false;
    populateProjectSelect(doc.projectId || "");

    // Only update prose value on doc switch (avoid resetting cursor mid-type)
    if (prose.dataset.docId !== doc.id) {
      prose.value = doc.body || "";
      prose.dataset.docId = doc.id;
      autoGrow(prose);
    }

    divider.hidden = doc.stories.length === 0;
    container.innerHTML = "";
    doc.stories.forEach((story, idx) => {
      container.appendChild(buildStoryBlock(story, idx));
    });
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
      </div>
    `;

    const titleInput = block.querySelector(".story-title-input");
    const bodyInput = block.querySelector(".story-body");
    const acInput = block.querySelector(".story-ac");
    const statusSel = block.querySelector(".story-status");
    const prioritySel = block.querySelector(".story-priority");
    const deleteBtn = block.querySelector(".story-delete");

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
    document.getElementById("deleteDocBtn").addEventListener("click", deleteDoc);

    const prose = document.getElementById("docProse");
    prose.addEventListener("input", () => {
      const doc = currentDoc();
      if (!doc) return;
      doc.body = prose.value;
      doc.updatedAt = new Date().toISOString();
      saveDocs();
      autoGrow(prose);
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
