// DataScope Agents — AI agent management page
(() => {
  const STORE_KEY = "datascope_agents";
  const API_KEY_STORE = "datascope_anthropic_key";

  const AGENT_COLORS = [
    "#6ea8ff", "#8b5cf6", "#4ade80", "#f87171",
    "#fbbf24", "#22d3ee", "#f472b6", "#a78bfa",
  ];

  const CAPABILITIES = [
    { id: "notes", label: "Notes", emoji: "📝" },
    { id: "board", label: "Board", emoji: "📋" },
    { id: "slides", label: "Slides", emoji: "🎨" },
    { id: "canvas", label: "Canvas", emoji: "🗺️" },
    { id: "charts", label: "Charts", emoji: "📊" },
  ];

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function loadAgents() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function saveAgents(agents) {
    localStorage.setItem(STORE_KEY, JSON.stringify(agents));
  }

  const state = {
    agents: loadAgents(),
    editingId: null,
    editingColor: AGENT_COLORS[0],
    editingCaps: [],
  };

  function teamId() {
    return window.datascope?.activeTeamId || null;
  }

  function filteredAgents() {
    const tid = teamId();
    return state.agents.filter(a => (a.teamId || null) === tid);
  }

  function render() {
    const grid = document.getElementById("agentsGrid");
    const empty = document.getElementById("agentsEmpty");
    const notice = document.getElementById("apiNotice");
    grid.innerHTML = "";

    const apiKey = localStorage.getItem(API_KEY_STORE);
    notice.hidden = !!apiKey;

    const agents = filteredAgents();
    if (!agents.length) {
      empty.hidden = false;
      grid.hidden = true;
      return;
    }
    empty.hidden = true;
    grid.hidden = false;

    agents.forEach(agent => grid.appendChild(buildAgentCard(agent)));
  }

  function buildAgentCard(agent) {
    const card = document.createElement("div");
    card.className = "agent-card";

    const header = document.createElement("div");
    header.className = "agent-card-header";

    const avatar = document.createElement("div");
    avatar.className = "agent-avatar";
    avatar.style.background = agent.color || AGENT_COLORS[0];
    avatar.textContent = (agent.name || "A").charAt(0).toUpperCase();

    const info = document.createElement("div");
    info.className = "agent-card-info";

    const name = document.createElement("div");
    name.className = "agent-card-name";
    name.textContent = agent.name;

    const desc = document.createElement("div");
    desc.className = "agent-card-desc";
    desc.textContent = agent.description || "No description";

    info.append(name, desc);
    header.append(avatar, info);
    card.appendChild(header);

    if (agent.capabilities?.length) {
      const caps = document.createElement("div");
      caps.className = "agent-card-caps";
      agent.capabilities.forEach(capId => {
        const cap = CAPABILITIES.find(c => c.id === capId);
        if (!cap) return;
        const badge = document.createElement("span");
        badge.className = "cap-badge";
        badge.textContent = cap.emoji + " " + cap.label;
        caps.appendChild(badge);
      });
      card.appendChild(caps);
    }

    const actions = document.createElement("div");
    actions.className = "agent-card-actions";

    const chatBtn = document.createElement("button");
    chatBtn.className = "btn btn-primary btn-sm";
    chatBtn.textContent = "Chat";
    chatBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent("datascope:openAgentChat", { detail: { agentId: agent.id } }));
    });

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openModal(agent);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-ghost btn-sm danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm('Delete agent "' + agent.name + '"?')) return;
      state.agents = state.agents.filter(a => a.id !== agent.id);
      saveAgents(state.agents);
      render();
    });

    actions.append(chatBtn, editBtn, deleteBtn);
    card.appendChild(actions);

    card.addEventListener("click", () => openModal(agent));
    return card;
  }

  function openModal(agent) {
    state.editingId = agent ? agent.id : null;
    state.editingColor = agent?.color || AGENT_COLORS[0];
    state.editingCaps = agent?.capabilities ? [...agent.capabilities] : ["notes", "board", "slides"];

    document.getElementById("agentNameInput").value = agent?.name || "";
    document.getElementById("agentDescInput").value = agent?.description || "";
    document.getElementById("agentInstructionsInput").value = agent?.instructions || "";
    document.getElementById("modalTitle").textContent = agent ? "Edit Agent" : "Create Agent";
    document.getElementById("deleteAgentBtn").hidden = !agent;

    renderColorOptions();
    renderCapOptions();

    document.getElementById("modalOverlay").hidden = false;
    document.getElementById("agentNameInput").focus();
  }

  function closeModal() {
    document.getElementById("modalOverlay").hidden = true;
    state.editingId = null;
  }

  function renderColorOptions() {
    const wrap = document.getElementById("colorOptions");
    wrap.innerHTML = "";
    AGENT_COLORS.forEach(color => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-option" + (color === state.editingColor ? " active" : "");
      btn.style.background = color;
      btn.addEventListener("click", () => {
        state.editingColor = color;
        wrap.querySelectorAll(".color-option").forEach(b =>
          b.classList.toggle("active", b.style.background === color || b.style.backgroundColor === color)
        );
      });
      wrap.appendChild(btn);
    });
  }

  function renderCapOptions() {
    const wrap = document.getElementById("capOptions");
    wrap.innerHTML = "";
    CAPABILITIES.forEach(cap => {
      const label = document.createElement("label");
      label.className = "cap-option" + (state.editingCaps.includes(cap.id) ? " active" : "");

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = state.editingCaps.includes(cap.id);
      input.addEventListener("change", () => {
        if (input.checked) {
          state.editingCaps.push(cap.id);
        } else {
          state.editingCaps = state.editingCaps.filter(c => c !== cap.id);
        }
        label.classList.toggle("active", input.checked);
      });

      label.appendChild(input);
      label.appendChild(document.createTextNode(cap.emoji + " " + cap.label));
      wrap.appendChild(label);
    });
  }

  function saveModal() {
    const name = document.getElementById("agentNameInput").value.trim();
    const description = document.getElementById("agentDescInput").value.trim();
    const instructions = document.getElementById("agentInstructionsInput").value.trim();

    if (!name) {
      document.getElementById("agentNameInput").focus();
      return;
    }

    const now = new Date().toISOString();

    if (state.editingId) {
      const agent = state.agents.find(a => a.id === state.editingId);
      if (agent) {
        agent.name = name;
        agent.description = description;
        agent.instructions = instructions;
        agent.color = state.editingColor;
        agent.capabilities = [...state.editingCaps];
        agent.updatedAt = now;
      }
    } else {
      state.agents.push({
        id: uid(),
        teamId: teamId(),
        name,
        description,
        instructions,
        color: state.editingColor,
        capabilities: [...state.editingCaps],
        createdAt: now,
        updatedAt: now,
      });
    }

    saveAgents(state.agents);
    closeModal();
    render();
  }

  function deleteAgent() {
    if (!state.editingId) return;
    if (!confirm("Delete this agent?")) return;
    state.agents = state.agents.filter(a => a.id !== state.editingId);
    saveAgents(state.agents);
    closeModal();
    render();
  }

  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();
    render();

    document.getElementById("createAgentBtn").addEventListener("click", () => openModal(null));
    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modalSave").addEventListener("click", saveModal);
    document.getElementById("deleteAgentBtn").addEventListener("click", deleteAgent);
    document.getElementById("modalOverlay").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.getElementById("modalOverlay").hidden) closeModal();
    });

    document.addEventListener("datascope:teamchange", () => render());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
