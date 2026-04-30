// DataScope Agent Chat — global floating panel with Claude API tool_use
(() => {
  const AGENTS_KEY = "datascope_agents";
  const API_KEY_STORE = "datascope_anthropic_key";
  const MODEL = "claude-sonnet-4-6";

  if (location.pathname.endsWith("auth.html")) return;

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function teamId() {
    return window.datascope?.activeTeamId || null;
  }

  function loadAgents() {
    try {
      const raw = localStorage.getItem(AGENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function getAgentsForTeam() {
    const tid = teamId();
    return loadAgents().filter(a => (a.teamId || null) === tid);
  }

  // ---- Tool definitions ----
  function getToolDefs(capabilities) {
    const tools = [];

    if (capabilities.includes("notes")) {
      tools.push({
        name: "create_note",
        description: "Create a new note in the Notes tool.",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Note title" },
            body: { type: "string", description: "Note body content" },
            tags: { type: "array", items: { type: "string" }, description: "Tags for the note" },
          },
          required: ["title", "body"],
        },
      });
      tools.push({
        name: "read_notes",
        description: "Read all current notes to understand what exists.",
        input_schema: { type: "object", properties: {} },
      });
    }

    if (capabilities.includes("board")) {
      tools.push({
        name: "create_board_cards",
        description: "Create one or more cards on the kanban board.",
        input_schema: {
          type: "object",
          properties: {
            column: { type: "string", description: "Column name, e.g. 'To Do', 'In Progress', 'Done'. Defaults to 'To Do'." },
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Card title" },
                  description: { type: "string", description: "Card description" },
                  priority: { type: "string", enum: ["high", "medium", "low"], description: "Card priority" },
                  tags: { type: "array", items: { type: "string" }, description: "Tags" },
                  dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
                },
                required: ["title"],
              },
            },
          },
          required: ["cards"],
        },
      });
      tools.push({
        name: "read_board",
        description: "Read the current kanban board state — columns and cards.",
        input_schema: { type: "object", properties: {} },
      });
    }

    if (capabilities.includes("slides")) {
      tools.push({
        name: "create_slide_deck",
        description: "Create a new slide deck with one or more slides.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Deck name" },
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  template: { type: "string", enum: ["title", "title-body", "two-column", "bullets", "section", "quote", "blank"], description: "Slide template" },
                  content: { type: "object", description: "Slide content. Fields depend on template: title→{title,subtitle}, title-body→{title,body}, bullets→{title,bullets}, two-column→{title,left,right}, section→{heading}, quote→{quote,attribution}, blank→{content}" },
                },
                required: ["template", "content"],
              },
            },
          },
          required: ["name", "slides"],
        },
      });
    }

    if (capabilities.includes("canvas")) {
      tools.push({
        name: "add_canvas_shapes",
        description: "Add text shapes to the canvas whiteboard.",
        input_schema: {
          type: "object",
          properties: {
            shapes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string", description: "Text label for the shape" },
                  x: { type: "number", description: "X position (optional, auto-placed if omitted)" },
                  y: { type: "number", description: "Y position (optional, auto-placed if omitted)" },
                },
                required: ["text"],
              },
            },
          },
          required: ["shapes"],
        },
      });
    }

    if (capabilities.includes("charts")) {
      tools.push({
        name: "create_chart",
        description: "Create a saved chart from data.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Chart name" },
            headers: { type: "array", items: { type: "string" }, description: "Column headers, first is X-axis label" },
            rows: { type: "array", items: { type: "array" }, description: "Data rows matching headers" },
            chartType: { type: "string", enum: ["bar", "line", "pie", "doughnut", "scatter", "radar"], description: "Chart type (defaults to bar)" },
          },
          required: ["name", "headers", "rows"],
        },
      });
    }

    return tools;
  }

  // ---- Tool execution ----
  function executeTool(name, input) {
    const tid = teamId();

    switch (name) {
      case "create_note": {
        const key = "datascope_notes";
        let notes = [];
        try { const r = localStorage.getItem(key); if (r) notes = JSON.parse(r); } catch (_) {}
        const note = {
          id: uid(), teamId: tid,
          title: input.title || "",
          body: input.body || "",
          tags: input.tags || [],
          dueDate: "", projectId: "",
          colorIdx: 0, pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        notes.unshift(note);
        localStorage.setItem(key, JSON.stringify(notes));
        window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "notes" } }));
        return { success: true, message: 'Created note "' + note.title + '"' };
      }

      case "read_notes": {
        let notes = [];
        try { const r = localStorage.getItem("datascope_notes"); if (r) notes = JSON.parse(r); } catch (_) {}
        notes = notes.filter(n => (n.teamId || null) === tid);
        return {
          count: notes.length,
          notes: notes.slice(0, 20).map(n => ({
            title: n.title, body: (n.body || "").slice(0, 200),
            tags: n.tags, pinned: n.pinned,
          })),
        };
      }

      case "create_board_cards": {
        const key = "datascope_kanban";
        let boards = [];
        try {
          const raw = localStorage.getItem(key);
          const data = raw ? JSON.parse(raw) : null;
          if (Array.isArray(data)) boards = data;
          else if (data) boards = [{ ...data, id: data.id || uid(), teamId: null }];
        } catch (_) {}

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

        const colName = (input.column || "To Do").toLowerCase();
        let col = board.columns.find(c => c.title.toLowerCase() === colName);
        if (!col) col = board.columns[0];

        const cards = input.cards || [];
        const created = [];
        cards.forEach(p => {
          const card = {
            id: uid(),
            title: String(p.title || "Untitled").slice(0, 120),
            description: String(p.description || ""),
            priority: ["high", "medium", "low"].includes(p.priority) ? p.priority : "medium",
            cardType: "story", parentId: null,
            startDate: "", dueDate: p.dueDate || "",
            reminder: "",
            tags: Array.isArray(p.tags) ? p.tags : [],
            projectId: "",
            attachments: { canvases: [], charts: [], decks: [] },
            comments: [],
            createdAt: new Date().toISOString(),
          };
          col.cards.push(card);
          created.push(card.title);
        });

        localStorage.setItem(key, JSON.stringify(boards));
        window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "board" } }));
        return { success: true, count: created.length, column: col.title, titles: created };
      }

      case "read_board": {
        let boards = [];
        try {
          const raw = localStorage.getItem("datascope_kanban");
          const data = raw ? JSON.parse(raw) : null;
          if (Array.isArray(data)) boards = data;
          else if (data) boards = [data];
        } catch (_) {}

        const board = boards.find(b => (b.teamId || null) === tid) || boards[0];
        if (!board) return { message: "No board found" };

        return {
          boardTitle: board.boardTitle || "My Board",
          columns: (board.columns || []).map(c => ({
            name: c.title,
            cards: (c.cards || []).map(card => ({
              title: card.title, priority: card.priority,
              dueDate: card.dueDate || null,
              tags: card.tags || [],
            })),
          })),
        };
      }

      case "create_slide_deck": {
        const key = "datascope_slides";
        const VALID = ["title", "title-body", "two-column", "bullets", "section", "quote", "blank"];
        let state;
        try { state = JSON.parse(localStorage.getItem(key)); } catch (_) {}
        if (!state) state = { projects: [], currentProject: 0, currentSlide: 0 };
        if (!state.projects) state.projects = [];

        const deckName = input.name || "New Deck";
        const slides = (input.slides || []).map(s => ({
          template: VALID.includes(s.template) ? s.template : "title-body",
          content: s.content || {},
          font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          textColor: "#ffffff", bgColor: "#1a1a2e", comments: [],
        }));
        if (!slides.length) {
          slides.push({
            template: "title",
            content: { title: deckName, subtitle: "" },
            font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            textColor: "#ffffff", bgColor: "#1a1a2e", comments: [],
          });
        }

        state.projects.push({ id: uid(), teamId: tid, name: deckName, projectId: "", slides });
        state.currentProject = state.projects.length - 1;
        state.currentSlide = 0;
        localStorage.setItem(key, JSON.stringify(state));
        return { success: true, name: deckName, slideCount: slides.length };
      }

      case "add_canvas_shapes": {
        const shapes = (input.shapes || []);
        const key = "datascope_canvas";
        const cv = window._canvasAppState;

        const builtShapes = shapes.map((s, i) => {
          const text = s.text || "";
          const lines = text.split("\n");
          const estH = Math.max(40, lines.length * 20 + 16);
          const estW = Math.max(160, Math.min(400, Math.max(...lines.map(l => l.length)) * 8 + 24));
          return {
            id: uid(), type: "text",
            x: s.x ?? (120 + i * 40 + Math.random() * 100),
            y: s.y ?? (120 + i * 40 + Math.random() * 100),
            w: estW, h: estH,
            fill: "transparent", stroke: "#8b5cf6", strokeWidth: 1.5,
            label: text, textColor: "#e7ecff", textAlign: "left", fontSize: 14,
          };
        });

        if (cv && cv.shapes) {
          builtShapes.forEach(s => cv.shapes.push(s));
          window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "canvas-draw" } }));
        } else {
          let canvases = [];
          try { const r = localStorage.getItem(key); if (r) canvases = JSON.parse(r); } catch (_) {}
          let c = canvases.find(cv2 => (cv2.teamId || null) === tid);
          if (!c) {
            c = { id: uid(), teamId: tid, name: "Canvas 1", shapes: [], arrows: [] };
            canvases.push(c);
          }
          builtShapes.forEach(s => c.shapes.push(s));
          localStorage.setItem(key, JSON.stringify(canvases));
        }

        return { success: true, count: builtShapes.length };
      }

      case "create_chart": {
        const key = "datascope_saved_charts";
        let charts = [];
        try { const r = localStorage.getItem(key); if (r) charts = JSON.parse(r); } catch (_) {}

        const chart = {
          id: uid(), teamId: tid,
          name: input.name || "Chart",
          projectId: "",
          headers: input.headers || ["Label", "Value"],
          rows: input.rows || [],
          colors: ["#6ea8ff", "#8b5cf6", "#4ade80", "#fbbf24", "#f87171", "#22d3ee"],
          seriesIndices: Array.from({ length: (input.headers || []).length - 1 }, (_, i) => i + 1),
          xAxisIndex: 0,
          chartType: input.chartType || "bar",
          stacked: false,
          font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: "13",
          thumbnail: null,
          savedAt: new Date().toISOString(),
        };
        charts.push(chart);
        localStorage.setItem(key, JSON.stringify(charts));
        window.dispatchEvent(new CustomEvent("datascope:externalAdd", { detail: { target: "charts" } }));
        return { success: true, name: chart.name, chartType: chart.chartType };
      }

      default:
        return { error: "Unknown tool: " + name };
    }
  }

  // ---- Build system prompt ----
  function buildAgentSystemPrompt(agent) {
    const caps = (agent.capabilities || []).join(", ");
    return `You are "${agent.name}", an AI agent in the DataScope collaboration platform.

${agent.instructions || "You are a helpful assistant."}

You are part of a team workspace. Use the tools provided to help the user — create notes, board cards, slide decks, canvas shapes, or charts when asked. Read existing data when you need context.

Your capabilities: ${caps || "general assistance"}.

Guidelines:
- Be concise and direct (1-3 sentences unless more detail is needed).
- When creating items, briefly confirm what you'll create, then use the appropriate tool.
- You may use multiple tools in a single response when it makes sense.
- After using tools, summarize what you did.
- If asked about something outside your capabilities, say so honestly.`;
  }

  // ---- Claude API with tool_use ----
  async function callAgentAPI(agent, messages) {
    const apiKey = localStorage.getItem(API_KEY_STORE) || "";
    if (!apiKey) throw new Error("No API key configured");

    const tools = getToolDefs(agent.capabilities || []);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: buildAgentSystemPrompt(agent),
        messages,
        tools: tools.length ? tools : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || "API error " + res.status);
    }
    return res.json();
  }

  // ---- Toast (feedback after tool use) ----
  function showToast(message, href) {
    const existing = document.querySelector(".acp-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "acp-toast";
    toast.innerHTML = message + (href ? ' <a class="acp-toast-link" href="' + href + '">View &rarr;</a>' : "");
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("out");
      toast.addEventListener("animationend", () => toast.remove());
    }, 3000);
  }

  // ---- Chat state (persisted to sessionStorage) ----
  let panelOpen = false;
  let activeAgent = null;
  let chatHistories = {};

  try {
    const saved = sessionStorage.getItem("datascope_agent_chats");
    if (saved) chatHistories = JSON.parse(saved);
  } catch (_) {}

  function saveChatState() {
    try {
      sessionStorage.setItem("datascope_agent_chats", JSON.stringify(chatHistories));
      if (activeAgent) {
        sessionStorage.setItem("datascope_agent_active", activeAgent.id);
      } else {
        sessionStorage.removeItem("datascope_agent_active");
      }
    } catch (_) {}
  }

  function getChatHistory(agentId) {
    if (!chatHistories[agentId]) chatHistories[agentId] = [];
    return chatHistories[agentId];
  }

  // ---- DOM ----
  function buildDOM() {
    const fab = document.createElement("button");
    fab.className = "agent-chat-fab";
    fab.id = "agentChatFab";
    fab.title = "AI Agents";
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="9.5" cy="14" r="1.5" fill="currentColor"/><circle cx="14.5" cy="14" r="1.5" fill="currentColor"/><path d="M12 4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="3" r="1.5" fill="currentColor"/><path d="M1 13h3M20 13h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    fab.addEventListener("click", togglePanel);
    document.body.appendChild(fab);

    const panel = document.createElement("div");
    panel.className = "agent-chat-panel";
    panel.id = "agentChatPanel";
    panel.innerHTML = `
      <div class="acp-header">
        <button class="acp-back" id="acpBack" title="Back to agents">&larr;</button>
        <div class="acp-header-avatar" id="acpAvatar" style="background:#8b5cf6">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="4" y="8" width="16" height="12" rx="3" stroke="white" stroke-width="1.5"/><circle cx="9.5" cy="14" r="1.5" fill="white"/><circle cx="14.5" cy="14" r="1.5" fill="white"/></svg>
        </div>
        <div class="acp-header-text">
          <div class="acp-header-name" id="acpName">AI Agents</div>
          <div class="acp-header-sub" id="acpSub">Select an agent</div>
        </div>
        <button class="acp-close" id="acpClose">&times;</button>
      </div>
      <div class="acp-list" id="acpList"></div>
      <div class="acp-messages" id="acpMessages"></div>
      <div class="acp-input-area" id="acpInputArea">
        <input type="text" class="acp-input" id="acpInput" placeholder="Message the agent…" autocomplete="off" />
        <button class="acp-send" id="acpSend">&#9654;</button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("acpClose").addEventListener("click", togglePanel);
    document.getElementById("acpBack").addEventListener("click", showAgentList);
    document.getElementById("acpSend").addEventListener("click", handleSend);
    document.getElementById("acpInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });

    window.addEventListener("datascope:openAgentChat", (e) => {
      const agentId = e.detail?.agentId;
      if (!agentId) return;
      if (!panelOpen) togglePanel();
      const agent = loadAgents().find(a => a.id === agentId);
      if (agent) openChat(agent);
    });
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    document.getElementById("agentChatPanel").classList.toggle("open", panelOpen);
    if (panelOpen) {
      if (activeAgent) {
        openChat(activeAgent);
      } else {
        showAgentList();
      }
    }
  }

  function showAgentList() {
    activeAgent = null;
    sessionStorage.removeItem("datascope_agent_active");
    const list = document.getElementById("acpList");
    const msgs = document.getElementById("acpMessages");
    const inputArea = document.getElementById("acpInputArea");
    const backBtn = document.getElementById("acpBack");

    list.style.display = "";
    msgs.classList.remove("visible");
    inputArea.classList.remove("visible");
    backBtn.classList.remove("visible");

    document.getElementById("acpName").textContent = "AI Agents";
    document.getElementById("acpSub").textContent = "Select an agent";
    document.getElementById("acpAvatar").style.background = "#8b5cf6";
    document.getElementById("acpAvatar").innerHTML = '<svg viewBox="0 0 24 24" fill="none" width="18" height="18"><rect x="4" y="8" width="16" height="12" rx="3" stroke="white" stroke-width="1.5"/><circle cx="9.5" cy="14" r="1.5" fill="white"/><circle cx="14.5" cy="14" r="1.5" fill="white"/></svg>';

    renderAgentList();
  }

  function renderAgentList() {
    const list = document.getElementById("acpList");
    list.innerHTML = "";

    const apiKey = localStorage.getItem(API_KEY_STORE);
    if (!apiKey) {
      list.innerHTML = '<div class="acp-no-key">Agents require a Claude API key.<br>Set one in <a href="settings.html">Settings</a> or via the mascot widget (⚙️).</div>';
      return;
    }

    const agents = getAgentsForTeam();
    if (!agents.length) {
      list.innerHTML = '<div class="acp-list-empty">No agents yet.<br><a href="agents.html">Create your first agent &rarr;</a></div>';
      return;
    }

    agents.forEach(agent => {
      const item = document.createElement("div");
      item.className = "acp-list-item";

      const avatar = document.createElement("div");
      avatar.className = "acp-list-avatar";
      avatar.style.background = agent.color || "#8b5cf6";
      avatar.textContent = (agent.name || "A").charAt(0).toUpperCase();

      const info = document.createElement("div");
      info.className = "acp-list-info";

      const name = document.createElement("div");
      name.className = "acp-list-name";
      name.textContent = agent.name;

      const desc = document.createElement("div");
      desc.className = "acp-list-desc";
      desc.textContent = agent.description || "No description";

      info.append(name, desc);
      item.append(avatar, info);
      item.addEventListener("click", () => openChat(agent));
      list.appendChild(item);
    });
  }

  function openChat(agent) {
    activeAgent = agent;
    saveChatState();
    const list = document.getElementById("acpList");
    const msgs = document.getElementById("acpMessages");
    const inputArea = document.getElementById("acpInputArea");
    const backBtn = document.getElementById("acpBack");

    list.style.display = "none";
    msgs.classList.add("visible");
    inputArea.classList.add("visible");
    backBtn.classList.add("visible");

    document.getElementById("acpName").textContent = agent.name;
    document.getElementById("acpSub").textContent = "Online";
    document.getElementById("acpAvatar").style.background = agent.color || "#8b5cf6";
    document.getElementById("acpAvatar").innerHTML = "";
    document.getElementById("acpAvatar").textContent = (agent.name || "A").charAt(0).toUpperCase();

    const history = getChatHistory(agent.id);
    msgs.innerHTML = "";

    if (!history.length) {
      addBotMsg("Hi! I'm " + agent.name + ". " + (agent.description || "How can I help you?"));
    } else {
      history.forEach(msg => {
        if (msg.role === "user") {
          const text = typeof msg.content === "string" ? msg.content : "";
          if (text) renderMsg("user", text);
        } else if (msg.role === "assistant") {
          const blocks = Array.isArray(msg.content) ? msg.content : [{ type: "text", text: msg.content }];
          blocks.forEach(b => {
            if (b.type === "text" && b.text) renderMsg("bot", b.text);
            if (b.type === "tool_use") renderToolBadge(b.name, false);
          });
        }
      });
    }

    setTimeout(() => document.getElementById("acpInput").focus(), 200);
  }

  function formatText(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function renderMsg(type, text) {
    const msgs = document.getElementById("acpMessages");
    const el = document.createElement("div");
    el.className = "acp-msg " + type;
    el.innerHTML = formatText(text);
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function addBotMsg(text) {
    renderMsg("bot", text);
  }

  function renderToolBadge(toolName, pending) {
    const msgs = document.getElementById("acpMessages");
    const badge = document.createElement("div");
    badge.className = "acp-tool-badge" + (pending ? " pending" : "");
    const labels = {
      create_note: "Created note",
      read_notes: "Read notes",
      create_board_cards: "Created board cards",
      read_board: "Read board",
      create_slide_deck: "Created slide deck",
      add_canvas_shapes: "Added canvas shapes",
      create_chart: "Created chart",
    };
    badge.textContent = (pending ? "⏳ " : "✓ ") + (labels[toolName] || toolName);
    msgs.appendChild(badge);
    msgs.scrollTop = msgs.scrollHeight;
    return badge;
  }

  function showTyping() {
    const msgs = document.getElementById("acpMessages");
    const el = document.createElement("div");
    el.className = "acp-typing";
    el.id = "acpTyping";
    el.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById("acpTyping");
    if (el) el.remove();
  }

  async function handleSend() {
    if (!activeAgent) return;
    const input = document.getElementById("acpInput");
    const sendBtn = document.getElementById("acpSend");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    renderMsg("user", text);

    const history = getChatHistory(activeAgent.id);
    history.push({ role: "user", content: text });
    saveChatState();

    input.disabled = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      await runAgentLoop(activeAgent, history);
    } catch (err) {
      removeTyping();
      addBotMsg("Sorry, something went wrong: " + err.message);
    } finally {
      saveChatState();
      input.disabled = false;
      sendBtn.disabled = false;
      setTimeout(() => input.focus(), 50);
    }
  }

  const TOOL_PAGES = {
    create_note: { label: "Note", href: "notes.html" },
    read_notes: null,
    create_board_cards: { label: "Board", href: "kanban.html" },
    read_board: null,
    create_slide_deck: { label: "Slides", href: "slides.html" },
    add_canvas_shapes: { label: "Canvas", href: "canvas.html" },
    create_chart: { label: "Charts", href: "charts.html" },
  };

  async function runAgentLoop(agent, history) {
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    let lastToolPage = null;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      removeTyping();
      showTyping();

      const response = await callAgentAPI(agent, history);
      removeTyping();

      const content = response.content || [];
      history.push({ role: "assistant", content });
      saveChatState();

      const textBlocks = content.filter(b => b.type === "text");
      const toolBlocks = content.filter(b => b.type === "tool_use");

      textBlocks.forEach(b => {
        if (b.text && b.text.trim()) addBotMsg(b.text);
      });

      if (!toolBlocks.length || response.stop_reason !== "tool_use") break;

      const toolResults = [];
      for (const toolUse of toolBlocks) {
        const badge = renderToolBadge(toolUse.name, true);
        const result = executeTool(toolUse.name, toolUse.input);
        badge.classList.remove("pending");
        badge.textContent = "✓ " + badge.textContent.replace("⏳ ", "");
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
        const page = TOOL_PAGES[toolUse.name];
        if (page && result.success) lastToolPage = page;
      }

      history.push({ role: "user", content: toolResults });
      saveChatState();
    }

    if (lastToolPage) {
      showToast("Agent created items in " + lastToolPage.label, lastToolPage.href);
    }

    if (history.length > 40) {
      const trimmed = history.slice(-30);
      history.length = 0;
      trimmed.forEach(m => history.push(m));
    }
    saveChatState();
  }

  // ---- Init ----
  function init() {
    buildDOM();

    // Restore active agent from session if panel was open
    const savedAgentId = sessionStorage.getItem("datascope_agent_active");
    if (savedAgentId) {
      const agent = loadAgents().find(a => a.id === savedAgentId);
      if (agent && getChatHistory(agent.id).length) {
        activeAgent = agent;
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
