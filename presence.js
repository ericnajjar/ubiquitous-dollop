(() => {
  const ds = window.datascope;
  const sb = ds?.sb;
  if (!sb) return;

  const COLORS = [
    "#6ea8ff", "#8b5cf6", "#f472b6", "#fb923c",
    "#4ade80", "#facc15", "#38bdf8", "#a78bfa",
    "#f87171", "#34d399", "#e879f9", "#fbbf24",
  ];

  let currentChannel = null;
  let currentDocId = null;
  let myUserId = null;
  let myEmail = null;

  function colorForUser(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  function initialFor(email) {
    if (!email) return "?";
    const name = email.split("@")[0];
    const parts = name.split(/[._-]/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function renderPresence(presences) {
    const bar = document.getElementById("presenceBar");
    if (!bar) return;
    bar.innerHTML = "";

    const others = presences.filter(p => p.user_id !== myUserId);
    if (!others.length) return;

    const label = document.createElement("span");
    label.className = "presence-you-label";
    label.textContent = others.length + " viewing";
    bar.appendChild(label);

    others.forEach(p => {
      const avatar = document.createElement("div");
      avatar.className = "presence-avatar";
      avatar.style.background = colorForUser(p.user_id);
      avatar.textContent = initialFor(p.email);

      const dot = document.createElement("span");
      dot.className = "presence-dot";
      avatar.appendChild(dot);

      const tooltip = document.createElement("span");
      tooltip.className = "presence-tooltip";
      tooltip.textContent = p.email || "Unknown";
      avatar.appendChild(tooltip);

      bar.appendChild(avatar);
    });
  }

  function flattenPresences(state) {
    const seen = new Set();
    const result = [];
    Object.values(state).forEach(list => {
      list.forEach(p => {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          result.push(p);
        }
      });
    });
    return result;
  }

  async function joinDoc(docId) {
    if (currentDocId === docId && currentChannel) return;
    leaveDoc();

    if (!docId) return;
    currentDocId = docId;

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      myUserId = session.user.id;
      myEmail = session.user.email;
    } catch (_) { return; }

    const channelName = "presence:doc:" + docId;
    const channel = sb.channel(channelName);

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      renderPresence(flattenPresences(state));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: myUserId,
          email: myEmail,
          online_at: new Date().toISOString(),
        });
      }
    });

    currentChannel = channel;
  }

  function leaveDoc() {
    if (currentChannel) {
      currentChannel.untrack();
      sb.removeChannel(currentChannel);
      currentChannel = null;
    }
    currentDocId = null;
    const bar = document.getElementById("presenceBar");
    if (bar) bar.innerHTML = "";
  }

  function init() {
    if (location.pathname.endsWith("auth.html")) return;

    const editorHeader = document.getElementById("editorHeader");
    if (!editorHeader) return;

    const titleInput = editorHeader.querySelector(".editor-title");
    const bar = document.createElement("div");
    bar.className = "presence-bar";
    bar.id = "presenceBar";

    if (titleInput && titleInput.nextSibling) {
      editorHeader.insertBefore(bar, titleInput.nextSibling);
    } else {
      editorHeader.appendChild(bar);
    }

    document.addEventListener("datascope:docselect", (e) => {
      joinDoc(e.detail?.docId || null);
    });

    document.addEventListener("datascope:teamchange", () => {
      leaveDoc();
    });
  }

  ds.presence = { joinDoc, leaveDoc };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
