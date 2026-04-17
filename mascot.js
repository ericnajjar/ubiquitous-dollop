// DataScope Mascot — "Scope" the agentic assistant widget.
(() => {
  const PROJECTS_KEY = "datascope_projects";

  const MASCOT_SVG = `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="18" r="15" fill="white" opacity="0.15"/>
    <circle cx="13" cy="15" r="2.5" fill="white"/>
    <circle cx="23" cy="15" r="2.5" fill="white"/>
    <circle cx="14" cy="14.5" r="0.8" fill="#131833"/>
    <circle cx="24" cy="14.5" r="0.8" fill="#131833"/>
    <path d="M13 22 C15 25, 21 25, 23 22" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <circle cx="18" cy="18" r="12" stroke="white" stroke-width="1.2" opacity="0.3" fill="none"/>
  </svg>`;

  // ---------- Tool definitions ----------
  const TOOLS = {
    charts: {
      name: "Charts",
      url: "index.html",
      keywords: ["chart", "graph", "data", "visuali", "bar", "line", "pie", "doughnut", "scatter", "plot", "csv", "number", "trend", "compare", "analytics", "metric"],
      description: "Create interactive charts from your data — bar, line, pie, scatter, and more.",
      emoji: "📊",
    },
    slides: {
      name: "Slides",
      url: "slides.html",
      keywords: ["slide", "presentation", "deck", "present", "template", "pitch", "keynote", "powerpoint", "talk"],
      description: "Build template-based slide decks with images, text, and custom styling.",
      emoji: "🎨",
    },
    board: {
      name: "Board",
      url: "kanban.html",
      keywords: ["task", "board", "kanban", "todo", "ticket", "assign", "track", "sprint", "workflow", "deadline", "card", "column", "priorit"],
      description: "Organize tasks with a drag-and-drop Kanban board, priorities, and due dates.",
      emoji: "📋",
    },
    notes: {
      name: "Notes",
      url: "notes.html",
      keywords: ["note", "write", "scratch", "jot", "memo", "idea", "brainstorm", "journal", "log", "thought"],
      description: "Capture ideas with colored sticky notes, tags, and search.",
      emoji: "📝",
    },
    projects: {
      name: "Projects",
      url: "projects.html",
      keywords: ["project", "organiz", "manage", "hub", "link", "group", "team", "plan", "overview"],
      description: "Create projects to link charts, decks, board cards, and notes together.",
      emoji: "📁",
    },
  };

  // ---------- Intent matching ----------
  function matchIntents(input) {
    const lower = input.toLowerCase();
    const matched = [];

    for (const [key, tool] of Object.entries(TOOLS)) {
      const score = tool.keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
      if (score > 0) matched.push({ key, tool, score });
    }

    matched.sort((a, b) => b.score - a.score);
    return matched;
  }

  function detectProjectCreation(input) {
    const lower = input.toLowerCase();
    const patterns = [
      /(?:create|start|make|new|set up|begin|launch|kick off)\s+(?:a\s+)?(?:new\s+)?project/i,
      /project\s+(?:for|about|called|named)/i,
      /(?:i(?:'m| am)\s+(?:working on|starting|planning))/i,
    ];
    return patterns.some((p) => p.test(lower));
  }

  function extractProjectName(input) {
    const patterns = [
      /(?:called|named)\s+["']?([^"'\n,.]+)/i,
      /project\s+(?:for|about)\s+["']?([^"'\n,.]+)/i,
      /(?:create|start|make|new)\s+(?:a\s+)?(?:new\s+)?project\s+["']?([^"'\n,.]+)/i,
    ];
    for (const p of patterns) {
      const m = input.match(p);
      if (m) return m[1].trim();
    }
    return null;
  }

  // ---------- Project creation ----------
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function createProject(name, description) {
    let projects = [];
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) projects = JSON.parse(raw);
    } catch (_) {}

    const now = new Date().toISOString();
    const project = { id: uid(), name, description: description || "", createdAt: now, updatedAt: now };
    projects.push(project);

    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch (_) {}

    return project;
  }

  // ---------- Response generation ----------
  function generateResponse(input) {
    const lower = input.toLowerCase().trim();

    if (!lower || lower.length < 2) {
      return { text: "I didn't catch that. Could you tell me what you'd like to work on?", actions: defaultActions() };
    }

    // Greetings
    if (/^(hi|hello|hey|sup|yo|hola|greetings)/i.test(lower)) {
      return {
        text: "Hey there! I'm Scope, your DataScope assistant. What are you working on today? I can help you pick the right tool or set up a project.",
        actions: defaultActions(),
      };
    }

    // Help
    if (/^(help|what can you do|how|guide)/i.test(lower)) {
      return {
        text: "I can help you figure out which DataScope tool to use! Just tell me what you're trying to do — like \"I need to visualize sales data\" or \"I want to plan a presentation.\" I can also create projects for you to keep everything organized.",
        actions: defaultActions(),
      };
    }

    // Project creation intent
    if (detectProjectCreation(lower)) {
      const name = extractProjectName(input);
      if (name) {
        const project = createProject(name);
        return {
          text: `Done! I created a project called "${project.name}." You can now link charts, slides, board cards, and notes to it from each tool. Want me to suggest which tools you'll need?`,
          actions: [
            { label: "Open Projects", action: () => window.location.href = "projects.html" },
            { label: "What tools should I use?", action: "suggest_tools" },
          ],
        };
      }
      return {
        text: "I'd love to set up a project for you! What should we call it?",
        actions: [],
        expectProjectName: true,
      };
    }

    // Match tools
    const intents = matchIntents(lower);

    if (intents.length === 0) {
      // No match — try to be helpful
      return {
        text: "Hmm, I'm not sure which tool fits that best. Here's what DataScope offers — any of these sound right?",
        actions: Object.values(TOOLS).map((t) => ({
          label: `${t.emoji} ${t.name}`,
          action: () => window.location.href = t.url,
        })),
      };
    }

    if (intents.length === 1) {
      const { tool } = intents[0];
      return {
        text: `Sounds like you need **${tool.emoji} ${tool.name}**! ${tool.description}`,
        actions: [
          { label: `Open ${tool.name}`, action: () => window.location.href = tool.url },
          { label: "Create a project for this", action: "create_project_prompt" },
        ],
      };
    }

    // Multiple matches — suggest a project
    const top = intents.slice(0, 3);
    const toolList = top.map((i) => `${i.tool.emoji} **${i.tool.name}** — ${i.tool.description}`).join("\n\n");
    return {
      text: `Looks like you could use a few tools for this:\n\n${toolList}\n\nWant me to create a project to tie everything together?`,
      actions: [
        ...top.map((i) => ({ label: `Open ${i.tool.name}`, action: () => window.location.href = i.tool.url })),
        { label: "Create a project", action: "create_project_prompt" },
      ],
    };
  }

  function defaultActions() {
    return [
      { label: "📊 Visualize data", action: "charts" },
      { label: "🎨 Build a presentation", action: "slides" },
      { label: "📋 Track tasks", action: "board" },
      { label: "📝 Take notes", action: "notes" },
      { label: "📁 Start a project", action: "create_project_prompt" },
    ];
  }

  // ---------- UI ----------
  let panelOpen = false;
  let conversationState = "normal"; // normal | expecting_project_name
  const messages = [];

  function buildDOM() {
    // FAB button
    const fab = document.createElement("button");
    fab.className = "mascot-fab has-greeting";
    fab.title = "Chat with Scope";
    fab.innerHTML = `<span class="mascot-face">${MASCOT_SVG}</span>`;
    fab.addEventListener("click", togglePanel);
    document.body.appendChild(fab);

    // Panel
    const panel = document.createElement("div");
    panel.className = "mascot-panel";
    panel.id = "mascotPanel";
    panel.innerHTML = `
      <div class="mascot-panel-header">
        <div class="mascot-avatar-sm">${MASCOT_SVG}</div>
        <div class="mascot-header-text">
          <div class="mascot-name">Scope</div>
          <div class="mascot-status">Online</div>
        </div>
        <button class="mascot-panel-close" id="mascotClose">&times;</button>
      </div>
      <div class="mascot-messages" id="mascotMessages"></div>
      <div class="mascot-input-area">
        <input type="text" class="mascot-input" id="mascotInput" placeholder="Tell me what you need…" autocomplete="off" />
        <button class="mascot-send-btn" id="mascotSend">&#9654;</button>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById("mascotClose").addEventListener("click", togglePanel);
    document.getElementById("mascotSend").addEventListener("click", handleSend);
    document.getElementById("mascotInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    const panel = document.getElementById("mascotPanel");
    panel.classList.toggle("open", panelOpen);

    if (panelOpen && messages.length === 0) {
      showGreeting();
    }

    if (panelOpen) {
      setTimeout(() => document.getElementById("mascotInput").focus(), 200);
    }
  }

  function showGreeting() {
    const page = detectCurrentPage();
    let greeting;

    if (page === "charts") {
      greeting = "Hey! I see you're in Charts. Need help visualizing your data, or working on something else?";
    } else if (page === "slides") {
      greeting = "Hey! Working on a presentation? I can help you organize your deck or suggest other tools.";
    } else if (page === "board") {
      greeting = "Hey! Organizing tasks? Let me know if you need help setting up a project or linking things together.";
    } else if (page === "notes") {
      greeting = "Hey! Jotting down ideas? I can help you connect notes to a project or suggest other tools.";
    } else if (page === "projects") {
      greeting = "Hey! This is the Projects hub. Want me to help you create a new project or figure out what tools you need?";
    } else {
      greeting = "Hey! I'm Scope, your DataScope assistant. What would you like to do today?";
    }

    addBotMessage(greeting, defaultActions());
  }

  function detectCurrentPage() {
    const path = window.location.pathname;
    if (path.includes("slides")) return "slides";
    if (path.includes("kanban")) return "board";
    if (path.includes("notes")) return "notes";
    if (path.includes("projects")) return "projects";
    return "charts";
  }

  function handleSend() {
    const input = document.getElementById("mascotInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";

    addUserMessage(text);

    if (conversationState === "expecting_project_name") {
      conversationState = "normal";
      const project = createProject(text);
      setTimeout(() => {
        addBotMessage(
          `Created! Your project "${project.name}" is ready. You can start linking items to it from any tool.`,
          [
            { label: "Open Projects", action: () => window.location.href = "projects.html" },
            { label: "What else can I do?", action: "help" },
          ]
        );
      }, 500);
      return;
    }

    showTyping();
    setTimeout(() => {
      removeTyping();
      const response = generateResponse(text);
      if (response.expectProjectName) {
        conversationState = "expecting_project_name";
      }
      addBotMessage(response.text, response.actions || []);
    }, 600 + Math.random() * 400);
  }

  function handleActionClick(action) {
    if (typeof action === "function") {
      action();
      return;
    }

    if (action === "create_project_prompt") {
      conversationState = "expecting_project_name";
      addBotMessage("Great idea! What would you like to name your project?", []);
      setTimeout(() => document.getElementById("mascotInput").focus(), 100);
      return;
    }

    if (action === "suggest_tools") {
      addBotMessage(
        "Here are all the tools at your disposal:\n\n📊 **Charts** — Visualize data with bar, line, pie, scatter, and more\n🎨 **Slides** — Build presentation decks with templates\n���� **Board** — Kanban task management with priorities and due dates\n📝 **Notes** — Quick sticky notes with tags and colors\n📁 **Projects** — Link everything together",
        Object.values(TOOLS).map((t) => ({
          label: `Open ${t.name}`,
          action: () => window.location.href = t.url,
        }))
      );
      return;
    }

    if (action === "help") {
      addBotMessage(
        "Just tell me what you're trying to do! For example:\n\n• \"I need to visualize quarterly sales\"\n• \"Create a project called Product Launch\"\n• \"I want to plan a presentation\"\n• \"Help me track my team's tasks\"",
        defaultActions()
      );
      return;
    }

    // Tool shortcut
    if (TOOLS[action]) {
      const tool = TOOLS[action];
      addUserMessage(`I want to use ${tool.name}`);
      showTyping();
      setTimeout(() => {
        removeTyping();
        addBotMessage(
          `${tool.emoji} **${tool.name}** is a great choice! ${tool.description}`,
          [
            { label: `Open ${tool.name}`, action: () => window.location.href = tool.url },
            { label: "Create a project for this", action: "create_project_prompt" },
          ]
        );
      }, 400);
    }
  }

  // ---------- Message rendering ----------
  function addBotMessage(text, actions) {
    messages.push({ type: "bot", text, actions });
    renderMessage({ type: "bot", text, actions });
  }

  function addUserMessage(text) {
    messages.push({ type: "user", text });
    renderMessage({ type: "user", text });
  }

  function renderMessage(msg) {
    const container = document.getElementById("mascotMessages");
    const el = document.createElement("div");
    el.className = `mascot-msg ${msg.type}`;

    el.innerHTML = formatText(msg.text);

    if (msg.actions && msg.actions.length) {
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "mascot-actions";
      msg.actions.forEach((a) => {
        const btn = document.createElement("button");
        btn.className = "mascot-action-btn";
        btn.textContent = a.label;
        btn.addEventListener("click", () => handleActionClick(a.action));
        actionsDiv.appendChild(btn);
      });
      el.appendChild(actionsDiv);
    }

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function formatText(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function showTyping() {
    const container = document.getElementById("mascotMessages");
    const el = document.createElement("div");
    el.className = "mascot-typing";
    el.id = "mascotTyping";
    el.innerHTML = "<span></span><span></span><span></span>";
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById("mascotTyping");
    if (el) el.remove();
  }

  // ---------- Init ----------
  function init() {
    buildDOM();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
