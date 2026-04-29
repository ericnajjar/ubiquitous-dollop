/*
  DATASCOPE FEEDBACK
  ==================
  Supabase table setup — run this in the SQL Editor:

  create table feedback (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    user_email text,
    category text not null default 'other',
    title text not null default '',
    body text not null default '',
    page text,
    created_at timestamptz default now()
  );

  alter table feedback enable row level security;

  -- Users can insert and read their own feedback
  create policy "Users insert own feedback" on feedback
    for insert with check (auth.uid() = user_id);

  create policy "Users read own feedback" on feedback
    for select using (auth.uid() = user_id);
*/
(() => {
  const ds = window.datascope;
  const sb = ds?.sb;
  if (!sb) return;

  const currentPage = location.pathname.split("/").pop().replace(".html", "") || "index";

  async function getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function buildFAB() {
    const btn = document.createElement("button");
    btn.className = "feedback-fab";
    btn.setAttribute("aria-label", "Send feedback");
    btn.title = "Send feedback";
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
    btn.addEventListener("click", openModal);
    document.body.appendChild(btn);
  }

  function openModal() {
    if (document.getElementById("feedbackOverlay")) return;

    const overlay = document.createElement("div");
    overlay.className = "feedback-overlay";
    overlay.id = "feedbackOverlay";

    const modal = document.createElement("div");
    modal.className = "feedback-modal";

    const header = document.createElement("div");
    header.className = "feedback-modal-header";
    const h2 = document.createElement("h2");
    h2.textContent = "Send Feedback";
    const closeBtn = document.createElement("button");
    closeBtn.className = "feedback-modal-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", closeModal);
    header.appendChild(h2);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const body = document.createElement("div");
    body.className = "feedback-modal-body";

    const catField = document.createElement("div");
    catField.className = "feedback-field";
    const catLabel = document.createElement("label");
    catLabel.textContent = "Category";
    catLabel.htmlFor = "fbCategory";
    const catSel = document.createElement("select");
    catSel.id = "fbCategory";
    [["feature", "Feature Request"], ["bug", "Bug Report"], ["improvement", "Improvement"], ["other", "Other"]].forEach(([val, text]) => {
      const o = document.createElement("option");
      o.value = val; o.textContent = text;
      catSel.appendChild(o);
    });
    catField.appendChild(catLabel);
    catField.appendChild(catSel);
    body.appendChild(catField);

    const titleField = document.createElement("div");
    titleField.className = "feedback-field";
    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Title";
    titleLabel.htmlFor = "fbTitle";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.id = "fbTitle";
    titleInput.placeholder = "Brief summary of your feedback";
    titleField.appendChild(titleLabel);
    titleField.appendChild(titleInput);
    body.appendChild(titleField);

    const bodyField = document.createElement("div");
    bodyField.className = "feedback-field";
    const bodyLabel = document.createElement("label");
    bodyLabel.textContent = "Description";
    bodyLabel.htmlFor = "fbBody";
    const bodyText = document.createElement("textarea");
    bodyText.id = "fbBody";
    bodyText.rows = 5;
    bodyText.placeholder = "Tell us what you'd like to see, what could be improved, or describe the issue you encountered…";
    bodyField.appendChild(bodyLabel);
    bodyField.appendChild(bodyText);
    body.appendChild(bodyField);

    const historyWrap = document.createElement("div");
    historyWrap.className = "feedback-history";
    historyWrap.id = "fbHistory";
    body.appendChild(historyWrap);

    modal.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "feedback-modal-footer";
    const status = document.createElement("span");
    status.className = "feedback-status";
    status.id = "fbStatus";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-ghost";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", closeModal);
    const submitBtn = document.createElement("button");
    submitBtn.className = "btn btn-primary";
    submitBtn.textContent = "Submit";
    submitBtn.id = "fbSubmit";
    submitBtn.addEventListener("click", handleSubmit);
    footer.appendChild(status);
    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);

    setTimeout(() => titleInput.focus(), 50);
    loadHistory();
  }

  function closeModal() {
    const el = document.getElementById("feedbackOverlay");
    if (el) el.remove();
  }

  async function handleSubmit() {
    const title = document.getElementById("fbTitle").value.trim();
    const bodyVal = document.getElementById("fbBody").value.trim();
    const category = document.getElementById("fbCategory").value;
    const status = document.getElementById("fbStatus");
    const submitBtn = document.getElementById("fbSubmit");

    if (!title && !bodyVal) {
      status.className = "feedback-status error";
      status.textContent = "Please enter a title or description.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    status.className = "feedback-status";
    status.textContent = "";

    try {
      const session = await getSession();
      if (!session) {
        status.className = "feedback-status error";
        status.textContent = "Not signed in.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
        return;
      }

      const { error } = await sb.from("feedback").insert({
        user_id: session.user.id,
        user_email: session.user.email,
        category,
        title: title || "(no title)",
        body: bodyVal,
        page: currentPage,
      });

      if (error) throw error;

      status.className = "feedback-status success";
      status.textContent = "Thank you! Your feedback has been submitted.";
      document.getElementById("fbTitle").value = "";
      document.getElementById("fbBody").value = "";
      submitBtn.textContent = "Submit";
      submitBtn.disabled = false;

      loadHistory();

      setTimeout(closeModal, 2000);
    } catch (err) {
      status.className = "feedback-status error";
      status.textContent = "Failed to submit: " + (err.message || "Unknown error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  }

  async function loadHistory() {
    const wrap = document.getElementById("fbHistory");
    if (!wrap) return;

    try {
      const session = await getSession();
      if (!session) return;

      const { data, error } = await sb.from("feedback")
        .select("id, category, title, body, page, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error || !data || !data.length) {
        wrap.innerHTML = "";
        return;
      }

      wrap.innerHTML = "";
      const titleRow = document.createElement("div");
      titleRow.className = "feedback-history-title";
      const titleText = document.createElement("span");
      titleText.textContent = "Your previous feedback";
      titleRow.appendChild(titleText);
      wrap.appendChild(titleRow);

      const list = document.createElement("div");
      list.className = "feedback-history-list";

      data.forEach(item => {
        const card = document.createElement("div");
        card.className = "feedback-history-item";

        const cardHeader = document.createElement("div");
        cardHeader.className = "feedback-history-item-header";
        const badge = document.createElement("span");
        badge.className = "feedback-history-badge " + item.category;
        badge.textContent = item.category;
        const time = document.createElement("span");
        time.className = "feedback-history-time";
        time.textContent = formatTime(item.created_at);
        cardHeader.appendChild(badge);
        cardHeader.appendChild(time);
        card.appendChild(cardHeader);

        if (item.title) {
          const t = document.createElement("div");
          t.className = "feedback-history-text";
          t.style.fontWeight = "600";
          t.textContent = item.title;
          card.appendChild(t);
        }
        if (item.body) {
          const b = document.createElement("div");
          b.className = "feedback-history-text";
          b.textContent = item.body.length > 120 ? item.body.slice(0, 120) + "…" : item.body;
          card.appendChild(b);
        }

        list.appendChild(card);
      });

      wrap.appendChild(list);
    } catch (_) {}
  }

  function init() {
    if (location.pathname.endsWith("auth.html")) return;
    buildFAB();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
