(() => {
  const PROJECTS_KEY = 'datascope_projects';

  function loadProjects() {
    try {
      const raw = localStorage.getItem(PROJECTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const tools = [
    {
      name: 'Charts', desc: 'Interactive data visualizations from CSV or manual entry.', href: 'charts.html',
      icon: '<svg viewBox="0 0 32 32" fill="none"><rect x="4" y="16" width="5" height="12" rx="1.5" fill="currentColor" opacity=".5"/><rect x="13" y="10" width="5" height="18" rx="1.5" fill="currentColor" opacity=".7"/><rect x="22" y="4" width="5" height="24" rx="1.5" fill="currentColor"/></svg>'
    },
    {
      name: 'Slides', desc: 'Build and present slide decks right in the browser.', href: 'slides.html',
      icon: '<svg viewBox="0 0 32 32" fill="none"><rect x="3" y="6" width="26" height="16" rx="3" stroke="currentColor" stroke-width="2"/><path d="M16 22v4M11 26h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    },
    {
      name: 'Board', desc: 'Kanban-style task management with drag and drop.', href: 'kanban.html',
      icon: '<svg viewBox="0 0 32 32" fill="none"><rect x="3" y="4" width="7" height="24" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="12.5" y="4" width="7" height="17" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="22" y="4" width="7" height="20" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>'
    },
    {
      name: 'Notes', desc: 'Quick notes and ideas with instant search.', href: 'notes.html',
      icon: '<svg viewBox="0 0 32 32" fill="none"><rect x="5" y="3" width="22" height="26" rx="3" stroke="currentColor" stroke-width="2"/><path d="M10 10h12M10 15h10M10 20h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    },
    {
      name: 'Canvas', desc: 'Freeform drawing, shapes, and diagrams.', href: 'canvas.html',
      icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M6 24l3-12L22 5l4 4-13 13-12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M18 9l4 4" stroke="currentColor" stroke-width="2"/></svg>'
    },
    {
      name: 'Docs', desc: 'Rich documents with nested tasks and user stories.', href: 'docs.html',
      icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M8 3h11l7 7v19a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/><path d="M18 3v8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10 17h12M10 22h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    },
    {
      name: 'Collections', desc: 'Group charts, docs, notes, and more together.', href: 'projects.html',
      icon: '<svg viewBox="0 0 32 32" fill="none"><path d="M4 10a3 3 0 013-3h5l3 3h10a3 3 0 013 3v12a3 3 0 01-3 3H7a3 3 0 01-3-3V10z" stroke="currentColor" stroke-width="2"/></svg>'
    }
  ];

  function renderTools() {
    const grid = document.getElementById('toolsGrid');
    tools.forEach(tool => {
      const card = document.createElement('a');
      card.className = 'tool-card';
      card.href = tool.href;
      const icon = document.createElement('div');
      icon.className = 'tool-icon';
      icon.innerHTML = tool.icon;
      const name = document.createElement('h3');
      name.textContent = tool.name;
      const desc = document.createElement('p');
      desc.textContent = tool.desc;
      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);
      grid.appendChild(card);
    });
  }

  function renderProjects() {
    const projects = loadProjects();
    const grid = document.getElementById('homeProjectsGrid');
    const empty = document.getElementById('homeProjectsEmpty');

    if (!projects.length) {
      empty.hidden = false;
      grid.hidden = true;
      return;
    }

    empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = '';

    projects.slice(0, 6).forEach(project => {
      const card = document.createElement('a');
      card.className = 'home-project-card';
      card.href = 'projects.html';
      const name = document.createElement('h3');
      name.textContent = project.name || 'Untitled';
      const desc = document.createElement('p');
      desc.textContent = project.description || 'No description';
      if (!project.description) desc.classList.add('muted');
      card.appendChild(name);
      card.appendChild(desc);
      grid.appendChild(card);
    });

    if (projects.length > 6) {
      const more = document.createElement('a');
      more.className = 'home-project-card home-project-more';
      more.href = 'projects.html';
      more.textContent = `+${projects.length - 6} more`;
      grid.appendChild(more);
    }
  }

  function init() {
    document.getElementById('year').textContent = new Date().getFullYear();
    renderTools();
    renderProjects();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
