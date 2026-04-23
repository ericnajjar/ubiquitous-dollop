// DataScope Slides — template-based slide deck builder with projects & image support.
(() => {
  const STORE_KEY = "datascope_slides";
  const CHART_IMPORT_KEY = "datascope_chart_to_slides";
  const GLOBAL_PROJECTS_KEY = "datascope_projects";
  const API_KEY_STORE = "datascope_anthropic_key";

  // ---------- Templates ----------
  const TEMPLATES = {
    title: {
      name: "Title Slide",
      fields: { title: "Presentation Title", subtitle: "Your subtitle here" },
    },
    "title-body": {
      name: "Title + Body",
      fields: {
        title: "Slide Title",
        body: "Add your content here. You can write multiple lines of text to fill the body area.",
      },
    },
    "two-column": {
      name: "Two Columns",
      fields: {
        title: "Slide Title",
        left: "Left column content goes here.",
        right: "Right column content goes here.",
      },
    },
    bullets: {
      name: "Title + Bullets",
      fields: {
        title: "Key Points",
        bullets: "• First important point\n• Second important point\n• Third important point\n• Fourth important point",
      },
    },
    section: {
      name: "Section Break",
      fields: { heading: "Section Title" },
    },
    quote: {
      name: "Quote",
      fields: {
        quote: "\u201CThe best way to predict the future is to create it.\u201D",
        attribution: "\u2014 Peter Drucker",
      },
    },
    blank: {
      name: "Blank",
      fields: { content: "Click to edit" },
    },
    "title-image": {
      name: "Title + Image",
      fields: { title: "Slide Title", image: "" },
    },
    "full-image": {
      name: "Full Image",
      fields: { image: "" },
    },
    "image-caption": {
      name: "Image + Caption",
      fields: { image: "", caption: "Add a caption here" },
    },
  };

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ---------- Render slide HTML ----------
  function renderSlideHTML(template, content, style) {
    const tpl = TEMPLATES[template];
    if (!tpl) return "";

    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

    const ce = 'contenteditable="true" spellcheck="false"';

    function imageZone(fieldName, imgData) {
      if (imgData) {
        return `<div class="image-drop-zone" data-field="${fieldName}"><img src="${imgData}" alt="Slide image" /></div>`;
      }
      return `<div class="image-drop-zone" data-field="${fieldName}"><span class="placeholder">Drop an image here or click to browse</span></div>`;
    }

    switch (template) {
      case "title":
        return `<div class="slide-content layout-title">
          <div class="field-title" ${ce} data-field="title">${esc(content.title)}</div>
          <div class="field-subtitle" ${ce} data-field="subtitle">${esc(content.subtitle)}</div>
        </div>`;

      case "title-body":
        return `<div class="slide-content layout-title-body">
          <div class="field-title" ${ce} data-field="title">${esc(content.title)}</div>
          <div class="field-body" ${ce} data-field="body">${esc(content.body)}</div>
        </div>`;

      case "two-column":
        return `<div class="slide-content layout-two-column">
          <div class="field-title" ${ce} data-field="title">${esc(content.title)}</div>
          <div class="columns">
            <div class="field-left" ${ce} data-field="left">${esc(content.left)}</div>
            <div class="field-right" ${ce} data-field="right">${esc(content.right)}</div>
          </div>
        </div>`;

      case "bullets":
        return `<div class="slide-content layout-bullets">
          <div class="field-title" ${ce} data-field="title">${esc(content.title)}</div>
          <div class="field-bullets" ${ce} data-field="bullets">${esc(content.bullets)}</div>
        </div>`;

      case "section":
        return `<div class="slide-content layout-section">
          <div class="field-heading" ${ce} data-field="heading">${esc(content.heading)}</div>
        </div>`;

      case "quote":
        return `<div class="slide-content layout-quote">
          <div class="field-quote" ${ce} data-field="quote">${esc(content.quote)}</div>
          <div class="field-attribution" ${ce} data-field="attribution">${esc(content.attribution)}</div>
        </div>`;

      case "blank":
        return `<div class="slide-content layout-blank">
          <div class="field-content" ${ce} data-field="content">${esc(content.content)}</div>
        </div>`;

      case "title-image":
        return `<div class="slide-content layout-title-image">
          <div class="field-title" ${ce} data-field="title">${esc(content.title)}</div>
          ${imageZone("image", content.image)}
        </div>`;

      case "full-image":
        return `<div class="slide-content layout-full-image">
          ${imageZone("image", content.image)}
        </div>`;

      case "image-caption":
        return `<div class="slide-content layout-image-caption">
          ${imageZone("image", content.image)}
          <div class="field-caption" ${ce} data-field="caption">${esc(content.caption)}</div>
        </div>`;

      default:
        return "";
    }
  }

  // ---------- Persistence ----------
  function loadProjects() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.projects) && data.projects.length) return data;
      }
    } catch (_) {}
    return null;
  }

  function migrateOldFormat() {
    try {
      const oldKey = "datascope_slides_old_check";
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.projects) return null;
      if (Array.isArray(data.slides)) {
        return {
          projects: [{ id: uid(), name: "My Deck", slides: data.slides }],
          currentProject: 0,
          currentSlide: data.current || 0,
        };
      }
    } catch (_) {}
    return null;
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          projects: state.projects,
          currentProject: state.currentProject,
          currentSlide: state.currentSlide,
        })
      );
    } catch (_) {}
  }

  // ---------- State ----------
  function defaultState() {
    return {
      projects: [
        {
          id: uid(),
          name: "My Deck",
          slides: [
            {
              template: "title",
              content: { title: "My Presentation", subtitle: "Created with DataScope Slides" },
              font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              textColor: "#ffffff",
              bgColor: "#1a1a2e",
            },
          ],
        },
      ],
      currentProject: 0,
      currentSlide: 0,
    };
  }

  const migrated = migrateOldFormat();
  const loaded = loadProjects();
  const state = migrated || loaded || defaultState();
  if (migrated) saveState();

  function currentProject() {
    return state.projects[state.currentProject] || state.projects[0];
  }

  function currentSlides() {
    return currentProject().slides;
  }

  function currentSlide() {
    return currentSlides()[state.currentSlide];
  }

  function makeSlide(template = "title") {
    const tpl = TEMPLATES[template];
    return {
      template,
      content: { ...tpl.fields },
      font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      textColor: "#ffffff",
      bgColor: "#1a1a2e",
    };
  }

  // ---------- Save content from contenteditable ----------
  function saveFieldsFromDOM() {
    const slide = currentSlide();
    if (!slide) return;
    const preview = document.getElementById("slidePreview");
    preview.querySelectorAll("[data-field]").forEach((el) => {
      const field = el.getAttribute("data-field");
      if (el.classList.contains("image-drop-zone")) return;
      const html = el.innerHTML;
      const text = html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
      slide.content[field] = text;
    });
    saveState();
  }

  // ---------- Image drop handling ----------
  function setupImageDropZones() {
    const preview = document.getElementById("slidePreview");
    const zones = preview.querySelectorAll(".image-drop-zone");
    zones.forEach((zone) => {
      const fieldName = zone.getAttribute("data-field");

      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("dragover");
      });

      zone.addEventListener("dragleave", () => {
        zone.classList.remove("dragover");
      });

      zone.addEventListener("drop", (e) => {
        e.preventDefault();
        zone.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file && file.type.match(/^image\/(jpeg|png|jpg)$/)) {
          readImageFile(file, fieldName);
        }
      });

      zone.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/jpeg,image/png";
        input.addEventListener("change", () => {
          if (input.files[0]) readImageFile(input.files[0], fieldName);
        });
        input.click();
      });
    });
  }

  function readImageFile(file, fieldName) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const slide = currentSlide();
      if (!slide) return;
      slide.content[fieldName] = e.target.result;
      saveState();
      renderSlidePreview();
    };
    reader.readAsDataURL(file);
  }

  // ---------- Render ----------
  function renderSlidePreview() {
    const slide = currentSlide();
    if (!slide) return;
    const preview = document.getElementById("slidePreview");
    preview.style.fontFamily = slide.font;
    preview.style.color = slide.textColor;
    preview.style.background = slide.bgColor;
    preview.innerHTML = renderSlideHTML(slide.template, slide.content);

    preview.querySelectorAll("[data-field]:not(.image-drop-zone)").forEach((el) => {
      el.addEventListener("blur", saveFieldsFromDOM);
    });

    setupImageDropZones();
  }

  function thumbEsc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function thumbTrunc(s, n) {
    s = String(s || "").split("\n")[0].trim();
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  function renderSlideThumbnailHTML(slide) {
    const c = slide.content;
    const t = slide.template;
    const title = (text, max = 40) => `<div class="thumb-title">${thumbEsc(thumbTrunc(text, max))}</div>`;
    const body = (text, max = 80) => `<div class="thumb-body">${thumbEsc(thumbTrunc(text, max))}</div>`;
    const imgCover = (src) => src ? `<img class="thumb-image-cover" src="${src}" alt="">` : `<div class="thumb-center" style="opacity:.35;font-size:9px">🖼</div>`;
    const imgFit = (src) => src ? `<img class="thumb-image-fit" src="${src}" alt="">` : `<div style="opacity:.35;font-size:9px;text-align:center">🖼</div>`;

    switch (t) {
      case "title":
        return `<div class="thumb-center">${title(c.title, 40)}${body(c.subtitle, 60)}</div>`;
      case "title-body":
        return `${title(c.title)}${body(c.body)}`;
      case "two-column":
        return `${title(c.title)}<div class="thumb-body">${thumbEsc(thumbTrunc(c.left, 40))} · ${thumbEsc(thumbTrunc(c.right, 40))}</div>`;
      case "bullets":
        return `${title(c.title)}${body(c.bullets)}`;
      case "section":
        return `<div class="thumb-center"><div class="thumb-title" style="font-size:10px">${thumbEsc(thumbTrunc(c.heading, 40))}</div></div>`;
      case "quote":
        return `<div class="thumb-center"><div class="thumb-body" style="font-style:italic">${thumbEsc(thumbTrunc(c.quote, 80))}</div></div>`;
      case "blank":
        return `<div class="thumb-center">${body(c.content)}</div>`;
      case "title-image":
        return `${title(c.title)}${imgFit(c.image)}`;
      case "full-image":
        return imgCover(c.image);
      case "image-caption":
        return `${imgFit(c.image)}${body(c.caption, 50)}`;
      default:
        return "";
    }
  }

  function renderSlideList() {
    const list = document.getElementById("slideList");
    list.innerHTML = "";
    currentSlides().forEach((slide, i) => {
      const li = document.createElement("li");
      if (i === state.currentSlide) li.classList.add("active");

      const thumb = document.createElement("div");
      thumb.className = "slide-thumb";
      thumb.style.background = slide.bgColor || "#1a1a2e";
      thumb.style.color = slide.textColor || "#ffffff";
      thumb.style.fontFamily = slide.font || "system-ui";
      thumb.innerHTML = renderSlideThumbnailHTML(slide);

      const meta = document.createElement("div");
      meta.className = "slide-thumb-meta";
      meta.innerHTML = `<span class="slide-num">${i + 1}</span><span class="thumb-name">${TEMPLATES[slide.template]?.name || slide.template}</span>`;

      li.appendChild(thumb);
      li.appendChild(meta);
      li.addEventListener("click", () => goToSlide(i));
      list.appendChild(li);
    });
  }

  function renderControls() {
    const slide = currentSlide();
    if (!slide) return;

    document.getElementById("templateSelect").value = slide.template;
    document.getElementById("slideFontSelect").value = slide.font;
    document.getElementById("textColorInput").value = slide.textColor;
    document.getElementById("textColorHex").textContent = slide.textColor;
    document.getElementById("bgColorInput").value = slide.bgColor;
    document.getElementById("bgColorHex").textContent = slide.bgColor;
    document.getElementById("slideCounter").textContent = `${state.currentSlide + 1} / ${currentSlides().length}`;
  }

  function teamFilteredProjectIndices() {
    const teamId = window.datascope?.activeTeamId || null;
    const indices = [];
    state.projects.forEach((proj, i) => {
      if ((proj.teamId || null) === teamId) indices.push(i);
    });
    return indices;
  }

  function renderProjectSelect() {
    const sel = document.getElementById("projectSelect");
    sel.innerHTML = "";
    const indices = teamFilteredProjectIndices();
    indices.forEach(i => {
      const proj = state.projects[i];
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = proj.name;
      if (i === state.currentProject) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderDeckLibrary() {
    const container = document.getElementById("deckLibrary");
    const empty = document.getElementById("deckLibraryEmpty");
    if (!container) return;
    container.innerHTML = "";

    const indices = teamFilteredProjectIndices();
    if (!indices.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    indices.forEach(idx => {
      const proj = state.projects[idx];
      const firstSlide = proj.slides && proj.slides[0];
      if (!firstSlide) return;

      const tile = document.createElement("div");
      tile.className = "deck-tile";

      const preview = document.createElement("div");
      preview.className = "deck-tile-preview";
      preview.style.background = firstSlide.bgColor || "#1a1a2e";
      preview.style.color = firstSlide.textColor || "#ffffff";
      preview.style.fontFamily = firstSlide.font || "system-ui";
      preview.innerHTML = renderSlideThumbnailHTML(firstSlide);

      const footer = document.createElement("div");
      footer.className = "deck-tile-footer";

      const nameEl = document.createElement("div");
      nameEl.className = "deck-tile-name";
      nameEl.textContent = proj.name.length > 28 ? proj.name.slice(0, 28) + "…" : proj.name;

      const countEl = document.createElement("div");
      countEl.className = "deck-tile-count";
      const n = proj.slides.length;
      countEl.textContent = `${n} slide${n !== 1 ? "s" : ""}`;

      footer.appendChild(nameEl);
      footer.appendChild(countEl);

      const actions = document.createElement("div");
      actions.className = "deck-tile-actions";

      const loadBtn = document.createElement("button");
      loadBtn.className = "btn btn-ghost btn-sm";
      loadBtn.textContent = "Load";
      loadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        switchProject(idx);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-ghost btn-sm danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.projects.length <= 1) {
          alert("You need at least one deck.");
          return;
        }
        if (!confirm(`Delete deck "${proj.name}"?`)) return;
        state.projects.splice(idx, 1);
        if (state.currentProject >= state.projects.length) {
          state.currentProject = state.projects.length - 1;
        }
        state.currentSlide = 0;
        saveState();
        renderAll();
      });

      actions.appendChild(loadBtn);
      actions.appendChild(deleteBtn);

      tile.appendChild(preview);
      tile.appendChild(footer);
      tile.appendChild(actions);

      tile.addEventListener("click", () => switchProject(idx));
      container.appendChild(tile);
    });
  }

  function renderAll() {
    renderProjectSelect();
    renderSlideList();
    renderSlidePreview();
    renderControls();
    renderDeckProjectSelect();
    renderDeckLibrary();
  }

  // ---------- Project operations ----------
  function switchProject(index) {
    saveFieldsFromDOM();
    state.currentProject = index;
    state.currentSlide = 0;
    saveState();
    renderAll();
  }

  function newProject() {
    saveFieldsFromDOM();
    const name = prompt("Project name:", "New Deck");
    if (!name) return;
    state.projects.push({
      id: uid(),
      teamId: window.datascope?.activeTeamId || null,
      name,
      slides: [makeSlide("title")],
    });
    state.currentProject = state.projects.length - 1;
    state.currentSlide = 0;
    saveState();
    renderAll();
  }

  function deleteProject() {
    if (state.projects.length <= 1) {
      alert("You need at least one project.");
      return;
    }
    if (!confirm(`Delete project "${currentProject().name}"?`)) return;
    state.projects.splice(state.currentProject, 1);
    state.currentProject = Math.min(state.currentProject, state.projects.length - 1);
    state.currentSlide = 0;
    saveState();
    renderAll();
  }

  function renameProject() {
    const proj = currentProject();
    const name = prompt("Rename project:", proj.name);
    if (!name) return;
    proj.name = name;
    saveState();
    renderProjectSelect();
  }

  // ---------- Navigation ----------
  function goToSlide(index) {
    saveFieldsFromDOM();
    state.currentSlide = Math.max(0, Math.min(index, currentSlides().length - 1));
    saveState();
    renderSlideList();
    renderSlidePreview();
    renderControls();
  }

  function prevSlide() {
    if (state.currentSlide > 0) goToSlide(state.currentSlide - 1);
  }

  function nextSlide() {
    if (state.currentSlide < currentSlides().length - 1) goToSlide(state.currentSlide + 1);
  }

  // ---------- Slide operations ----------
  function addSlide() {
    saveFieldsFromDOM();
    const newSlide = makeSlide("title-body");
    const cur = currentSlide();
    if (cur) {
      newSlide.font = cur.font;
      newSlide.textColor = cur.textColor;
      newSlide.bgColor = cur.bgColor;
    }
    currentSlides().splice(state.currentSlide + 1, 0, newSlide);
    state.currentSlide += 1;
    saveState();
    renderAll();
  }

  function duplicateSlide() {
    saveFieldsFromDOM();
    const cur = currentSlide();
    if (!cur) return;
    const clone = JSON.parse(JSON.stringify(cur));
    currentSlides().splice(state.currentSlide + 1, 0, clone);
    state.currentSlide += 1;
    saveState();
    renderAll();
  }

  function deleteSlide() {
    if (currentSlides().length <= 1) return;
    currentSlides().splice(state.currentSlide, 1);
    if (state.currentSlide >= currentSlides().length) state.currentSlide = currentSlides().length - 1;
    saveState();
    renderAll();
  }

  // ---------- Template change ----------
  function changeTemplate(newTemplate) {
    saveFieldsFromDOM();
    const slide = currentSlide();
    if (!slide) return;
    const oldContent = slide.content;
    const newFields = { ...TEMPLATES[newTemplate].fields };

    for (const key of Object.keys(newFields)) {
      if (oldContent[key] !== undefined) newFields[key] = oldContent[key];
    }
    if (newFields.heading !== undefined && oldContent.title !== undefined && oldContent.heading === undefined) {
      newFields.heading = oldContent.title;
    }
    if (newFields.title !== undefined && oldContent.heading !== undefined && oldContent.title === undefined) {
      newFields.title = oldContent.heading;
    }

    slide.template = newTemplate;
    slide.content = newFields;
    saveState();
    renderSlidePreview();
  }

  // ---------- Style changes ----------
  function onFontChange(font) {
    const slide = currentSlide();
    if (!slide) return;
    saveFieldsFromDOM();
    slide.font = font;
    saveState();
    renderSlidePreview();
  }

  function onTextColorChange(color) {
    const slide = currentSlide();
    if (!slide) return;
    slide.textColor = color;
    document.getElementById("slidePreview").style.color = color;
    document.getElementById("textColorHex").textContent = color;
    saveState();
  }

  function onBgColorChange(color) {
    const slide = currentSlide();
    if (!slide) return;
    slide.bgColor = color;
    document.getElementById("slidePreview").style.background = color;
    document.getElementById("bgColorHex").textContent = color;
    saveState();
  }

  // ---------- Chart import ----------
  function checkChartImport() {
    try {
      const raw = localStorage.getItem(CHART_IMPORT_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      localStorage.removeItem(CHART_IMPORT_KEY);
      if (!data.image) return;

      const slide = makeSlide("title-image");
      slide.content.title = data.title || "Chart";
      slide.content.image = data.image;

      const cur = currentSlide();
      if (cur) {
        slide.font = cur.font;
        slide.textColor = cur.textColor;
        slide.bgColor = cur.bgColor;
      }

      currentSlides().push(slide);
      state.currentSlide = currentSlides().length - 1;
      saveState();
      renderAll();
    } catch (_) {}
  }

  // ---------- Export ----------
  function exportSlidePng() {
    saveFieldsFromDOM();
    const el = document.getElementById("slideFrame");
    if (typeof html2canvas === "undefined") {
      alert("html2canvas is still loading — try again in a moment.");
      return;
    }
    html2canvas(el, {
      backgroundColor: currentSlide()?.bgColor || "#1a1a2e",
      scale: 2,
      useCORS: true,
    }).then((canvas) => {
      const url = canvas.toDataURL("image/png");
      triggerDownload(url, `slide-${state.currentSlide + 1}.png`);
    });
  }

  function exportAllPng() {
    saveFieldsFromDOM();
    if (typeof html2canvas === "undefined") {
      alert("html2canvas is still loading — try again in a moment.");
      return;
    }
    const original = state.currentSlide;
    let i = 0;

    function next() {
      if (i >= currentSlides().length) {
        goToSlide(original);
        return;
      }
      state.currentSlide = i;
      renderSlidePreview();
      renderControls();
      const el = document.getElementById("slideFrame");
      html2canvas(el, {
        backgroundColor: currentSlides()[i]?.bgColor || "#1a1a2e",
        scale: 2,
        useCORS: true,
      }).then((canvas) => {
        const url = canvas.toDataURL("image/png");
        triggerDownload(url, `slide-${i + 1}.png`);
        i++;
        setTimeout(next, 300);
      });
    }

    next();
  }

  function exportHtml() {
    saveFieldsFromDOM();
    const slides = currentSlides();
    const slidesData = JSON.stringify(slides);
    const templatesSource = `const TEMPLATES=${JSON.stringify(TEMPLATES)};`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${currentProject().name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;font-family:system-ui,sans-serif}
.slide{width:100vw;height:100vh;display:none;position:relative}
.slide.active{display:flex}
.slide-content{width:100%;height:100%;display:flex;padding:8% 10%;position:absolute;inset:0}
.layout-title{flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:16px}
.layout-title .field-title{font-size:clamp(28px,4vw,52px);font-weight:700;line-height:1.15}
.layout-title .field-subtitle{font-size:clamp(14px,2vw,22px);opacity:.7;line-height:1.4}
.layout-title-body{flex-direction:column;gap:24px}
.layout-title-body .field-title{font-size:clamp(22px,3vw,38px);font-weight:700;line-height:1.2}
.layout-title-body .field-body{font-size:clamp(14px,1.8vw,20px);line-height:1.6;opacity:.85;white-space:pre-wrap}
.layout-two-column{flex-direction:column;gap:24px}
.layout-two-column .field-title{font-size:clamp(22px,3vw,38px);font-weight:700;text-align:center}
.layout-two-column .columns{display:grid;grid-template-columns:1fr 1fr;gap:6%;flex:1}
.layout-two-column .field-left,.layout-two-column .field-right{font-size:clamp(13px,1.6vw,18px);line-height:1.6;opacity:.85;white-space:pre-wrap}
.layout-bullets{flex-direction:column;gap:24px}
.layout-bullets .field-title{font-size:clamp(22px,3vw,38px);font-weight:700}
.layout-bullets .field-bullets{font-size:clamp(14px,1.8vw,20px);line-height:1.8;opacity:.85;white-space:pre-wrap}
.layout-section{flex-direction:column;justify-content:center;align-items:center;text-align:center}
.layout-section .field-heading{font-size:clamp(32px,5vw,60px);font-weight:700;line-height:1.1}
.layout-quote{flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:20px}
.layout-quote .field-quote{font-size:clamp(18px,2.5vw,32px);font-style:italic;line-height:1.5;max-width:80%}
.layout-quote .field-attribution{font-size:clamp(12px,1.4vw,18px);opacity:.6}
.layout-blank{flex-direction:column;justify-content:center;align-items:center;text-align:center}
.layout-blank .field-content{font-size:clamp(16px,2vw,24px);line-height:1.5}
.layout-title-image{flex-direction:column;gap:20px}
.layout-title-image .field-title{font-size:clamp(22px,3vw,38px);font-weight:700;line-height:1.2}
.layout-full-image{flex-direction:column;justify-content:center;align-items:center;padding:0}
.layout-image-caption{flex-direction:column;gap:12px}
.layout-image-caption .field-caption{font-size:clamp(13px,1.6vw,18px);opacity:.8;text-align:center}
.image-drop-zone{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;min-height:60%}
.image-drop-zone img{max-width:100%;max-height:100%;object-fit:contain}
.layout-full-image .image-drop-zone{width:100%;height:100%;min-height:auto}
.nav{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:10}
.nav button{padding:8px 16px;border:none;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;font-size:14px;backdrop-filter:blur(4px)}
.nav button:hover{background:rgba(0,0,0,.7)}
.counter{position:fixed;bottom:24px;left:20px;color:rgba(255,255,255,.5);font-size:13px}
</style>
</head>
<body>
<div id="deck"></div>
<div class="nav"><button onclick="go(-1)">\u2190 Prev</button><button onclick="go(1)">Next \u2192</button></div>
<div class="counter" id="counter"></div>
<script>
${templatesSource}
const slides=${slidesData};
let cur=0;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')}
function imgZone(d){return d?'<div class="image-drop-zone"><img src="'+d+'" alt=""/></div>':'<div class="image-drop-zone"></div>'}
function renderSlide(s){
  const t=s.template,c=s.content;
  switch(t){
    case'title':return '<div class="slide-content layout-title"><div class="field-title">'+esc(c.title)+'</div><div class="field-subtitle">'+esc(c.subtitle)+'</div></div>';
    case'title-body':return '<div class="slide-content layout-title-body"><div class="field-title">'+esc(c.title)+'</div><div class="field-body">'+esc(c.body)+'</div></div>';
    case'two-column':return '<div class="slide-content layout-two-column"><div class="field-title">'+esc(c.title)+'</div><div class="columns"><div class="field-left">'+esc(c.left)+'</div><div class="field-right">'+esc(c.right)+'</div></div></div>';
    case'bullets':return '<div class="slide-content layout-bullets"><div class="field-title">'+esc(c.title)+'</div><div class="field-bullets">'+esc(c.bullets)+'</div></div>';
    case'section':return '<div class="slide-content layout-section"><div class="field-heading">'+esc(c.heading)+'</div></div>';
    case'quote':return '<div class="slide-content layout-quote"><div class="field-quote">'+esc(c.quote)+'</div><div class="field-attribution">'+esc(c.attribution)+'</div></div>';
    case'blank':return '<div class="slide-content layout-blank"><div class="field-content">'+esc(c.content)+'</div></div>';
    case'title-image':return '<div class="slide-content layout-title-image"><div class="field-title">'+esc(c.title)+'</div>'+imgZone(c.image)+'</div>';
    case'full-image':return '<div class="slide-content layout-full-image">'+imgZone(c.image)+'</div>';
    case'image-caption':return '<div class="slide-content layout-image-caption">'+imgZone(c.image)+'<div class="field-caption">'+esc(c.caption)+'</div></div>';
    default:return '';
  }
}
function render(){
  const deck=document.getElementById('deck');
  deck.innerHTML=slides.map((s,i)=>{
    return '<div class="slide'+(i===cur?' active':'')+'" style="font-family:'+s.font+';color:'+s.textColor+';background:'+s.bgColor+'">'+renderSlide(s)+'</div>';
  }).join('');
  document.getElementById('counter').textContent=(cur+1)+' / '+slides.length;
}
function go(d){cur=Math.max(0,Math.min(cur+d,slides.length-1));render()}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')go(1);if(e.key==='ArrowLeft')go(-1)});
render();
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `${currentProject().name.replace(/[^a-z0-9]+/gi, "-")}.html`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handlePrint() {
    saveFieldsFromDOM();
    let container = document.getElementById("printContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "printContainer";
      document.body.appendChild(container);
    }
    container.innerHTML = currentSlides()
      .map((slide) => {
        const html = renderSlideHTML(slide.template, slide.content)
          .replace(/contenteditable="true"/g, "")
          .replace(/spellcheck="false"/g, "");
        return `<div class="print-slide" style="font-family:${slide.font};color:${slide.textColor};background:${slide.bgColor}">${html}</div>`;
      })
      .join("");
    window.print();
  }

  function triggerDownload(href, filename) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- Populate template dropdown ----------
  function populateTemplateSelect() {
    const sel = document.getElementById("templateSelect");
    sel.innerHTML = "";
    for (const [key, tpl] of Object.entries(TEMPLATES)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = tpl.name;
      sel.appendChild(opt);
    }
  }

  // ---------- Deck-level project linking ----------
  function loadGlobalProjects() {
    try {
      const raw = localStorage.getItem(GLOBAL_PROJECTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  function renderDeckProjectSelect() {
    const sel = document.getElementById("deckProjectSelect");
    sel.innerHTML = '<option value="">None</option>';
    const proj = currentProject();
    loadGlobalProjects().forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (proj && proj.projectId === p.id) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function onDeckProjectChange(value) {
    const proj = currentProject();
    if (!proj) return;
    proj.projectId = value || "";
    saveState();
  }

  // ---------- Generate deck (AI) ----------
  function openGenModal() {
    document.getElementById("genDocText").value = "";
    document.getElementById("genFileName").textContent = "No file chosen";
    document.getElementById("genFileInput").value = "";
    document.getElementById("genGoBtn").disabled = false;
    document.getElementById("genGoBtn").textContent = "Generate deck";
    const status = document.getElementById("genStatus");
    status.hidden = true;
    status.className = "gen-status";
    document.getElementById("genOverlay").hidden = false;
    document.getElementById("genDocText").focus();
  }

  function closeGenModal() {
    document.getElementById("genOverlay").hidden = true;
  }

  function setGenStatus(type, message) {
    const el = document.getElementById("genStatus");
    el.hidden = false;
    el.className = `gen-status ${type}`;
    el.innerHTML = type === "loading"
      ? `<span class="gen-spinner"></span>${message}`
      : message;
  }

  async function handleGenerateDeck() {
    const apiKey = localStorage.getItem(API_KEY_STORE) || "";
    if (!apiKey) { setGenStatus("error", "No API key found. Add one via the ⚙️ button in the assistant panel."); return; }

    const docText = document.getElementById("genDocText").value.trim();
    if (!docText) { setGenStatus("error", "Please paste or upload a document."); return; }

    const btn = document.getElementById("genGoBtn");
    btn.disabled = true;
    btn.textContent = "Generating…";
    setGenStatus("loading", "Creating your slide deck…");

    try {
      const slides = await callSlidesAPI(apiKey, docText);

      const deckName = slides[0]?.content?.title || "Generated Deck";
      const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      const deckSlides = slides.map((s) => {
        const template = TEMPLATES[s.template] ? s.template : "title-body";
        const defaults = { ...TEMPLATES[template].fields };
        const content = {};
        for (const key of Object.keys(defaults)) {
          content[key] = (s.content && s.content[key] != null) ? String(s.content[key]) : defaults[key];
        }
        return {
          template,
          content,
          font,
          textColor: "#ffffff",
          bgColor: "#1a1a2e",
        };
      });

      saveFieldsFromDOM();
      state.projects.push({ id: uid(), name: deckName, slides: deckSlides });
      state.currentProject = state.projects.length - 1;
      state.currentSlide = 0;
      saveState();
      renderAll();

      setGenStatus("success", `Created "${deckName}" with ${deckSlides.length} slides.`);
      setTimeout(closeGenModal, 1500);
    } catch (err) {
      setGenStatus("error", err.message);
      btn.disabled = false;
      btn.textContent = "Generate deck";
    }
  }

  async function callSlidesAPI(apiKey, documentText) {
    const validTemplates = Object.keys(TEMPLATES).filter((t) => !t.includes("image"));
    const systemPrompt = `You are a presentation designer. Create a slide deck from the provided document.

Return ONLY a JSON array of slide objects. Each slide must have:
- "template": one of ${JSON.stringify(validTemplates)}
- "content": an object with the fields required by that template:
  - "title": { "title": "...", "subtitle": "..." }
  - "title-body": { "title": "...", "body": "..." }
  - "bullets": { "title": "...", "bullets": "• Point 1\\n• Point 2\\n• Point 3" }
  - "section": { "heading": "..." }
  - "quote": { "quote": "...", "attribution": "— Author" }
  - "two-column": { "title": "...", "left": "...", "right": "..." }
  - "blank": { "content": "..." }

Guidelines:
- Start with a "title" slide that captures the document's main theme
- Use "section" slides to separate major topics
- Use "bullets" for key points and lists
- Use "title-body" for detailed explanations (keep body text concise)
- Use "two-column" for comparisons, pros/cons, or side-by-side info
- Use "quote" for notable quotes from the document
- Keep all text concise — slides should be scannable, not paragraphs
- Aim for 6-15 slides depending on document length
- End with a summary, conclusion, or next-steps slide
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
        messages: [{ role: "user", content: `Create a slide deck from this document:\n\n${documentText}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API request failed (${response.status})`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Could not parse slides from the API response.");

    const slides = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(slides) || !slides.length) throw new Error("No slides were generated.");
    return slides;
  }

  // ---------- Keyboard nav ----------
  function onKeyDown(e) {
    if (e.key === "Escape") { closeGenModal(); return; }
    if (e.target.closest("[contenteditable]")) return;
    if (e.key === "ArrowLeft") prevSlide();
    if (e.key === "ArrowRight") nextSlide();
  }

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();
    populateTemplateSelect();

    checkChartImport();

    renderAll();

    // Project controls
    document.getElementById("projectSelect").addEventListener("change", (e) => switchProject(Number(e.target.value)));
    document.getElementById("newProjectBtn").addEventListener("click", newProject);
    document.getElementById("deleteProjectBtn").addEventListener("click", deleteProject);
    document.getElementById("projectSelect").addEventListener("dblclick", renameProject);
    document.getElementById("deckProjectSelect").addEventListener("change", (e) => onDeckProjectChange(e.target.value));

    // Navigation
    document.getElementById("prevSlideBtn").addEventListener("click", prevSlide);
    document.getElementById("nextSlideBtn").addEventListener("click", nextSlide);
    document.addEventListener("keydown", onKeyDown);

    // Slide operations
    document.getElementById("addSlideBtn").addEventListener("click", addSlide);
    document.getElementById("duplicateSlideBtn").addEventListener("click", duplicateSlide);
    document.getElementById("deleteSlideBtn").addEventListener("click", deleteSlide);

    // Template
    document
      .getElementById("templateSelect")
      .addEventListener("change", (e) => changeTemplate(e.target.value));

    // Style
    document
      .getElementById("slideFontSelect")
      .addEventListener("change", (e) => onFontChange(e.target.value));
    document
      .getElementById("textColorInput")
      .addEventListener("input", (e) => onTextColorChange(e.target.value));
    document
      .getElementById("bgColorInput")
      .addEventListener("input", (e) => onBgColorChange(e.target.value));

    // Generate deck
    document.getElementById("generateDeckBtn").addEventListener("click", openGenModal);
    document.getElementById("genCloseBtn").addEventListener("click", closeGenModal);
    document.getElementById("genCancelBtn").addEventListener("click", closeGenModal);
    document.getElementById("genGoBtn").addEventListener("click", handleGenerateDeck);
    document.getElementById("genOverlay").addEventListener("click", (e) => {
      if (e.target === document.getElementById("genOverlay")) closeGenModal();
    });
    document.getElementById("genFileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById("genFileName").textContent = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById("genDocText").value = ev.target.result;
      };
      reader.readAsText(file);
    });

    // Export
    document.getElementById("exportPngSlideBtn").addEventListener("click", exportSlidePng);
    document.getElementById("exportAllPngBtn").addEventListener("click", exportAllPng);
    document.getElementById("exportHtmlBtn").addEventListener("click", exportHtml);
    document.getElementById("printBtn").addEventListener("click", handlePrint);

    document.addEventListener("datascope:teamchange", () => {
      const indices = teamFilteredProjectIndices();
      if (indices.length) {
        state.currentProject = indices[0];
      } else {
        const teamId = window.datascope?.activeTeamId || null;
        state.projects.push({
          id: uid(), teamId, name: teamId ? "Team Deck" : "My Deck",
          slides: [makeSlide("title")],
        });
        state.currentProject = state.projects.length - 1;
      }
      state.currentSlide = 0;
      saveState();
      renderAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
