// DataScope Mascot — agentic assistant widget with character picker.
(() => {
  const PROJECTS_KEY = "datascope_projects";
  const MASCOT_KEY = "datascope_mascot";
  const API_KEY_STORE = "datascope_anthropic_key";
  const MODEL = "claude-sonnet-4-6";
  let chatHistory = [];

  // ---------- Character SVGs ----------
  const CHARACTERS = {
    scope: {
      name: "Scope",
      svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="15" fill="white" opacity="0.15"/>
        <circle cx="13" cy="15" r="2.5" fill="white"/>
        <circle cx="23" cy="15" r="2.5" fill="white"/>
        <circle cx="14" cy="14.5" r="0.8" fill="#131833"/>
        <circle cx="24" cy="14.5" r="0.8" fill="#131833"/>
        <path d="M13 22 C15 25, 21 25, 23 22" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
        <circle cx="18" cy="18" r="12" stroke="white" stroke-width="1.2" opacity="0.3" fill="none"/>
      </svg>`,
    },
    cat: {
      name: "Whiskers",
      svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 8 L10 16 L8 16 Z" fill="white" opacity="0.8"/>
        <path d="M30 8 L26 16 L28 16 Z" fill="white" opacity="0.8"/>
        <ellipse cx="18" cy="20" rx="12" ry="10" fill="white" opacity="0.15"/>
        <circle cx="13" cy="18" r="2.2" fill="white"/>
        <circle cx="23" cy="18" r="2.2" fill="white"/>
        <circle cx="13.5" cy="17.5" r="1" fill="#131833"/>
        <circle cx="23.5" cy="17.5" r="1" fill="#131833"/>
        <ellipse cx="18" cy="22" rx="1.5" ry="1" fill="#f472b6"/>
        <line x1="4" y1="20" x2="11" y2="21" stroke="white" stroke-width="0.7" opacity="0.5"/>
        <line x1="4" y1="23" x2="11" y2="22" stroke="white" stroke-width="0.7" opacity="0.5"/>
        <line x1="32" y1="20" x2="25" y2="21" stroke="white" stroke-width="0.7" opacity="0.5"/>
        <line x1="32" y1="23" x2="25" y2="22" stroke="white" stroke-width="0.7" opacity="0.5"/>
      </svg>`,
    },
    dog: {
      name: "Buddy",
      svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="8" cy="14" rx="5" ry="7" fill="white" opacity="0.2" transform="rotate(-15 8 14)"/>
        <ellipse cx="28" cy="14" rx="5" ry="7" fill="white" opacity="0.2" transform="rotate(15 28 14)"/>
        <ellipse cx="18" cy="20" rx="11" ry="10" fill="white" opacity="0.15"/>
        <circle cx="13" cy="17" r="2.3" fill="white"/>
        <circle cx="23" cy="17" r="2.3" fill="white"/>
        <circle cx="13.6" cy="16.6" r="0.9" fill="#131833"/>
        <circle cx="23.6" cy="16.6" r="0.9" fill="#131833"/>
        <ellipse cx="18" cy="22" rx="3" ry="2" fill="white" opacity="0.3"/>
        <ellipse cx="18" cy="21.5" rx="1.8" ry="1.3" fill="#131833" opacity="0.8"/>
        <path d="M15 25 C16.5 27, 19.5 27, 21 25" stroke="#f472b6" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      </svg>`,
    },
    giraffe: {
      name: "Stretch",
      svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="14" y1="6" x2="13" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="22" y1="6" x2="23" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="14" cy="5" r="1.5" fill="#fbbf24"/>
        <circle cx="22" cy="5" r="1.5" fill="#fbbf24"/>
        <ellipse cx="18" cy="20" rx="11" ry="11" fill="white" opacity="0.15"/>
        <circle cx="12" cy="17" r="2" fill="white"/>
        <circle cx="24" cy="17" r="2" fill="white"/>
        <circle cx="12.5" cy="16.6" r="0.8" fill="#131833"/>
        <circle cx="24.5" cy="16.6" r="0.8" fill="#131833"/>
        <path d="M14 23 C16 25.5, 20 25.5, 22 23" stroke="white" stroke-width="1.3" stroke-linecap="round" fill="none"/>
        <circle cx="10" cy="22" r="1.2" fill="#fbbf24" opacity="0.4"/>
        <circle cx="21" cy="13" r="1" fill="#fbbf24" opacity="0.4"/>
        <circle cx="15" cy="26" r="0.9" fill="#fbbf24" opacity="0.4"/>
        <circle cx="26" cy="21" r="1.1" fill="#fbbf24" opacity="0.4"/>
      </svg>`,
    },
    octopus: {
      name: "Inky",
      svg: `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="18" cy="15" rx="12" ry="10" fill="white" opacity="0.15"/>
        <circle cx="13" cy="13" r="2.8" fill="white"/>
        <circle cx="23" cy="13" r="2.8" fill="white"/>
        <circle cx="13.5" cy="12.5" r="1.1" fill="#131833"/>
        <circle cx="23.5" cy="12.5" r="1.1" fill="#131833"/>
        <path d="M14 19 C16 21, 20 21, 22 19" stroke="white" stroke-width="1.3" stroke-linecap="round" fill="none"/>
        <path d="M5 22 C4 28, 7 30, 8 26" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
        <path d="M9 24 C8 30, 11 31, 12 27" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
        <path d="M14 25 C13 31, 16 31, 16 28" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
        <path d="M20 25 C20 31, 23 31, 22 28" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
        <path d="M24 24 C25 30, 28 31, 27 27" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
        <path d="M28 22 C29 28, 32 30, 31 26" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.6"/>
      </svg>`,
    },
  };

  let selectedCharacter = "scope";
  try {
    const saved = localStorage.getItem(MASCOT_KEY);
    if (saved && CHARACTERS[saved]) selectedCharacter = saved;
  } catch (_) {}

  function currentChar() { return CHARACTERS[selectedCharacter]; }
  function currentSVG() { return currentChar().svg; }
  function currentName() { return currentChar().name; }

  function setCharacter(key) {
    if (!CHARACTERS[key]) return;
    selectedCharacter = key;
    try { localStorage.setItem(MASCOT_KEY, key); } catch (_) {}
    updateAvatars();
  }

  function updateAvatars() {
    const fab = document.querySelector(".mascot-fab .mascot-face");
    if (fab) fab.innerHTML = currentSVG();
    const avatar = document.querySelector(".mascot-avatar-sm");
    if (avatar) avatar.innerHTML = currentSVG();
    const nameEl = document.querySelector(".mascot-name");
    if (nameEl) nameEl.textContent = currentName();
  }

  // ---------- Tool definitions ----------
  const TOOLS = {
    charts: {
      name: "Charts", url: "index.html",
      keywords: ["chart", "graph", "data", "visuali", "bar", "line", "pie", "doughnut", "scatter", "plot", "csv", "number", "trend", "compare", "analytics", "metric"],
      description: "Create interactive charts from your data — bar, line, pie, scatter, and more.", emoji: "📊",
    },
    slides: {
      name: "Slides", url: "slides.html",
      keywords: ["slide", "presentation", "deck", "present", "template", "pitch", "keynote", "powerpoint", "talk"],
      description: "Build template-based slide decks with images, text, and custom styling.", emoji: "🎨",
    },
    board: {
      name: "Board", url: "kanban.html",
      keywords: ["task", "board", "kanban", "todo", "ticket", "assign", "track", "sprint", "workflow", "deadline", "card", "column", "priorit"],
      description: "Organize tasks with a drag-and-drop Kanban board, priorities, and due dates.", emoji: "📋",
    },
    notes: {
      name: "Notes", url: "notes.html",
      keywords: ["note", "write", "scratch", "jot", "memo", "idea", "brainstorm", "journal", "log", "thought"],
      description: "Capture ideas with colored sticky notes, tags, and search.", emoji: "📝",
    },
    canvas: {
      name: "Canvas", url: "canvas.html",
      keywords: ["canvas", "diagram", "journey", "map", "flow", "whiteboard", "draw", "shape", "arrow", "connect", "miro", "wireframe", "process"],
      description: "Visual canvas for journey maps, flowcharts, and diagrams with shapes and arrows.", emoji: "🗺️",
    },
    docs: {
      name: "Docs", url: "docs.html",
      keywords: ["doc", "document", "story", "stories", "acceptance", "criteria", "requirement", "spec", "user story", "feature", "epic", "gherkin", "given", "when", "then"],
      description: "Write user stories and acceptance criteria for your projects and board cards.", emoji: "📄",
    },
    projects: {
      name: "Projects", url: "projects.html",
      keywords: ["project", "organiz", "manage", "hub", "link", "group", "team", "plan", "overview"],
      description: "Create projects to link charts, decks, board cards, and notes together.", emoji: "📁",
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
    return [
      /(?:create|start|make|new|set up|begin|launch|kick off)\s+(?:a\s+)?(?:new\s+)?project/i,
      /project\s+(?:for|about|called|named)/i,
      /(?:i(?:'m| am)\s+(?:working on|starting|planning))/i,
    ].some((p) => p.test(lower));
  }

  function extractProjectName(input) {
    for (const p of [
      /(?:called|named)\s+["']?([^"'\n,.]+)/i,
      /project\s+(?:for|about)\s+["']?([^"'\n,.]+)/i,
      /(?:create|start|make|new)\s+(?:a\s+)?(?:new\s+)?project\s+["']?([^"'\n,.]+)/i,
    ]) {
      const m = input.match(p);
      if (m) return m[1].trim();
    }
    return null;
  }

  // ---------- Project creation ----------
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  function createProject(name, description) {
    let projects = [];
    try { const raw = localStorage.getItem(PROJECTS_KEY); if (raw) projects = JSON.parse(raw); } catch (_) {}
    const now = new Date().toISOString();
    const project = { id: uid(), name, description: description || "", createdAt: now, updatedAt: now };
    projects.push(project);
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch (_) {}
    return project;
  }

  // ---------- Actions (write to localStorage) ----------
  function actionCreateCard(params) {
    const KANBAN_KEY = "datascope_kanban";
    let state;
    try { state = JSON.parse(localStorage.getItem(KANBAN_KEY)); } catch (_) {}
    if (!state || !state.columns || !state.columns.length) {
      state = { title: "My Board", columns: [
        { id: uid(), title: "To Do", cards: [] },
        { id: uid(), title: "In Progress", cards: [] },
        { id: uid(), title: "Done", cards: [] },
      ]};
    }
    const colName = (params.column || "To Do").toLowerCase();
    let col = state.columns.find((c) => c.title.toLowerCase() === colName);
    if (!col) col = state.columns[0];
    const cards = Array.isArray(params.cards) ? params.cards : [params];
    const created = [];
    cards.forEach((p) => {
      const card = {
        id: uid(),
        title: String(p.title || "Untitled").slice(0, 120),
        description: String(p.description || ""),
        priority: ["high", "medium", "low"].includes(p.priority) ? p.priority : "medium",
        startDate: p.startDate || "",
        dueDate: p.dueDate || "",
        reminder: "",
        tags: Array.isArray(p.tags) ? p.tags.map((t) => String(t).slice(0, 30)) : [],
        projectId: "",
        createdAt: new Date().toISOString(),
      };
      col.cards.push(card);
      created.push(card.title);
    });
    try { localStorage.setItem(KANBAN_KEY, JSON.stringify(state)); } catch (_) {}
    return { count: created.length, column: col.title, titles: created };
  }

  function actionCreateDeck(params) {
    const SLIDES_KEY = "datascope_slides";
    const VALID_TEMPLATES = ["title", "title-body", "two-column", "bullets", "section", "quote", "blank"];
    let state;
    try { state = JSON.parse(localStorage.getItem(SLIDES_KEY)); } catch (_) {}
    if (!state) state = { projects: [], currentProject: 0, currentSlide: 0 };
    if (!state.projects) state.projects = [];
    const deckName = params.name || "New Deck";
    const rawSlides = Array.isArray(params.slides) ? params.slides : [];
    const slides = rawSlides.map((s) => {
      const template = VALID_TEMPLATES.includes(s.template) ? s.template : "title-body";
      const content = s.content || {};
      return {
        template,
        content,
        font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        textColor: "#ffffff",
        bgColor: "#1a1a2e",
      };
    });
    if (!slides.length) {
      slides.push({ template: "title", content: { title: deckName, subtitle: "" }, font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', textColor: "#ffffff", bgColor: "#1a1a2e" });
    }
    state.projects.push({ id: uid(), name: deckName, slides });
    state.currentProject = state.projects.length - 1;
    state.currentSlide = 0;
    try { localStorage.setItem(SLIDES_KEY, JSON.stringify(state)); } catch (_) {}
    return { name: deckName, slideCount: slides.length };
  }

  function executeActions(text) {
    const results = [];
    const regex = /<action>([\s\S]*?)<\/action>/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      try {
        const action = JSON.parse(m[1]);
        if (action.type === "create_project") {
          const p = createProject(action.name || "Untitled", action.description || "");
          results.push(`Created project "${p.name}".`);
        } else if (action.type === "create_cards") {
          const r = actionCreateCard(action);
          results.push(`Added ${r.count} card${r.count !== 1 ? "s" : ""} to "${r.column}".`);
        } else if (action.type === "create_deck") {
          const r = actionCreateDeck(action);
          results.push(`Created deck "${r.name}" with ${r.slideCount} slides.`);
        }
      } catch (_) {}
    }
    return results;
  }

  function stripActionTags(text) {
    return text.replace(/<action>[\s\S]*?<\/action>/g, "").trim();
  }

  // ---------- Page context ----------
  function getPageContext() {
    const page = detectCurrentPage();
    const ctx = { page };
    try {
      if (page === "charts") {
        const charts = JSON.parse(localStorage.getItem("datascope_saved_charts") || "[]");
        ctx.chartCount = charts.length;
        ctx.charts = charts.map((c) => c.name || "Untitled").slice(0, 8);
      } else if (page === "slides") {
        const s = JSON.parse(localStorage.getItem("datascope_slides") || "null");
        if (s) {
          ctx.deckCount = (s.projects || []).length;
          ctx.decks = (s.projects || []).map((p) => ({ name: p.name, slides: (p.slides || []).length })).slice(0, 6);
          const cur = s.projects?.[s.currentProject];
          if (cur) ctx.currentDeck = { name: cur.name, slideCount: (cur.slides || []).length };
        }
      } else if (page === "board") {
        const s = JSON.parse(localStorage.getItem("datascope_kanban") || "null");
        if (s) {
          ctx.boardTitle = s.title || "My Board";
          const now = new Date();
          ctx.columns = (s.columns || []).map((c) => ({
            name: c.title, cardCount: (c.cards || []).length,
            cards: (c.cards || []).slice(0, 4).map((card) => ({ title: card.title, priority: card.priority, due: card.dueDate || null })),
          }));
          const all = (s.columns || []).flatMap((c) => c.cards || []);
          ctx.totalCards = all.length;
          ctx.overdueCount = all.filter((c) => c.dueDate && new Date(c.dueDate) < now).length;
        }
      } else if (page === "notes") {
        const notes = JSON.parse(localStorage.getItem("datascope_notes") || "[]");
        ctx.noteCount = notes.length;
        ctx.tags = [...new Set(notes.flatMap((n) => n.tags || []))].slice(0, 10);
        ctx.recentNotes = notes.slice(0, 5).map((n) => ({ title: n.title || "(untitled)", preview: (n.body || "").slice(0, 80) }));
      } else if (page === "canvas") {
        const s = JSON.parse(localStorage.getItem("datascope_canvas") || "null");
        if (s) { ctx.shapeCount = (s.shapes || []).length; ctx.arrowCount = (s.arrows || []).length; }
      } else if (page === "projects") {
        const projects = JSON.parse(localStorage.getItem("datascope_projects") || "[]");
        ctx.projectCount = projects.length;
        ctx.projects = projects.map((p) => p.name).slice(0, 10);
      }
    } catch (_) {}
    return ctx;
  }

  function buildSystemPrompt(ctx) {
    const pageLabels = {
      charts: "Charts — interactive data visualizations (bar, line, pie, scatter) from CSV data",
      slides: "Slides — template-based presentation deck builder with AI generation",
      board: "Board — Kanban task manager with drag-and-drop cards, priorities, due dates, Gantt view, and AI card generation",
      notes: "Notes — colored sticky notes with tags and search",
      canvas: "Canvas — visual whiteboard for diagrams, flowcharts, and journey maps",
      projects: "Projects — hub that links charts, decks, cards, and notes into projects",
    };

    let pageCtx = `The user is currently on the **${pageLabels[ctx.page] || ctx.page}** page.\n`;
    if (ctx.page === "board" && ctx.columns) {
      pageCtx += `Board: "${ctx.boardTitle}", ${ctx.totalCards} cards total${ctx.overdueCount ? `, ${ctx.overdueCount} overdue` : ""}.\n`;
      pageCtx += ctx.columns.map((c) => `  - ${c.name} (${c.cardCount}): ${c.cards.map((x) => `"${x.title}" [${x.priority}]`).join(", ") || "empty"}`).join("\n");
    } else if (ctx.page === "slides" && ctx.currentDeck) {
      pageCtx += `Current deck: "${ctx.currentDeck.name}" (${ctx.currentDeck.slideCount} slides). ${ctx.deckCount} total decks.`;
      if (ctx.decks?.length) pageCtx += `\nAll decks: ${ctx.decks.map((d) => `"${d.name}" (${d.slides} slides)`).join(", ")}.`;
    } else if (ctx.page === "notes") {
      pageCtx += `${ctx.noteCount} notes. Tags: ${ctx.tags.join(", ") || "none"}.`;
      if (ctx.recentNotes?.length) pageCtx += `\nRecent: ${ctx.recentNotes.map((n) => `"${n.title}"`).join(", ")}.`;
    } else if (ctx.page === "canvas") {
      pageCtx += `${ctx.shapeCount} shapes, ${ctx.arrowCount} arrows on the canvas.`;
    } else if (ctx.page === "charts") {
      pageCtx += `${ctx.chartCount} saved charts${ctx.charts?.length ? `: ${ctx.charts.map((c) => `"${c}"`).join(", ")}` : ""}.`;
    } else if (ctx.page === "projects") {
      pageCtx += `${ctx.projectCount} projects${ctx.projects?.length ? `: ${ctx.projects.map((p) => `"${p}"`).join(", ")}` : ""}.`;
    }

    return `You are a friendly, knowledgeable assistant built into DataScope, a browser-based productivity platform. Help the user with their work on the current page and across the app.

DataScope tools:
- Charts (index.html): data visualizations from CSV
- Slides (slides.html): presentation decks with templates + AI generation
- Board (kanban.html): Kanban + Gantt with AI card generation from documents
- Notes (notes.html): sticky notes with tags
- Canvas (canvas.html): shapes, arrows, diagrams
- Projects (projects.html): link everything together

${pageCtx}

## Actions
You can create items for the user by including an <action> JSON block in your response. The user will see the results immediately. Always confirm what you're about to create, then include the action block.

**Create a project:**
<action>{"type":"create_project","name":"Project Name","description":"Optional description"}</action>

**Create board cards** (one or multiple):
<action>{"type":"create_cards","column":"To Do","cards":[{"title":"Card title","description":"Details","priority":"medium","tags":["tag1"],"dueDate":"2025-03-01"}]}</action>
Valid priorities: high, medium, low. Column defaults to "To Do" if omitted.

**Create a slide deck:**
<action>{"type":"create_deck","name":"Deck Name","slides":[{"template":"title","content":{"title":"Welcome","subtitle":"A great deck"}},{"template":"bullets","content":{"title":"Key Points","bullets":"• Point 1\\n• Point 2"}},{"template":"title-body","content":{"title":"Details","body":"More info here"}}]}</action>
Valid templates: title, title-body, two-column, bullets, section, quote, blank.
Template fields — title: {title, subtitle}, title-body: {title, body}, two-column: {title, left, right}, bullets: {title, bullets}, section: {heading}, quote: {quote, attribution}, blank: {content}.

Rules:
- Only create items when the user explicitly asks you to.
- Briefly describe what you'll create before the action block.
- You may include multiple action blocks in one response.
- After the action block, tell the user to refresh or navigate to the relevant page to see their new items.

Be concise and direct — 1–3 sentences unless detail is needed. Use **bold** sparingly. Answer questions, give advice, help think through problems, and explain features.`;
  }

  // ---------- Claude API (streaming) ----------
  async function callClaude(userText) {
    const apiKey = localStorage.getItem(API_KEY_STORE) || "";
    if (!apiKey) return null;

    chatHistory.push({ role: "user", content: userText });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

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
        max_tokens: 1024,
        system: buildSystemPrompt(getPageContext()),
        messages: chatHistory,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    return res.body;
  }

  async function streamToElement(body, el) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";
    const container = document.getElementById("mascotMessages");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") break;
        try {
          const chunk = JSON.parse(data);
          const delta = chunk.delta?.text || "";
          if (delta) {
            full += delta;
            el.innerHTML = formatText(full) + '<span class="mascot-cursor"></span>';
            container.scrollTop = container.scrollHeight;
          }
        } catch (_) {}
      }
    }
    chatHistory.push({ role: "assistant", content: full });

    const actionResults = executeActions(full);
    const cleaned = stripActionTags(full);
    el.innerHTML = formatText(cleaned);

    if (actionResults.length) {
      const badge = document.createElement("div");
      badge.className = "mascot-action-result";
      badge.innerHTML = actionResults.map((r) => `<span class="mascot-action-badge">✓ ${formatText(r)}</span>`).join("");
      el.appendChild(badge);
      container.scrollTop = container.scrollHeight;
    }
  }

  // ---------- Response generation ----------
  function generateResponse(input) {
    const lower = input.toLowerCase().trim();

    if (!lower || lower.length < 2)
      return { text: "I didn't catch that. Could you tell me what you'd like to work on?", actions: defaultActions() };

    if (/^(hi|hello|hey|sup|yo|hola|greetings)/i.test(lower))
      return { text: `Hey there! I'm ${currentName()}, your DataScope assistant. What are you working on today? I can help you pick the right tool or set up a project.`, actions: defaultActions() };

    if (/^(help|what can you do|how|guide)/i.test(lower))
      return { text: "I can help you figure out which DataScope tool to use! Just tell me what you're trying to do — like \"I need to visualize sales data\" or \"I want to map a user journey.\" I can also create projects for you to keep everything organized.", actions: defaultActions() };

    if (/change.*(mascot|avatar|character)|switch.*(mascot|avatar|character)|pick.*(mascot|avatar|character)/i.test(lower))
      return { text: "Pick your favorite assistant!", actions: Object.keys(CHARACTERS).map((k) => ({ label: CHARACTERS[k].name, action: () => { setCharacter(k); addBotMessage(`I'm ${CHARACTERS[k].name} now! How can I help?`, defaultActions()); } })) };

    if (detectProjectCreation(lower)) {
      const name = extractProjectName(input);
      if (name) {
        const project = createProject(name);
        return { text: `Done! I created a project called "${project.name}." You can now link charts, slides, board cards, and notes to it from each tool. Want me to suggest which tools you'll need?`, actions: [{ label: "Open Projects", action: () => window.location.href = "projects.html" }, { label: "What tools should I use?", action: "suggest_tools" }] };
      }
      return { text: "I'd love to set up a project for you! What should we call it?", actions: [], expectProjectName: true };
    }

    const intents = matchIntents(lower);
    if (intents.length === 0)
      return { text: "Hmm, I'm not sure which tool fits that best. Here's what DataScope offers — any of these sound right?", actions: Object.values(TOOLS).map((t) => ({ label: `${t.emoji} ${t.name}`, action: () => window.location.href = t.url })) };

    if (intents.length === 1) {
      const { tool } = intents[0];
      return { text: `Sounds like you need **${tool.emoji} ${tool.name}**! ${tool.description}`, actions: [{ label: `Open ${tool.name}`, action: () => window.location.href = tool.url }, { label: "Create a project for this", action: "create_project_prompt" }] };
    }

    const top = intents.slice(0, 3);
    const toolList = top.map((i) => `${i.tool.emoji} **${i.tool.name}** — ${i.tool.description}`).join("\n\n");
    return { text: `Looks like you could use a few tools for this:\n\n${toolList}\n\nWant me to create a project to tie everything together?`, actions: [...top.map((i) => ({ label: `Open ${i.tool.name}`, action: () => window.location.href = i.tool.url })), { label: "Create a project", action: "create_project_prompt" }] };
  }

  function defaultActions() {
    return [
      { label: "📊 Visualize data", action: "charts" },
      { label: "🎨 Build a presentation", action: "slides" },
      { label: "📋 Track tasks", action: "board" },
      { label: "📝 Take notes", action: "notes" },
      { label: "🗺️ Map a journey", action: "canvas" },
      { label: "📁 Start a project", action: "create_project_prompt" },
    ];
  }

  // ---------- UI ----------
  let panelOpen = false;
  let conversationState = "normal";
  const messages = [];

  function buildDOM() {
    const fab = document.createElement("button");
    fab.className = "mascot-fab has-greeting";
    fab.title = `Chat with ${currentName()}`;
    fab.innerHTML = `<span class="mascot-face">${currentSVG()}</span>`;
    fab.addEventListener("click", togglePanel);
    document.body.appendChild(fab);

    const panel = document.createElement("div");
    panel.className = "mascot-panel";
    panel.id = "mascotPanel";
    panel.innerHTML = `
      <div class="mascot-panel-header">
        <div class="mascot-avatar-sm">${currentSVG()}</div>
        <div class="mascot-header-text">
          <div class="mascot-name">${currentName()}</div>
          <div class="mascot-status">Online</div>
        </div>
        <button class="mascot-picker-btn" id="mascotPickerBtn" title="Change mascot">🎭</button>
        <button class="mascot-settings-btn" id="mascotSettingsBtn" title="API key settings">⚙️</button>
        <button class="mascot-panel-close" id="mascotClose">&times;</button>
      </div>
      <div class="mascot-picker" id="mascotPicker" hidden></div>
      <div class="mascot-settings" id="mascotSettings" hidden>
        <label class="mascot-settings-label">Claude API key</label>
        <div class="mascot-key-row">
          <input type="password" class="mascot-key-input" id="mascotApiKey" placeholder="sk-ant-…" autocomplete="off" />
          <button class="mascot-key-save" id="mascotKeySave">Save</button>
        </div>
        <p class="mascot-settings-hint">Stored in your browser only. Used for AI features across DataScope.</p>
        <div class="mascot-key-status" id="mascotKeyStatus"></div>
      </div>
      <div class="mascot-messages" id="mascotMessages"></div>
      <div class="mascot-input-area">
        <input type="text" class="mascot-input" id="mascotInput" placeholder="Tell me what you need…" autocomplete="off" />
        <button class="mascot-send-btn" id="mascotSend">&#9654;</button>
      </div>
    `;
    document.body.appendChild(panel);

    renderPicker();

    document.getElementById("mascotClose").addEventListener("click", togglePanel);
    document.getElementById("mascotSend").addEventListener("click", handleSend);
    document.getElementById("mascotInput").addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });
    document.getElementById("mascotPickerBtn").addEventListener("click", togglePicker);
    document.getElementById("mascotSettingsBtn").addEventListener("click", toggleSettings);
    document.getElementById("mascotKeySave").addEventListener("click", saveApiKey);
    document.getElementById("mascotApiKey").addEventListener("keydown", (e) => { if (e.key === "Enter") saveApiKey(); });
  }

  function toggleSettings() {
    const settings = document.getElementById("mascotSettings");
    const picker = document.getElementById("mascotPicker");
    const isHidden = settings.hidden;
    settings.hidden = !isHidden;
    if (!isHidden) return;
    picker.hidden = true;
    try {
      const existing = localStorage.getItem(API_KEY_STORE) || "";
      document.getElementById("mascotApiKey").value = existing;
    } catch (_) {}
    document.getElementById("mascotKeyStatus").textContent = "";
    setTimeout(() => document.getElementById("mascotApiKey").focus(), 50);
  }

  function saveApiKey() {
    const key = document.getElementById("mascotApiKey").value.trim();
    const status = document.getElementById("mascotKeyStatus");
    try {
      if (key) {
        localStorage.setItem(API_KEY_STORE, key);
        status.textContent = "✓ Key saved.";
        status.className = "mascot-key-status saved";
      } else {
        localStorage.removeItem(API_KEY_STORE);
        status.textContent = "Key cleared.";
        status.className = "mascot-key-status";
      }
    } catch (_) {
      status.textContent = "Could not save key.";
      status.className = "mascot-key-status error";
    }
    setTimeout(() => { document.getElementById("mascotSettings").hidden = true; }, 1200);
  }

  function renderPicker() {
    const picker = document.getElementById("mascotPicker");
    picker.innerHTML = "";
    for (const [key, char] of Object.entries(CHARACTERS)) {
      const btn = document.createElement("button");
      btn.className = "mascot-pick-option" + (key === selectedCharacter ? " active" : "");
      btn.title = char.name;
      btn.innerHTML = `<span class="mascot-pick-avatar">${char.svg}</span><span class="mascot-pick-name">${char.name}</span>`;
      btn.addEventListener("click", () => {
        setCharacter(key);
        renderPicker();
        document.getElementById("mascotPicker").hidden = true;
      });
      picker.appendChild(btn);
    }
  }

  function togglePicker() {
    const picker = document.getElementById("mascotPicker");
    picker.hidden = !picker.hidden;
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    document.getElementById("mascotPanel").classList.toggle("open", panelOpen);
    if (panelOpen && messages.length === 0) showGreeting();
    if (panelOpen) setTimeout(() => document.getElementById("mascotInput").focus(), 200);
  }

  function showGreeting() {
    const page = detectCurrentPage();
    const name = currentName();
    const hasKey = !!(localStorage.getItem(API_KEY_STORE) || "");

    if (hasKey) {
      const llmGreetings = {
        charts: `Hey! I'm ${name}, your AI assistant. I can see you're in Charts — ask me anything about your data, or how to make the most of DataScope.`,
        slides: `Hey! I'm ${name}. I can help you build out your deck, brainstorm content, or answer questions about Slides.`,
        board: `Hey! I'm ${name}. I can see your board — ask me to help prioritize tasks, explain features, or think through your project.`,
        notes: `Hey! I'm ${name}. I can help you organize your thoughts, suggest how to structure notes, or answer anything about DataScope.`,
        canvas: `Hey! I'm ${name}. Ready to map something out? Ask me for help structuring a diagram or using Canvas features.`,
        projects: `Hey! I'm ${name}. I can help you think through your project structure or explain how to link everything together.`,
      };
      addBotMessage(llmGreetings[page] || `Hey! I'm ${name}, your DataScope AI assistant. What can I help you with?`, []);
      return;
    }

    const greetings = {
      charts: `Hey! I'm ${name}. I see you're in Charts. Need help visualizing your data, or working on something else?`,
      slides: `Hey! I'm ${name}. Working on a presentation? I can help you organize your deck or suggest other tools.`,
      board: `Hey! I'm ${name}. Organizing tasks? Let me know if you need help setting up a project or linking things together.`,
      notes: `Hey! I'm ${name}. Jotting down ideas? I can help you connect notes to a project or suggest other tools.`,
      canvas: `Hey! I'm ${name}. Ready to map something out? Drop shapes, connect them with arrows, and build your flow!`,
      projects: `Hey! I'm ${name}. This is the Projects hub. Want me to help you create a new project or figure out what tools you need?`,
    };
    addBotMessage(greetings[page] || `Hey! I'm ${name}, your DataScope assistant. What would you like to do today?`, defaultActions());
  }

  function detectCurrentPage() {
    const path = window.location.pathname;
    if (path.includes("slides")) return "slides";
    if (path.includes("kanban")) return "board";
    if (path.includes("notes")) return "notes";
    if (path.includes("canvas")) return "canvas";
    if (path.includes("projects")) return "projects";
    return "charts";
  }

  async function handleSend() {
    const input = document.getElementById("mascotInput");
    const sendBtn = document.getElementById("mascotSend");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    addUserMessage(text);

    const apiKey = localStorage.getItem(API_KEY_STORE) || "";

    if (apiKey) {
      // LLM mode
      input.disabled = true;
      sendBtn.disabled = true;
      showTyping();
      try {
        const body = await callClaude(text);
        removeTyping();
        const el = createStreamingBotMessage();
        await streamToElement(body, el);
      } catch (err) {
        removeTyping();
        addBotMessage(`Sorry, something went wrong: ${err.message}. Check your API key in ⚙️ settings.`, []);
      } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        setTimeout(() => input.focus(), 50);
      }
      return;
    }

    // Fallback keyword mode (no API key)
    if (conversationState === "expecting_project_name") {
      conversationState = "normal";
      const project = createProject(text);
      setTimeout(() => {
        addBotMessage(`Created! Your project "${project.name}" is ready. You can start linking items to it from any tool.`, [{ label: "Open Projects", action: () => window.location.href = "projects.html" }, { label: "What else can I do?", action: "help" }]);
      }, 500);
      return;
    }

    showTyping();
    setTimeout(() => {
      removeTyping();
      const response = generateResponse(text);
      if (response.expectProjectName) conversationState = "expecting_project_name";
      addBotMessage(response.text, response.actions || []);
    }, 600 + Math.random() * 400);
  }

  function handleActionClick(action) {
    if (typeof action === "function") { action(); return; }

    if (action === "create_project_prompt") {
      conversationState = "expecting_project_name";
      addBotMessage("Great idea! What would you like to name your project?", []);
      setTimeout(() => document.getElementById("mascotInput").focus(), 100);
      return;
    }

    if (action === "suggest_tools") {
      addBotMessage("Here are all the tools at your disposal:\n\n📊 **Charts** — Visualize data with bar, line, pie, scatter, and more\n🎨 **Slides** — Build presentation decks with templates\n📋 **Board** — Kanban task management with priorities and due dates\n📝 **Notes** — Quick sticky notes with tags and colors\n🗺️ **Canvas** — Journey maps, flowcharts, and diagrams\n📁 **Projects** — Link everything together",
        Object.values(TOOLS).map((t) => ({ label: `Open ${t.name}`, action: () => window.location.href = t.url })));
      return;
    }

    if (action === "help") {
      addBotMessage("Just tell me what you're trying to do! For example:\n\n• \"I need to visualize quarterly sales\"\n• \"Create a project called Product Launch\"\n• \"I want to map a user journey\"\n• \"Help me track my team's tasks\"", defaultActions());
      return;
    }

    if (TOOLS[action]) {
      const tool = TOOLS[action];
      addUserMessage(`I want to use ${tool.name}`);
      showTyping();
      setTimeout(() => {
        removeTyping();
        addBotMessage(`${tool.emoji} **${tool.name}** is a great choice! ${tool.description}`, [{ label: `Open ${tool.name}`, action: () => window.location.href = tool.url }, { label: "Create a project for this", action: "create_project_prompt" }]);
      }, 400);
    }
  }

  // ---------- Message rendering ----------
  function addBotMessage(text, actions) { messages.push({ type: "bot", text, actions }); renderMessage({ type: "bot", text, actions }); }
  function addUserMessage(text) { messages.push({ type: "user", text }); renderMessage({ type: "user", text }); }

  function createStreamingBotMessage() {
    const container = document.getElementById("mascotMessages");
    const el = document.createElement("div");
    el.className = "mascot-msg bot";
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
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
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  }

  function showTyping() {
    const container = document.getElementById("mascotMessages");
    const el = document.createElement("div");
    el.className = "mascot-typing"; el.id = "mascotTyping";
    el.innerHTML = "<span></span><span></span><span></span>";
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() { const el = document.getElementById("mascotTyping"); if (el) el.remove(); }

  // ---------- Init ----------
  function init() { buildDOM(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
