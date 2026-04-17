// DataScope Kanban — drag-and-drop board with countdowns and reminders.
(() => {
  // ---------- Storage ----------
  const STORE_KEY = "datascope_kanban";

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  // ---------- Default state ----------
  function defaultState() {
    return {
      boardTitle: "My Board",
      columns: [
        { id: uid(), title: "To Do", cards: [] },
        { id: uid(), title: "In Progress", cards: [] },
        { id: uid(), title: "Done", cards: [] },
      ],
    };
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  const state = load() || defaultState();

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
    el.draggable = true;
    el.dataset.cardId = card.id;

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

    el.addEventListener("click", () => openModal(card, colId));
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

  // ---------- Modal ----------
  let editingCardId = null;
  let editingColId = null;

  function openModal(card, colId) {
    editingCardId = card ? card.id : null;
    editingColId = colId;

    document.getElementById("modalTitle").textContent = card ? "Edit card" : "New card";
    document.getElementById("cardTitle").value = card?.title || "";
    document.getElementById("cardDesc").value = card?.description || "";
    document.getElementById("cardPriority").value = card?.priority || "medium";
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
    const dueRaw = document.getElementById("cardDue").value;
    const reminderRaw = document.getElementById("cardReminder").value;
    const tags = document.getElementById("cardTags").value
      .split(",").map((t) => t.trim()).filter(Boolean);

    const cardData = {
      title,
      description: document.getElementById("cardDesc").value.trim(),
      priority: document.getElementById("cardPriority").value,
      dueDate: dueRaw || "",
      reminder: reminderRaw || "",
      tags,
    };

    if (editingCardId) {
      // Find and update, possibly moving to a different column.
      let found = false;
      state.columns.forEach((col) => {
        const idx = col.cards.findIndex((c) => c.id === editingCardId);
        if (idx !== -1) {
          const existing = col.cards[idx];
          col.cards[idx] = { ...existing, ...cardData };
          found = true;
          if (col.id !== targetColId) {
            // Move to target column.
            const [card] = col.cards.splice(idx, 1);
            const targetCol = state.columns.find((c) => c.id === targetColId);
            if (targetCol) targetCol.cards.push(card);
          }
        }
      });
      if (!found) return; // shouldn't happen
    } else {
      const targetCol = state.columns.find((c) => c.id === targetColId);
      if (!targetCol) return;
      targetCol.cards.push({ id: uid(), ...cardData, createdAt: new Date().toISOString() });
    }

    save();
    closeModal();
    renderAll();
  }

  function deleteCard() {
    if (!editingCardId) return;
    if (!confirm("Delete this card?")) return;
    state.columns.forEach((col) => {
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
