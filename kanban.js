// DataScope Kanban — drag-and-drop board with countdowns and reminders.
(() => {
  // ---------- Storage ----------
  const STORE_KEY = "datascope_kanban";
  const API_KEY_STORE = "datascope_anthropic_key";

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  const TYPE_CONFIG = {
    project: { label: 'Project', childType: 'epic' },
    epic:    { label: 'Epic',    childType: 'story' },
    story:   { label: 'Story',   childType: null },
  };

  function getAllCards() {
    const all = [];
    state.columns.forEach(col => col.cards.forEach(card => all.push({ card, colId: col.id })));
    return all;
  }

  function findCardById(id) {
    for (const col of state.columns) {
      const card = col.cards.find(c => c.id === id);
      if (card) return { card, colId: col.id };
    }
    return null;
  }

  function getChildren(parentId) {
    const all = [];
    state.columns.forEach(col => col.cards.forEach(card => {
      if (card.parentId === parentId) all.push({ card, colId: col.id });
    }));
    return all;
  }

  function defaultColumns() {
    return [
      { id: uid(), title: "To Do", cards: [] },
      { id: uid(), title: "In Progress", cards: [] },
      { id: uid(), title: "Done", cards: [] },
    ];
  }

  function defaultBoard(teamId) {
    return {
      id: uid(),
      teamId: teamId || null,
      boardTitle: teamId ? "Team Board" : "My Board",
      columns: defaultColumns(),
    };
  }

  function loadBoards() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
      return [{ ...data, id: data.id || uid(), teamId: null }];
    } catch (_) {}
    return null;
  }

  let boards = loadBoards() || [defaultBoard(null)];

  function getActiveBoard() {
    const ds = window.datascope;
    const teamId = ds?.activeTeamId || null;
    let board = boards.find(b => (b.teamId || null) === teamId);
    if (!board) {
      board = defaultBoard(teamId);
      boards.push(board);
    }
    return board;
  }

  let state = getActiveBoard();

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(boards));
    } catch (_) {}
  }

  // ---------- Countdown helpers ----------
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

  // ---------- Notifications ----------
  const firedReminders = new Set(
    JSON.parse(localStorage.getItem("datascope_fired_reminders") || "[]")
  );

  function saveFired() {
    // Keep the set pruned to avoid unbounded growth.
    const arr = [...firedReminders].slice(-500);
    localStorage.setItem("datascope_fired_reminders", JSON.stringify(arr));
  }

  function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    state.columns.forEach((col) => {
      col.cards.forEach((card) => {
        if (!card.reminder) return;
        if (card.reminder <= today && !firedReminders.has(card.id + "@" + card.reminder)) {
          firedReminders.add(card.id + "@" + card.reminder);
          saveFired();
          new Notification(`Reminder: ${card.title}`, {
            body: card.dueDate ? `Due: ${card.dueDate}` : "",
          });
        }
      });
    });
  }

  // ---------- Drag state ----------
  let dragCardId = null;
  let dragFromColId = null;

  // ---------- View state ----------
  let viewMode = "board"; // "board" | "list" | "gantt"

  function setView(mode) {
    viewMode = mode;
    document.getElementById("board").hidden = mode !== "board";
    document.getElementById("listView").hidden = mode !== "list";
    document.getElementById("ganttView").hidden = mode !== "gantt";
    document.getElementById("addColumnBtn").style.display = mode === "board" ? "" : "none";
    document.querySelectorAll(".view-toggle-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.view === mode);
    });
    if (mode === "gantt") renderGantt();
    if (mode === "list") renderList();
  }

  // ---------- Multi-select state ----------
  let selectedCards = new Set();
  let selectionMode = false;

  function toggleCardSelection(cardId) {
    if (selectedCards.has(cardId)) selectedCards.delete(cardId);
    else selectedCards.add(cardId);
    const el = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (el) el.classList.toggle("selected", selectedCards.has(cardId));
    updateBulkBar();
  }

  function enterSelectionMode() {
    selectionMode = true;
    selectedCards.clear();
    const btn = document.getElementById("selectModeBtn");
    if (btn) { btn.textContent = "✕ Cancel"; btn.classList.add("active"); }
    renderAll();
    renderBulkBar();
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedCards.clear();
    const btn = document.getElementById("selectModeBtn");
    if (btn) { btn.textContent = "Select"; btn.classList.remove("active"); }
    renderAll();
    const bar = document.getElementById("bulkBar");
    if (bar) bar.remove();
  }

  function renderBulkBar() {
    let bar = document.getElementById("bulkBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "bulkBar";
      bar.className = "bulk-bar";
      const boardHeader = document.querySelector(".board-header");
      boardHeader.insertAdjacentElement("afterend", bar);
    }
    updateBulkBar();
  }

  function updateBulkBar() {
    const bar = document.getElementById("bulkBar");
    if (!bar) return;
    const count = selectedCards.size;
    const projects = loadGlobalProjects();
    bar.innerHTML = `
      <span class="bulk-count">${count ? `${count} card${count !== 1 ? "s" : ""} selected` : "Select cards to take action"}</span>
      <div class="bulk-actions${count ? "" : " bulk-actions-hidden"}">
        <div class="bulk-group">
          <select id="bulkProjectSel" class="bulk-select">
            <option value="">Assign to project…</option>
            ${projects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
          </select>
          <button class="btn btn-ghost btn-sm" id="bulkAssignBtn">Apply</button>
        </div>
        <div class="bulk-group">
          <select id="bulkColSel" class="bulk-select">
            <option value="">Move to column…</option>
            ${state.columns.map((c) => `<option value="${c.id}">${c.title}</option>`).join("")}
          </select>
          <button class="btn btn-ghost btn-sm" id="bulkMoveBtn">Apply</button>
        </div>
        <div class="bulk-group">
          <select id="bulkPriSel" class="bulk-select">
            <option value="">Set priority…</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
          <button class="btn btn-ghost btn-sm" id="bulkPriBtn">Apply</button>
        </div>
        <button class="btn btn-ghost btn-sm danger" id="bulkDeleteBtn">Delete</button>
      </div>
    `;
    if (count) {
      document.getElementById("bulkAssignBtn").addEventListener("click", () => {
        const v = document.getElementById("bulkProjectSel").value;
        if (v) bulkSetField("projectId", v);
      });
      document.getElementById("bulkMoveBtn").addEventListener("click", () => {
        const v = document.getElementById("bulkColSel").value;
        if (v) bulkMoveToColumn(v);
      });
      document.getElementById("bulkPriBtn").addEventListener("click", () => {
        const v = document.getElementById("bulkPriSel").value;
        if (v) bulkSetField("priority", v);
      });
      document.getElementById("bulkDeleteBtn").addEventListener("click", bulkDelete);
    }
  }

  function bulkSetField(field, value) {
    state.columns.forEach((col) => {
      col.cards.forEach((card) => { if (selectedCards.has(card.id)) card[field] = value; });
    });
    save();
    exitSelectionMode();
  }

  function bulkMoveToColumn(targetColId) {
    const targetCol = state.columns.find((c) => c.id === targetColId);
    if (!targetCol) return;
    const moving = [];
    state.columns.forEach((col) => {
      col.cards = col.cards.filter((card) => {
        if (selectedCards.has(card.id)) { moving.push(card); return false; }
        return true;
      });
    });
    targetCol.cards.push(...moving);
    save();
    exitSelectionMode();
  }

  function bulkDelete() {
    const count = selectedCards.size;
    if (!confirm(`Delete ${count} card${count !== 1 ? "s" : ""}?`)) return;
    state.columns.forEach((col) => {
      col.cards = col.cards.filter((card) => !selectedCards.has(card.id));
    });
    save();
    exitSelectionMode();
  }

  // ---------- Filter state ----------
  let activeFilter = "all";

  function cardMatchesFilter(card) {
    if (activeFilter === "all") return true;
    if (activeFilter === "high") return card.priority === "high";
    if (activeFilter === "medium") return card.priority === "medium";
    if (activeFilter === "low") return card.priority === "low";
    if (activeFilter === "overdue") {
      if (!card.dueDate) return false;
      return new Date(card.dueDate) < new Date();
    }
    return true;
  }

  // ---------- Rendering ----------
  function renderAll() {
    renderBoard();
    updateCountdowns();
    if (viewMode === "gantt") renderGantt();
    if (viewMode === "list") renderList();
    if (selectionMode) updateBulkBar();
  }

  function renderBoard() {
    const board = document.getElementById("board");
    board.innerHTML = "";
    state.columns.forEach((col) => {
      board.appendChild(buildColumn(col));
    });
    // + New column ghost
    const ghost = document.createElement("div");
    ghost.className = "column";
    ghost.style.cssText =
      "min-height:80px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:.5;border-style:dashed;transition:opacity .2s";
    ghost.textContent = "+ New column";
    ghost.addEventListener("click", addColumn);
    ghost.addEventListener("mouseenter", () => (ghost.style.opacity = "1"));
    ghost.addEventListener("mouseleave", () => (ghost.style.opacity = ".5"));
    board.appendChild(ghost);
  }

  function buildColumn(col) {
    const el = document.createElement("div");
    el.className = "column";
    el.dataset.colId = col.id;

    // Header
    const header = document.createElement("div");
    header.className = "column-header";

    const title = document.createElement("div");
    title.className = "column-title";
    title.contentEditable = "true";
    title.spellcheck = false;
    title.textContent = col.title;
    title.addEventListener("blur", () => {
      col.title = title.textContent.trim() || "Untitled";
      renderBadge();
      save();
    });
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); title.blur(); }
    });

    const count = document.createElement("span");
    count.className = "column-count";
    count.textContent = col.cards.length;

    const menuWrap = document.createElement("div");
    menuWrap.className = "column-menu";
    const menuBtn = document.createElement("button");
    menuBtn.className = "col-menu-btn";
    menuBtn.textContent = "⋯";
    menuBtn.setAttribute("aria-label", "Column options");
    menuBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleColMenu(menuWrap, col); });
    menuWrap.appendChild(menuBtn);
    header.append(title, count, menuWrap);

    // Cards list
    const list = document.createElement("div");
    list.className = "cards-list";
    list.dataset.colId = col.id;

    col.cards.forEach((card) => {
      const cardEl = buildCard(card, col.id);
      if (!cardMatchesFilter(card)) cardEl.classList.add("hidden");
      list.appendChild(cardEl);
    });

    // Drag-over
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.classList.add("drag-over");
      const afterEl = getDragAfterElement(list, e.clientY);
      const placeholder = document.querySelector(".drop-placeholder");
      if (placeholder) placeholder.remove();
      const ph = document.createElement("div");
      ph.className = "drop-placeholder";
      if (afterEl) list.insertBefore(ph, afterEl);
      else list.appendChild(ph);
    });
    list.addEventListener("dragleave", (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove("drag-over");
        document.querySelector(".drop-placeholder")?.remove();
      }
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("drag-over");
      document.querySelector(".drop-placeholder")?.remove();
      if (!dragCardId) return;
      const fromCol = state.columns.find((c) => c.id === dragFromColId);
      if (!fromCol) return;
      const cardIdx = fromCol.cards.findIndex((c) => c.id === dragCardId);
      if (cardIdx === -1) return;
      const [card] = fromCol.cards.splice(cardIdx, 1);
      const afterEl = getDragAfterElement(list, e.clientY);
      if (afterEl) {
        const afterId = afterEl.dataset.cardId;
        const insertIdx = col.cards.findIndex((c) => c.id === afterId);
        col.cards.splice(insertIdx, 0, card);
      } else {
        col.cards.push(card);
      }
      dragCardId = null;
      dragFromColId = null;
      save();
      renderAll();
    });

    // Add card button
    const addBtn = document.createElement("button");
    addBtn.className = "add-card-btn";
    addBtn.textContent = "+ Add card";
    addBtn.addEventListener("click", () => openModal(null, col.id));

    el.append(header, list, addBtn);

    function renderBadge() {
      count.textContent = col.cards.length;
    }

    return el;
  }

  function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll(".card:not(.dragging)")];
    return elements.reduce((closest, el) => {
      const box = el.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > (closest.offset ?? -Infinity)) {
        return { offset, element: el };
      }
      return closest;
    }, {}).element;
  }

  function buildCard(card, colId) {
    const el = document.createElement("div");
    el.className = `card priority-${card.priority}`;
    el.dataset.cardId = card.id;

    if (selectionMode) {
      el.classList.toggle("selected", selectedCards.has(card.id));
      el.draggable = false;

      const cb = document.createElement("div");
      cb.className = "card-checkbox";
      cb.setAttribute("aria-label", "Select card");
      cb.innerHTML = selectedCards.has(card.id)
        ? `<svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : "";
      el.appendChild(cb);

      el.addEventListener("click", (e) => { e.stopPropagation(); toggleCardSelection(card.id); });
    } else {
      el.draggable = true;
      el.addEventListener("dragstart", () => {
        dragCardId = card.id;
        dragFromColId = colId;
        el.classList.add("dragging");
        setTimeout(() => el.classList.add("dragging"), 0);
      });
      el.addEventListener("dragend", () => {
        el.classList.remove("dragging");
        document.querySelector(".drop-placeholder")?.remove();
      });
    }

    const cardType = card.cardType || 'story';
    const typeConf = TYPE_CONFIG[cardType];

    const typeBadge = document.createElement('span');
    typeBadge.className = `card-type-badge card-type-${cardType}`;
    typeBadge.textContent = typeConf.label;
    el.appendChild(typeBadge);

    if (card.parentId) {
      const parentEntry = findCardById(card.parentId);
      if (parentEntry) {
        const parentChip = document.createElement('div');
        parentChip.className = 'card-parent-chip';
        parentChip.textContent = '↑ ' + parentEntry.card.title;
        parentChip.title = 'Parent: ' + parentEntry.card.title;
        parentChip.addEventListener('click', (e) => { e.stopPropagation(); openModal(parentEntry.card, parentEntry.colId); });
        el.appendChild(parentChip);
      }
    }

    const title = document.createElement("p");
    title.className = "card-title";
    title.textContent = card.title;

    el.appendChild(title);

    if (card.description) {
      const desc = document.createElement("p");
      desc.className = "card-desc";
      desc.textContent = card.description;
      el.appendChild(desc);
    }

    if (card.tags?.length) {
      const tagsEl = document.createElement("div");
      tagsEl.className = "card-tags";
      card.tags.forEach((t) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        tagsEl.appendChild(span);
      });
      el.appendChild(tagsEl);
    }

    // Attachment accordions
    if (card.attachments) {
      const accTypes = [
        { key: "canvases", label: "Canvas" },
        { key: "charts", label: "Charts" },
        { key: "decks", label: "Decks" }
      ];
      accTypes.forEach(({ key, label }) => {
        const items = card.attachments[key];
        if (!items || !items.length) return;
        const acc = document.createElement("div");
        acc.className = "card-accordion";
        const accH = document.createElement("button");
        accH.type = "button";
        accH.className = "card-acc-header";
        const accArrow = document.createElement("span");
        accArrow.className = "card-acc-arrow";
        accArrow.textContent = "▸";
        accH.appendChild(accArrow);
        accH.appendChild(document.createTextNode(" " + label + " "));
        const accCount = document.createElement("span");
        accCount.className = "card-acc-count";
        accCount.textContent = "(" + items.length + ")";
        accH.appendChild(accCount);

        const accBody = document.createElement("div");
        accBody.className = "card-acc-body";
        accBody.hidden = true;

        items.forEach(item => {
          const row = document.createElement("div");
          row.className = "card-acc-item";
          row.style.cursor = "pointer";
          if (item.thumbnail || item.image) {
            const img = document.createElement("img");
            img.className = "card-acc-thumb";
            img.src = item.thumbnail || item.image;
            row.appendChild(img);
          }
          const nm = document.createElement("span");
          nm.className = "card-acc-name";
          nm.textContent = item.name || "Untitled";
          if (key === "decks" && item.slideCount) nm.textContent += " (" + item.slideCount + " slides)";
          row.appendChild(nm);
          row.addEventListener("click", (e) => { e.stopPropagation(); showPreview(key, item); });
          accBody.appendChild(row);
        });

        accH.addEventListener("click", (e) => {
          e.stopPropagation();
          accBody.hidden = !accBody.hidden;
          accArrow.textContent = accBody.hidden ? "▸" : "▾";
        });
        acc.appendChild(accH);
        acc.appendChild(accBody);
        el.appendChild(acc);
      });
    }

    // Children accordion (for projects and epics)
    if (typeConf.childType) {
      const children = getChildren(card.id);
      if (children.length) {
        const childLabel = typeConf.childType === 'epic' ? 'Epics' : 'Stories';
        const acc = document.createElement('div');
        acc.className = 'card-accordion card-children-acc';
        const accH = document.createElement('button');
        accH.type = 'button';
        accH.className = 'card-acc-header';
        const arrow = document.createElement('span');
        arrow.className = 'card-acc-arrow';
        arrow.textContent = '▸';
        accH.appendChild(arrow);
        accH.appendChild(document.createTextNode(' ' + childLabel + ' '));
        const cnt = document.createElement('span');
        cnt.className = 'card-acc-count';
        cnt.textContent = '(' + children.length + ')';
        accH.appendChild(cnt);
        const accBody = document.createElement('div');
        accBody.className = 'card-acc-body';
        accBody.hidden = true;
        children.forEach(({ card: child, colId: childColId }) => {
          const childRow = document.createElement('div');
          childRow.className = 'card-child-row';
          const childType = document.createElement('span');
          childType.className = `card-child-row-type card-type-${child.cardType || 'story'}`;
          childType.textContent = TYPE_CONFIG[child.cardType || 'story'].label;
          childRow.appendChild(childType);
          childRow.appendChild(document.createTextNode(child.title));
          childRow.addEventListener('click', (e) => { e.stopPropagation(); openModal(child, childColId); });
          accBody.appendChild(childRow);
        });
        accH.addEventListener('click', (e) => { e.stopPropagation(); accBody.hidden = !accBody.hidden; arrow.textContent = accBody.hidden ? '▸' : '▾'; });
        acc.appendChild(accH);
        acc.appendChild(accBody);
        el.appendChild(acc);
      }
    }

    // Footer: countdown + edit
    const footer = document.createElement("div");
    footer.className = "card-footer";

    if (card.dueDate) {
      const cd = formatCountdown(card.dueDate);
      if (cd) {
        const badge = document.createElement("span");
        badge.className = `countdown ${cd.cls}`;
        badge.dataset.dueDate = card.dueDate;
        badge.textContent = `⏱ ${cd.text}`;
        footer.appendChild(badge);
      }
    } else {
      footer.appendChild(document.createElement("span")); // spacer
    }

    const editBtn = document.createElement("button");
    editBtn.className = "card-edit-btn";
    editBtn.textContent = "✎";
    editBtn.title = "Edit card";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(card, colId);
    });
    footer.appendChild(editBtn);
    el.appendChild(footer);

    if (!selectionMode) el.addEventListener("click", () => openModal(card, colId));
    return el;
  }

  function toggleColMenu(wrap, col) {
    const existing = wrap.querySelector(".col-dropdown");
    if (existing) { existing.remove(); return; }

    // Close any other open dropdowns.
    document.querySelectorAll(".col-dropdown").forEach((d) => d.remove());

    const menu = document.createElement("div");
    menu.className = "col-dropdown";

    const addCardItem = makeMenuBtn("+ Add card", () => openModal(null, col.id));
    const clearDoneItem = makeMenuBtn("Clear done cards", () => {
      col.cards = col.cards.filter((c) => {
        const doneCol = state.columns.find((co) => co.title.toLowerCase() === "done");
        return !(doneCol && doneCol.id === col.id);
      });
      save(); renderAll();
    });
    const deleteItem = makeMenuBtn("Delete column", () => {
      if (col.cards.length > 0 && !confirm(`Delete "${col.title}" and its ${col.cards.length} card(s)?`)) return;
      state.columns = state.columns.filter((c) => c.id !== col.id);
      save(); renderAll();
    }, true);

    menu.append(addCardItem, clearDoneItem, deleteItem);
    wrap.appendChild(menu);

    // Close on outside click
    setTimeout(() => {
      document.addEventListener("click", () => menu.remove(), { once: true });
    }, 0);
  }

  function makeMenuBtn(label, onClick, danger = false) {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (danger) btn.classList.add("danger");
    btn.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    return btn;
  }

  // ---------- List view ----------
  function renderList() {
    const container = document.getElementById("listView");
    if (!container) return;
    container.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "list-view-wrap";

    state.columns.forEach((col) => {
      const filtered = col.cards.filter(cardMatchesFilter);

      const section = document.createElement("div");
      section.className = "list-section";

      const header = document.createElement("div");
      header.className = "list-section-header";
      const headerTitle = document.createElement("span");
      headerTitle.className = "list-section-title";
      headerTitle.textContent = col.title;
      const headerCount = document.createElement("span");
      headerCount.className = "list-section-count";
      headerCount.textContent = filtered.length;
      header.appendChild(headerTitle);
      header.appendChild(headerCount);
      section.appendChild(header);

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "list-empty";
        empty.textContent = "No cards";
        section.appendChild(empty);
      }

      const table = document.createElement("div");
      table.className = "list-table";

      filtered.forEach((card) => {
        const row = document.createElement("div");
        row.className = `list-row priority-${card.priority}`;
        row.addEventListener("click", () => openModal(card, col.id));

        const priCell = document.createElement("span");
        priCell.className = "list-cell list-cell-pri";
        const priDot = document.createElement("span");
        priDot.className = `list-pri-dot priority-${card.priority}`;
        priCell.appendChild(priDot);

        const typeCell = document.createElement("span");
        typeCell.className = `list-cell list-cell-type card-type-${card.cardType || 'story'}`;
        typeCell.textContent = TYPE_CONFIG[card.cardType || 'story'].label;

        const titleCell = document.createElement("span");
        titleCell.className = "list-cell list-cell-title";
        if (card.parentId) {
          const parentEntry = findCardById(card.parentId);
          if (parentEntry) {
            const parentTag = document.createElement("span");
            parentTag.className = "list-parent-tag";
            parentTag.textContent = parentEntry.card.title;
            titleCell.appendChild(parentTag);
          }
        }
        const titleText = document.createElement("span");
        titleText.textContent = card.title;
        titleCell.appendChild(titleText);

        const tagsCell = document.createElement("span");
        tagsCell.className = "list-cell list-cell-tags";
        (card.tags || []).forEach((t) => {
          const tag = document.createElement("span");
          tag.className = "tag";
          tag.textContent = t;
          tagsCell.appendChild(tag);
        });

        const dateCell = document.createElement("span");
        dateCell.className = "list-cell list-cell-date";
        if (card.dueDate) {
          const cd = formatCountdown(card.dueDate);
          if (cd) {
            const badge = document.createElement("span");
            badge.className = `countdown ${cd.cls}`;
            badge.textContent = cd.text;
            dateCell.appendChild(badge);
          }
        }

        const childrenCell = document.createElement("span");
        childrenCell.className = "list-cell list-cell-children";
        const childType = TYPE_CONFIG[card.cardType || 'story'].childType;
        if (childType) {
          const children = getChildren(card.id);
          if (children.length) {
            childrenCell.textContent = children.length + " " + (childType === "epic" ? "epic" : "stor") + (children.length !== 1 ? (childType === "epic" ? "s" : "ies") : (childType === "story" ? "y" : ""));
          }
        }

        row.append(priCell, typeCell, titleCell, tagsCell, childrenCell, dateCell);
        table.appendChild(row);
      });

      section.appendChild(table);
      wrap.appendChild(section);
    });

    container.appendChild(wrap);
  }

  // ---------- Gantt ----------
  function buildGanttHierarchy(entriesWithDates) {
    const entryMap = new Map(entriesWithDates.map(e => [e.card.id, e]));
    const result = [];
    const visited = new Set();

    function addCard(card, col, indent) {
      if (visited.has(card.id)) return;
      visited.add(card.id);
      if (entryMap.has(card.id)) result.push({ card, col, indent });
    }

    function addEpicAndStories(epicCard, epicCol, indent) {
      addCard(epicCard, epicCol, indent);
      state.columns.forEach(c => c.cards.forEach(child => {
        if (child.parentId === epicCard.id) addCard(child, c, indent + 1);
      }));
    }

    // Pass 1: projects and their epics/stories
    state.columns.forEach(col => col.cards.forEach(card => {
      if ((card.cardType || 'story') !== 'project') return;
      addCard(card, col, 0);
      state.columns.forEach(c => c.cards.forEach(epic => {
        if (epic.parentId === card.id) addEpicAndStories(epic, c, 1);
      }));
    }));

    // Pass 2: epics not under a project (or project not in chart)
    state.columns.forEach(col => col.cards.forEach(card => {
      if ((card.cardType || 'story') !== 'epic') return;
      addEpicAndStories(card, col, 0);
    }));

    // Pass 3: remaining entries (stories without epic, untyped)
    entriesWithDates.forEach(e => {
      if (!visited.has(e.card.id)) result.push({ card: e.card, col: e.col, indent: 0 });
    });

    return result;
  }

  function renderGantt() {
    const container = document.getElementById("ganttView");
    if (!container) return;
    container.innerHTML = "";

    const entries = [];
    state.columns.forEach((col) => {
      col.cards.forEach((card) => {
        if (!cardMatchesFilter(card)) return;
        if (!card.startDate && !card.dueDate) return;
        entries.push({ card, col });
      });
    });

    if (!entries.length) {
      const msg = document.createElement("p");
      msg.className = "gantt-empty";
      msg.textContent = "No cards with dates yet. Add a start or due date to a card to see it here.";
      container.appendChild(msg);
      return;
    }

    const hierarchyList = buildGanttHierarchy(entries);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allDates = [today];
    entries.forEach(({ card }) => {
      if (card.startDate) allDates.push(new Date(card.startDate + "T00:00:00"));
      if (card.dueDate) allDates.push(new Date(card.dueDate + "T00:00:00"));
    });

    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 14);
    const totalMs = maxDate - minDate;
    const totalDays = Math.ceil(totalMs / 86400000);

    function datePct(dateStr) {
      const d = new Date(dateStr + "T00:00:00");
      return Math.max(0, Math.min(100, ((d - minDate) / totalMs) * 100));
    }
    const todayPct = Math.max(0, Math.min(100, ((today - minDate) / totalMs) * 100));

    const ticks = [];
    if (totalDays <= 60) {
      const first = new Date(minDate);
      const dow = first.getDay();
      first.setDate(first.getDate() + (8 - dow) % 7);
      for (let d = new Date(first); d <= maxDate; d.setDate(d.getDate() + 7)) {
        const nd = new Date(d);
        ticks.push({ pct: ((nd - minDate) / totalMs) * 100, label: nd.toLocaleDateString(undefined, { month: "short", day: "numeric" }) });
      }
    } else {
      for (let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1); d <= maxDate; d.setMonth(d.getMonth() + 1)) {
        const nd = new Date(d);
        ticks.push({ pct: ((nd - minDate) / totalMs) * 100, label: nd.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) });
      }
    }

    function makeTrack(cls, h) {
      const t = document.createElement("div");
      t.className = "gantt-track " + cls;
      if (h) t.style.height = h + "px";
      ticks.forEach(({ pct }) => {
        if (pct < 0 || pct > 100) return;
        const gl = document.createElement("div");
        gl.className = "gantt-grid-line";
        gl.style.left = pct + "%";
        t.appendChild(gl);
      });
      const tl = document.createElement("div");
      tl.className = "gantt-today-line";
      tl.style.left = todayPct + "%";
      t.appendChild(tl);
      return t;
    }

    const wrap = document.createElement("div");
    wrap.className = "gantt-wrap";

    // Header row
    const hdrRow = document.createElement("div");
    hdrRow.className = "gantt-row gantt-header-row";
    const hdrLabel = document.createElement("div");
    hdrLabel.className = "gantt-label";
    const hdrTrack = makeTrack("gantt-header-track", 36);
    ticks.forEach(({ pct, label }) => {
      if (pct < 0 || pct > 100) return;
      const el = document.createElement("div");
      el.className = "gantt-tick-label";
      el.style.left = pct + "%";
      el.textContent = label;
      hdrTrack.appendChild(el);
    });
    hdrRow.appendChild(hdrLabel);
    hdrRow.appendChild(hdrTrack);
    wrap.appendChild(hdrRow);

    // Hierarchy rows
    hierarchyList.forEach(({ card, col, indent }) => {
      const row = document.createElement("div");
      row.className = `gantt-row gantt-card-row gantt-indent-${indent}`;
      row.addEventListener("click", () => openModal(card, col.id));

      const label = document.createElement("div");
      label.className = "gantt-label gantt-card-label";

      const typeDot = document.createElement("span");
      typeDot.className = `gantt-type-dot type-${card.cardType || 'story'}`;
      label.appendChild(typeDot);

      const titleSpan = document.createElement("span");
      const maxLen = indent === 0 ? 22 : indent === 1 ? 18 : 14;
      titleSpan.textContent = card.title.length > maxLen ? card.title.slice(0, maxLen) + "…" : card.title;
      titleSpan.title = card.title + ' [' + col.title + ']';
      label.appendChild(titleSpan);

      const colBadge = document.createElement("span");
      colBadge.style.cssText = "font-size:10px;color:var(--muted);margin-left:auto;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50px";
      colBadge.textContent = col.title;
      colBadge.title = col.title;
      label.appendChild(colBadge);

      const track = makeTrack("gantt-card-track", indent === 0 ? 44 : 36);

      const startPct = card.startDate ? datePct(card.startDate) : null;
      const endPct = card.dueDate ? datePct(card.dueDate) : null;

      if (startPct !== null && endPct !== null) {
        const bar = document.createElement("div");
        bar.className = `gantt-bar priority-${card.priority}`;
        const left = Math.min(startPct, endPct);
        const rawW = Math.max(Math.abs(endPct - startPct), 0.5);
        bar.style.left = left + "%";
        bar.style.width = Math.min(rawW, 100 - left) + "%";
        if (indent === 0) bar.style.height = "24px";
        bar.title = `${card.title}\n${card.startDate} → ${card.dueDate}`;
        bar.addEventListener("click", (e) => { e.stopPropagation(); openModal(card, col.id); });
        track.appendChild(bar);
      } else {
        const mp = endPct ?? startPct;
        if (mp !== null) {
          const ms = document.createElement("div");
          ms.className = `gantt-milestone priority-${card.priority}`;
          ms.style.left = mp + "%";
          ms.title = card.title;
          ms.addEventListener("click", (e) => { e.stopPropagation(); openModal(card, col.id); });
          track.appendChild(ms);
        }
      }

      row.appendChild(label);
      row.appendChild(track);
      wrap.appendChild(row);
    });

    container.appendChild(wrap);
  }

  // ---------- Modal ----------
  let editingCardId = null;
  let editingColId = null;
  let modalAttachments = { canvases: [], charts: [], decks: [] };

  function loadAvailableCanvases() {
    try {
      const raw = localStorage.getItem("datascope_canvas");
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.map(c => ({ id: c.id, name: c.name || "Untitled" }));
      return [];
    } catch (_) { return []; }
  }

  function loadAvailableCharts() {
    try {
      const raw = localStorage.getItem("datascope_saved_charts");
      if (!raw) return [];
      return JSON.parse(raw).map(c => ({ id: c.id, name: c.name || "Untitled", thumbnail: c.thumbnail || "" }));
    } catch (_) { return []; }
  }

  function loadAvailableDecks() {
    try {
      const raw = localStorage.getItem("datascope_slides");
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (data.projects) return data.projects.map(p => ({ id: p.id, name: p.name || "Untitled", slideCount: p.slides?.length || 0 }));
      return [];
    } catch (_) { return []; }
  }

  function buildAttachSections() {
    const container = document.getElementById("attachSections");
    if (!container) return;
    container.innerHTML = "";

    const sections = [
      { key: "canvases", label: "Canvas", loadFn: loadAvailableCanvases },
      { key: "charts", label: "Charts", loadFn: loadAvailableCharts },
      { key: "decks", label: "Decks", loadFn: loadAvailableDecks }
    ];

    sections.forEach(({ key, label, loadFn }) => {
      const section = document.createElement("div");
      section.className = "attach-accordion";

      const header = document.createElement("button");
      header.type = "button";
      header.className = "attach-accordion-header";
      const arrow = document.createElement("span");
      arrow.className = "attach-arrow";
      arrow.textContent = "▸";
      const headerText = document.createElement("span");
      headerText.textContent = " " + label + " ";
      const count = document.createElement("span");
      count.className = "attach-count";

      header.appendChild(arrow);
      header.appendChild(headerText);
      header.appendChild(count);

      const body = document.createElement("div");
      body.className = "attach-accordion-body";
      body.hidden = true;

      header.addEventListener("click", () => {
        body.hidden = !body.hidden;
        arrow.textContent = body.hidden ? "▸" : "▾";
      });

      const itemsContainer = document.createElement("div");
      itemsContainer.className = "attach-items-list";

      function renderItems() {
        itemsContainer.innerHTML = "";
        const items = modalAttachments[key] || [];
        count.textContent = "(" + items.length + ")";

        items.forEach((item, idx) => {
          const row = document.createElement("div");
          row.className = "attach-item";
          row.style.cursor = "pointer";
          row.addEventListener("click", () => showPreview(key, item));
          if (item.thumbnail || item.image) {
            const thumb = document.createElement("img");
            thumb.className = "attach-thumb";
            thumb.src = item.thumbnail || item.image;
            row.appendChild(thumb);
          }
          const name = document.createElement("span");
          name.className = "attach-item-name";
          name.textContent = item.name || "Untitled";
          if (key === "decks" && item.slideCount) name.textContent += " (" + item.slideCount + " slides)";
          row.appendChild(name);

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "attach-remove";
          removeBtn.textContent = "×";
          removeBtn.title = "Remove";
          removeBtn.addEventListener("click", () => {
            modalAttachments[key].splice(idx, 1);
            renderItems();
          });
          row.appendChild(removeBtn);
          itemsContainer.appendChild(row);
        });
      }

      renderItems();
      body.appendChild(itemsContainer);

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-ghost btn-sm attach-add-btn";
      addBtn.textContent = "+ Attach";

      const picker = document.createElement("div");
      picker.className = "attach-picker";
      picker.hidden = true;

      addBtn.addEventListener("click", () => {
        picker.hidden = !picker.hidden;
        if (!picker.hidden) {
          picker.innerHTML = "";
          const avail = loadFn();
          const attachedIds = new Set((modalAttachments[key] || []).map(a => a.id));
          const unattached = avail.filter(a => !attachedIds.has(a.id));

          if (!unattached.length) {
            const empty = document.createElement("p");
            empty.className = "attach-picker-empty";
            empty.textContent = "No items available.";
            picker.appendChild(empty);
          } else {
            unattached.forEach(item => {
              const opt = document.createElement("button");
              opt.type = "button";
              opt.className = "attach-picker-item";
              if (item.thumbnail) {
                const img = document.createElement("img");
                img.className = "attach-picker-thumb";
                img.src = item.thumbnail;
                opt.appendChild(img);
              }
              const nm = document.createElement("span");
              nm.textContent = item.name || "Untitled";
              if (key === "decks" && item.slideCount) nm.textContent += " (" + item.slideCount + " slides)";
              opt.appendChild(nm);
              opt.addEventListener("click", () => {
                if (!modalAttachments[key]) modalAttachments[key] = [];
                modalAttachments[key].push({ ...item });
                picker.hidden = true;
                renderItems();
              });
              picker.appendChild(opt);
            });
          }
        }
      });

      body.appendChild(addBtn);
      body.appendChild(picker);
      section.appendChild(header);
      section.appendChild(body);
      container.appendChild(section);
    });
  }

  // ---------- Attachment preview ----------
  function loadCanvasById(id) {
    try {
      const raw = localStorage.getItem("datascope_canvas");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data.find(c => c.id === id) || null;
      return null;
    } catch (_) { return null; }
  }

  function loadChartById(id) {
    try {
      const raw = localStorage.getItem("datascope_saved_charts");
      if (!raw) return null;
      return JSON.parse(raw).find(c => c.id === id) || null;
    } catch (_) { return null; }
  }

  function loadDeckById(id) {
    try {
      const raw = localStorage.getItem("datascope_slides");
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.projects) return data.projects.find(p => p.id === id) || null;
      return null;
    } catch (_) { return null; }
  }

  function renderCanvasSnapshot(cd) {
    const shapes = cd.shapes || [];
    const arrows = cd.arrows || [];
    if (!shapes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapes.forEach(s => {
      minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.w); maxY = Math.max(maxY, s.y + s.h);
    });
    const pad = 30, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
    const off = document.createElement("canvas");
    const sc = Math.min(2, 1200 / w);
    off.width = w * sc; off.height = h * sc;
    const c = off.getContext("2d");
    c.scale(sc, sc);
    c.fillStyle = "#0f1126";
    c.fillRect(0, 0, w, h);
    c.translate(pad - minX, pad - minY);

    arrows.forEach(a => {
      const from = shapes.find(s => s.id === a.from);
      const to = shapes.find(s => s.id === a.to);
      if (!from || !to) return;
      const fx = from.x + from.w / 2, fy = from.y + from.h / 2;
      const tx = to.x + to.w / 2, ty = to.y + to.h / 2;
      c.beginPath(); c.moveTo(fx, fy); c.lineTo(tx, ty);
      c.strokeStyle = a.color || "#6ea8ff"; c.lineWidth = 2; c.stroke();
      const ang = Math.atan2(ty - fy, tx - fx);
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(tx - 10 * Math.cos(ang - 0.4), ty - 10 * Math.sin(ang - 0.4));
      c.moveTo(tx, ty);
      c.lineTo(tx - 10 * Math.cos(ang + 0.4), ty - 10 * Math.sin(ang + 0.4));
      c.stroke();
    });

    shapes.forEach(s => {
      c.fillStyle = s.fill || "#1d254a";
      c.strokeStyle = s.stroke || "#6ea8ff";
      c.lineWidth = s.strokeWidth || 1.5;
      if (s.type === "rect" || s.type === "text") {
        const r = 6;
        c.beginPath();
        c.moveTo(s.x + r, s.y);
        c.lineTo(s.x + s.w - r, s.y); c.quadraticCurveTo(s.x + s.w, s.y, s.x + s.w, s.y + r);
        c.lineTo(s.x + s.w, s.y + s.h - r); c.quadraticCurveTo(s.x + s.w, s.y + s.h, s.x + s.w - r, s.y + s.h);
        c.lineTo(s.x + r, s.y + s.h); c.quadraticCurveTo(s.x, s.y + s.h, s.x, s.y + s.h - r);
        c.lineTo(s.x, s.y + r); c.quadraticCurveTo(s.x, s.y, s.x + r, s.y);
        c.closePath();
        if (s.type === "rect") { c.fill(); c.stroke(); }
      } else if (s.type === "circle") {
        c.beginPath();
        c.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
        c.fill(); c.stroke();
      } else if (s.type === "diamond") {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        c.beginPath();
        c.moveTo(cx, s.y); c.lineTo(s.x + s.w, cy); c.lineTo(cx, s.y + s.h); c.lineTo(s.x, cy);
        c.closePath(); c.fill(); c.stroke();
      }
      if (s.label) {
        c.fillStyle = s.textColor || "#e7ecff";
        c.font = (s.fontSize || 14) + "px Inter, system-ui, sans-serif";
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(s.label, s.x + s.w / 2, s.y + s.h / 2);
      }
    });
    return off.toDataURL("image/png");
  }

  function renderDeckPreview(deck, container) {
    (deck.slides || []).forEach((slide, idx) => {
      const card = document.createElement("div");
      card.className = "preview-slide";
      card.style.backgroundColor = slide.bgColor || "#1a1a2e";
      card.style.color = slide.textColor || "#ffffff";
      const num = document.createElement("span");
      num.className = "preview-slide-num";
      num.textContent = idx + 1;
      card.appendChild(num);
      const ct = slide.content || {};
      if (ct.title) { const t = document.createElement("h3"); t.textContent = ct.title; card.appendChild(t); }
      if (ct.subtitle) { const s = document.createElement("p"); s.textContent = ct.subtitle; card.appendChild(s); }
      if (ct.body) { const b = document.createElement("p"); b.className = "preview-slide-body"; b.textContent = ct.body; card.appendChild(b); }
      if (ct.bullets) { const b = document.createElement("p"); b.className = "preview-slide-body"; b.textContent = ct.bullets; card.appendChild(b); }
      if (ct.image) { const img = document.createElement("img"); img.className = "preview-slide-img"; img.src = ct.image; card.appendChild(img); }
      container.appendChild(card);
    });
  }

  function showPreview(type, item) {
    const overlay = document.getElementById("previewOverlay");
    const content = document.getElementById("previewContent");
    const title = document.getElementById("previewTitle");
    const openLink = document.getElementById("previewOpenLink");
    title.textContent = item.name || "Preview";
    content.innerHTML = "";

    if (type === "canvases") {
      openLink.href = "canvas.html";
      const cd = loadCanvasById(item.id);
      if (cd) {
        const src = renderCanvasSnapshot(cd);
        if (src) {
          const img = document.createElement("img");
          img.className = "preview-image";
          img.src = src;
          content.appendChild(img);
        } else { content.innerHTML = '<p class="preview-empty">Canvas is empty.</p>'; }
      } else { content.innerHTML = '<p class="preview-empty">Canvas not found.</p>'; }
    } else if (type === "charts") {
      openLink.href = "charts.html";
      const ch = loadChartById(item.id);
      if (ch && ch.thumbnail) {
        const img = document.createElement("img");
        img.className = "preview-image";
        img.src = ch.thumbnail;
        content.appendChild(img);
      } else { content.innerHTML = '<p class="preview-empty">Chart preview not available.</p>'; }
    } else if (type === "decks") {
      openLink.href = "slides.html";
      const dk = loadDeckById(item.id);
      if (dk && dk.slides?.length) {
        renderDeckPreview(dk, content);
      } else { content.innerHTML = '<p class="preview-empty">Deck not found.</p>'; }
    }
    overlay.hidden = false;
  }

  function closePreview() {
    document.getElementById("previewOverlay").hidden = true;
  }

  function loadGlobalProjects() {
    try {
      const raw = localStorage.getItem("datascope_projects");
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function populateParentSelect(cardType, currentParentId, excludeId) {
    const sel = document.getElementById('cardParent');
    const field = document.getElementById('cardParentField');
    sel.innerHTML = '<option value="">— None —</option>';
    if (cardType === 'project') { field.style.display = 'none'; return; }
    field.style.display = '';
    const targetType = cardType === 'epic' ? 'project' : 'epic';
    getAllCards().forEach(({ card }) => {
      if (card.id === excludeId) return;
      if ((card.cardType || 'story') !== targetType) return;
      const opt = document.createElement('option');
      opt.value = card.id;
      opt.textContent = card.title;
      if (card.id === currentParentId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function populateProjectSelect(selectedId) {
    const sel = document.getElementById("cardProject");
    sel.innerHTML = '<option value="">None</option>';
    loadGlobalProjects().forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function openModal(card, colId) {
    editingCardId = card ? card.id : null;
    editingColId = colId;

    document.getElementById("modalTitle").textContent = card ? "Edit card" : "New card";
    document.getElementById("cardTitle").value = card?.title || "";
    document.getElementById("cardDesc").value = card?.description || "";
    document.getElementById("cardPriority").value = card?.priority || "medium";
    document.getElementById("cardStart").value = card?.startDate ? toDateInput(card.startDate) : "";
    document.getElementById("cardDue").value = card?.dueDate ? toDateInput(card.dueDate) : "";
    document.getElementById("cardReminder").value = card?.reminder ? toDateInput(card.reminder) : "";
    document.getElementById("cardTags").value = card?.tags?.join(", ") || "";
    document.getElementById("deleteCardBtn").hidden = !card;

    // Populate column select
    const colSel = document.getElementById("cardColumn");
    colSel.innerHTML = "";
    state.columns.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.title;
      if (c.id === colId) opt.selected = true;
      colSel.appendChild(opt);
    });

    populateProjectSelect(card?.projectId || "");

    const cardTypeEl = document.getElementById('cardType');
    cardTypeEl.value = card?.cardType || 'story';
    populateParentSelect(cardTypeEl.value, card?.parentId || null, card?.id || null);
    cardTypeEl.onchange = () => populateParentSelect(cardTypeEl.value, null, editingCardId);

    const moveWrap = document.getElementById("cardMoveWrap");
    moveWrap.innerHTML = "";
    const ds = window.datascope;
    if (ds?.userTeams?.length) {
      const lbl = document.createElement("label");
      lbl.className = "team-move-label";
      lbl.textContent = "Board owner";
      moveWrap.appendChild(lbl);
      moveWrap.appendChild(ds.buildTeamMoveSelect(state.teamId || null));
    }

    modalAttachments = JSON.parse(JSON.stringify(card?.attachments || { canvases: [], charts: [], decks: [] }));
    buildAttachSections();

    document.getElementById("modalOverlay").hidden = false;
    document.getElementById("cardTitle").focus();
  }

  function closeModal() {
    document.getElementById("modalOverlay").hidden = true;
    editingCardId = null;
    editingColId = null;
  }

  function saveModal() {
    const title = document.getElementById("cardTitle").value.trim();
    if (!title) { document.getElementById("cardTitle").focus(); return; }

    const targetColId = document.getElementById("cardColumn").value;
    const startRaw = document.getElementById("cardStart").value;
    const dueRaw = document.getElementById("cardDue").value;
    const reminderRaw = document.getElementById("cardReminder").value;
    const tags = document.getElementById("cardTags").value
      .split(",").map((t) => t.trim()).filter(Boolean);
    const moveSel = document.querySelector("#cardMoveWrap .team-move-select");
    const targetTeamId = moveSel ? (moveSel.value || null) : (state.teamId || null);

    const cardType = document.getElementById('cardType').value;
    const parentId = document.getElementById('cardParent').value || null;

    const cardData = {
      title,
      description: document.getElementById("cardDesc").value.trim(),
      priority: document.getElementById("cardPriority").value,
      cardType,
      parentId: cardType === 'project' ? null : parentId,
      startDate: startRaw || "",
      dueDate: dueRaw || "",
      reminder: reminderRaw || "",
      tags,
      projectId: document.getElementById("cardProject").value || "",
      attachments: JSON.parse(JSON.stringify(modalAttachments)),
    };

    const movingToOtherBoard = (targetTeamId || null) !== (state.teamId || null);

    if (editingCardId) {
      let movedCard = null;
      state.columns.forEach((col) => {
        const idx = col.cards.findIndex((c) => c.id === editingCardId);
        if (idx !== -1) {
          const existing = col.cards[idx];
          col.cards[idx] = { ...existing, ...cardData };
          if (movingToOtherBoard) {
            movedCard = col.cards.splice(idx, 1)[0];
          } else if (col.id !== targetColId) {
            const [card] = col.cards.splice(idx, 1);
            const targetCol = state.columns.find((c) => c.id === targetColId);
            if (targetCol) targetCol.cards.push(card);
          }
        }
      });
      if (movingToOtherBoard && movedCard) {
        let destBoard = boards.find(b => (b.teamId || null) === targetTeamId);
        if (!destBoard) {
          destBoard = defaultBoard(targetTeamId);
          boards.push(destBoard);
        }
        const destCol = destBoard.columns[0];
        if (destCol) destCol.cards.push(movedCard);
      }
    } else {
      if (movingToOtherBoard) {
        let destBoard = boards.find(b => (b.teamId || null) === targetTeamId);
        if (!destBoard) {
          destBoard = defaultBoard(targetTeamId);
          boards.push(destBoard);
        }
        const destCol = destBoard.columns[0];
        if (destCol) destCol.cards.push({ id: uid(), ...cardData, createdAt: new Date().toISOString() });
      } else {
        const targetCol = state.columns.find((c) => c.id === targetColId);
        if (!targetCol) return;
        targetCol.cards.push({ id: uid(), ...cardData, createdAt: new Date().toISOString() });
      }
    }

    save();
    closeModal();
    renderAll();
  }

  function deleteCard() {
    if (!editingCardId) return;
    if (!confirm("Delete this card?")) return;
    state.columns.forEach((col) => {
      col.cards.forEach((c) => { if (c.parentId === editingCardId) c.parentId = null; });
      col.cards = col.cards.filter((c) => c.id !== editingCardId);
    });
    save();
    closeModal();
    renderAll();
  }

  // ---------- Column ops ----------
  function addColumn() {
    state.columns.push({ id: uid(), title: "New Column", cards: [] });
    save();
    renderAll();
    // Focus the new column title.
    setTimeout(() => {
      const cols = document.querySelectorAll(".column-title");
      cols[cols.length - 1]?.focus();
    }, 50);
  }

  // ---------- Countdown updater ----------
  function updateCountdowns() {
    document.querySelectorAll(".countdown[data-due-date]").forEach((badge) => {
      const cd = formatCountdown(badge.dataset.dueDate);
      if (!cd) return;
      badge.className = `countdown ${cd.cls}`;
      badge.textContent = `⏱ ${cd.text}`;
    });
  }

  // ---------- Date helpers ----------
  function toDateInput(dateStr) {
    if (!dateStr) return "";
    return dateStr.slice(0, 10);
  }

  // ---------- Plan project ----------
  function openPlanModal() {
    document.getElementById("planDocText").value = "";
    document.getElementById("planFileName").textContent = "No file chosen";
    document.getElementById("planFileInput").value = "";
    document.getElementById("planGenerateBtn").disabled = false;
    document.getElementById("planGenerateBtn").textContent = "Generate cards";

    const colSel = document.getElementById("planTargetCol");
    colSel.innerHTML = "";
    state.columns.forEach((col) => {
      const opt = document.createElement("option");
      opt.value = col.id;
      opt.textContent = col.title;
      colSel.appendChild(opt);
    });

    const status = document.getElementById("planStatus");
    status.hidden = true;
    status.className = "plan-status";

    document.getElementById("planOverlay").hidden = false;
    document.getElementById("planDocText").focus();
  }

  function closePlanModal() {
    document.getElementById("planOverlay").hidden = true;
  }

  function setPlanStatus(type, message) {
    const el = document.getElementById("planStatus");
    el.hidden = false;
    el.className = `plan-status ${type}`;
    if (type === "loading") {
      el.innerHTML = `<span class="plan-spinner"></span>${message}`;
    } else {
      el.textContent = message;
    }
  }

  async function handlePlanGenerate() {
    const apiKey = localStorage.getItem(API_KEY_STORE) || "";
    if (!apiKey) { setPlanStatus("error", "No API key found. Add one via the ⚙️ button in the assistant panel."); return; }

    const docText = document.getElementById("planDocText").value.trim();
    if (!docText) { setPlanStatus("error", "Please paste or upload a document."); return; }

    const targetColId = document.getElementById("planTargetCol").value;
    const targetCol = state.columns.find((c) => c.id === targetColId);
    if (!targetCol) return;

    const genBtn = document.getElementById("planGenerateBtn");
    genBtn.disabled = true;
    genBtn.textContent = "Generating…";
    setPlanStatus("loading", "Analyzing document and extracting tasks…");

    try {
      const tasks = await callClaudeAPI(apiKey, docText);

      tasks.forEach((task) => {
        targetCol.cards.push({
          id: uid(),
          title: String(task.title || "Untitled").slice(0, 120),
          description: String(task.description || ""),
          priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
          startDate: "",
          dueDate: "",
          reminder: "",
          tags: Array.isArray(task.tags) ? task.tags.map((t) => String(t).slice(0, 30)) : [],
          projectId: "",
          createdAt: new Date().toISOString(),
        });
      });

      save();
      renderAll();
      setPlanStatus("success", `Created ${tasks.length} card${tasks.length !== 1 ? "s" : ""} in "${targetCol.title}".`);
      setTimeout(closePlanModal, 1500);
    } catch (err) {
      setPlanStatus("error", err.message);
      genBtn.disabled = false;
      genBtn.textContent = "Generate cards";
    }
  }

  async function callClaudeAPI(apiKey, documentText) {
    const systemPrompt = `You are a project planning assistant. You extract actionable tasks from documents and return them as structured JSON.

Return ONLY a JSON array of task objects. Each object must have:
- "title": string — concise task title, under 60 characters
- "description": string — brief description, 1-2 sentences
- "priority": "high" | "medium" | "low" — based on urgency and importance
- "tags": string[] — 1-3 relevant keyword tags

Guidelines:
- Extract specific, actionable work items
- Break large tasks into smaller concrete steps
- Order by logical work sequence
- Infer priority from context (deadlines, urgency language, dependencies)
- Return ONLY valid JSON, no markdown fences or commentary`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `Extract tasks from this document:\n\n${documentText}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `API request failed (${response.status})`;
      throw new Error(msg);
    }

    const data = await response.json();
    const text = data.content[0].text;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not parse tasks from the API response.");

    const tasks = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(tasks) || !tasks.length) throw new Error("No tasks were extracted from the document.");

    return tasks;
  }

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    // Board title
    const titleEl = document.getElementById("boardTitle");
    titleEl.textContent = state.boardTitle;
    titleEl.addEventListener("blur", () => {
      state.boardTitle = titleEl.textContent.trim() || "My Board";
      save();
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); titleEl.blur(); }
    });

    renderAll();

    // View toggle
    document.querySelectorAll(".view-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    // Select mode button (injected into board-actions)
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.id = "selectModeBtn";
    selectBtn.className = "btn btn-ghost btn-sm";
    selectBtn.textContent = "Select";
    selectBtn.addEventListener("click", () => {
      if (selectionMode) exitSelectionMode();
      else enterSelectionMode();
    });
    document.querySelector(".board-actions").insertBefore(
      selectBtn,
      document.getElementById("addColumnBtn")
    );

    // Add column button
    document.getElementById("addColumnBtn").addEventListener("click", addColumn);

    // Notification button
    document.getElementById("notifBtn").addEventListener("click", () => {
      requestNotificationPermission();
      if (Notification.permission === "granted") {
        alert("Reminders are enabled. You'll receive browser notifications at the scheduled reminder time.");
      } else if (Notification.permission === "denied") {
        alert("Notifications are blocked. Please enable them in your browser settings.");
      }
    });

    // Modal
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalCancel").addEventListener("click", closeModal);
    document.getElementById("modalSave").addEventListener("click", saveModal);
    document.getElementById("deleteCardBtn").addEventListener("click", deleteCard);
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target === document.getElementById("modalOverlay")) closeModal();
    });
    // Preview overlay
    document.getElementById("previewClose").addEventListener("click", closePreview);
    document.getElementById("previewOverlay").addEventListener("click", (e) => {
      if (e.target === document.getElementById("previewOverlay")) closePreview();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!document.getElementById("previewOverlay").hidden) { closePreview(); return; }
        closeModal();
        closePlanModal();
      }
    });

    // Plan project
    document.getElementById("planProjectBtn").addEventListener("click", openPlanModal);
    document.getElementById("planModalClose").addEventListener("click", closePlanModal);
    document.getElementById("planCancelBtn").addEventListener("click", closePlanModal);
    document.getElementById("planGenerateBtn").addEventListener("click", handlePlanGenerate);
    document.getElementById("planOverlay").addEventListener("click", (e) => {
      if (e.target === document.getElementById("planOverlay")) closePlanModal();
    });
    document.getElementById("planFileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById("planFileName").textContent = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById("planDocText").value = ev.target.result;
      };
      reader.readAsText(file);
    });

    // Filters
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.filter;
        document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderAll();
      });
    });

    // Tick every 30s — update countdowns + check reminders.
    setInterval(() => {
      updateCountdowns();
      checkReminders();
    }, 30000);

    checkReminders();

    // Team context switch
    document.addEventListener("datascope:teamchange", () => {
      state = getActiveBoard();
      titleEl.textContent = state.boardTitle;
      renderAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
