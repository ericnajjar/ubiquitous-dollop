// DataScope Slides — template-based slide deck builder.
(() => {
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
  };

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

      default:
        return "";
    }
  }

  // ---------- State ----------
  const state = {
    slides: [
      {
        template: "title",
        content: { title: "My Presentation", subtitle: "Created with DataScope Slides" },
        font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        textColor: "#ffffff",
        bgColor: "#1a1a2e",
      },
    ],
    current: 0,
  };

  function currentSlide() {
    return state.slides[state.current];
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
      // Convert <br> back to newlines, strip other HTML.
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

    // Attach blur listeners to save edits.
    preview.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("blur", saveFieldsFromDOM);
    });
  }

  function renderSlideList() {
    const list = document.getElementById("slideList");
    list.innerHTML = "";
    state.slides.forEach((slide, i) => {
      const li = document.createElement("li");
      if (i === state.current) li.classList.add("active");
      li.innerHTML = `<span class="slide-num">${i + 1}</span> ${TEMPLATES[slide.template]?.name || slide.template}`;
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
    document.getElementById("slideCounter").textContent = `${state.current + 1} / ${state.slides.length}`;
  }

  function renderAll() {
    renderSlideList();
    renderSlidePreview();
    renderControls();
  }

  // ---------- Navigation ----------
  function goToSlide(index) {
    saveFieldsFromDOM();
    state.current = Math.max(0, Math.min(index, state.slides.length - 1));
    renderAll();
  }

  function prevSlide() {
    if (state.current > 0) goToSlide(state.current - 1);
  }

  function nextSlide() {
    if (state.current < state.slides.length - 1) goToSlide(state.current + 1);
  }

  // ---------- Slide operations ----------
  function addSlide() {
    saveFieldsFromDOM();
    const newSlide = makeSlide("title-body");
    // Inherit font/colors from the current slide.
    const cur = currentSlide();
    if (cur) {
      newSlide.font = cur.font;
      newSlide.textColor = cur.textColor;
      newSlide.bgColor = cur.bgColor;
    }
    state.slides.splice(state.current + 1, 0, newSlide);
    state.current += 1;
    renderAll();
  }

  function duplicateSlide() {
    saveFieldsFromDOM();
    const cur = currentSlide();
    if (!cur) return;
    const clone = JSON.parse(JSON.stringify(cur));
    state.slides.splice(state.current + 1, 0, clone);
    state.current += 1;
    renderAll();
  }

  function deleteSlide() {
    if (state.slides.length <= 1) return;
    state.slides.splice(state.current, 1);
    if (state.current >= state.slides.length) state.current = state.slides.length - 1;
    renderAll();
  }

  // ---------- Template change ----------
  function changeTemplate(newTemplate) {
    saveFieldsFromDOM();
    const slide = currentSlide();
    if (!slide) return;
    const oldContent = slide.content;
    const newFields = { ...TEMPLATES[newTemplate].fields };

    // Carry over any matching field names.
    for (const key of Object.keys(newFields)) {
      if (oldContent[key] !== undefined) newFields[key] = oldContent[key];
    }
    // Also try to map title↔heading.
    if (newFields.heading !== undefined && oldContent.title !== undefined && oldContent.heading === undefined) {
      newFields.heading = oldContent.title;
    }
    if (newFields.title !== undefined && oldContent.heading !== undefined && oldContent.title === undefined) {
      newFields.title = oldContent.heading;
    }

    slide.template = newTemplate;
    slide.content = newFields;
    renderSlidePreview();
  }

  // ---------- Style changes ----------
  function onFontChange(font) {
    const slide = currentSlide();
    if (!slide) return;
    saveFieldsFromDOM();
    slide.font = font;
    renderSlidePreview();
  }

  function onTextColorChange(color) {
    const slide = currentSlide();
    if (!slide) return;
    slide.textColor = color;
    document.getElementById("slidePreview").style.color = color;
    document.getElementById("textColorHex").textContent = color;
  }

  function onBgColorChange(color) {
    const slide = currentSlide();
    if (!slide) return;
    slide.bgColor = color;
    document.getElementById("slidePreview").style.background = color;
    document.getElementById("bgColorHex").textContent = color;
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
      triggerDownload(url, `slide-${state.current + 1}.png`);
    });
  }

  function exportAllPng() {
    saveFieldsFromDOM();
    if (typeof html2canvas === "undefined") {
      alert("html2canvas is still loading — try again in a moment.");
      return;
    }
    const original = state.current;
    let i = 0;

    function next() {
      if (i >= state.slides.length) {
        goToSlide(original);
        return;
      }
      state.current = i;
      renderSlidePreview();
      renderControls();
      const el = document.getElementById("slideFrame");
      html2canvas(el, {
        backgroundColor: state.slides[i]?.bgColor || "#1a1a2e",
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
    const slidesData = JSON.stringify(state.slides);
    const templatesSource = `const TEMPLATES=${JSON.stringify(TEMPLATES)};`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Slide Deck</title>
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
.nav{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:10}
.nav button{padding:8px 16px;border:none;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;font-size:14px;backdrop-filter:blur(4px)}
.nav button:hover{background:rgba(0,0,0,.7)}
.counter{position:fixed;bottom:24px;left:20px;color:rgba(255,255,255,.5);font-size:13px}
</style>
</head>
<body>
<div id="deck"></div>
<div class="nav"><button onclick="go(-1)">← Prev</button><button onclick="go(1)">Next →</button></div>
<div class="counter" id="counter"></div>
<script>
${templatesSource}
const slides=${slidesData};
let cur=0;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')}
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
    triggerDownload(url, "slide-deck.html");
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
    container.innerHTML = state.slides
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

  // ---------- Keyboard nav ----------
  function onKeyDown(e) {
    // Don't intercept when editing text.
    if (e.target.closest("[contenteditable]")) return;
    if (e.key === "ArrowLeft") prevSlide();
    if (e.key === "ArrowRight") nextSlide();
  }

  // ---------- Init ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();
    populateTemplateSelect();
    renderAll();

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

    // Export
    document.getElementById("exportPngSlideBtn").addEventListener("click", exportSlidePng);
    document.getElementById("exportAllPngBtn").addEventListener("click", exportAllPng);
    document.getElementById("exportHtmlBtn").addEventListener("click", exportHtml);
    document.getElementById("printBtn").addEventListener("click", handlePrint);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
