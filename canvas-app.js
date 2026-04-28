// DataScope Canvas — interactive journey mapping / diagramming tool.
(() => {
  const STORE_KEY = "datascope_canvas";
  const MIN_SHAPE_SIZE = 20;

  // ---------- State ----------
  const SHAPE_ICONS = {
    rect: '<rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>',
    circle: '<circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/>',
    diamond: '<path d="M10 2 L18 10 L10 18 L2 10 Z" stroke="currentColor" stroke-width="1.5" fill="none"/>',
  };

  const state = {
    shapes: [],
    arrows: [],
    tool: "select",
    currentShape: "rect",
    fillColor: "#1d254a",
    strokeColor: "#6ea8ff",
    textColor: "#e7ecff",
    strokeWidth: 1.5,
    textAlign: "center",
    selected: new Set(),
    selectedArrows: new Set(),
    pan: { x: 0, y: 0 },
    zoom: 1,
  };

  let canvases = [];
  let currentId = null;

  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let creating = null;
  let arrowStart = null;
  let panning = false;
  let panLast = { x: 0, y: 0 };
  let snapGuides = [];
  let marquee = null;
  let dragShapeStarts = {};
  let resizing = null;
  let arrowEndpointDrag = null; // { arrowId, endpoint: "from"|"to", x, y }
  let arrowBodyDrag = null; // { arrowId, startX, startY, origX1, origY1, origX2, origY2 }
  let clipboard = null; // { shapes: [], arrows: [] }
  const SNAP_THRESHOLD = 8;
  const HANDLE_SIZE = 8;
  const ARROW_HIT_DIST = 8;

  let canvas, ctx;

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  // ---------- Persistence ----------
  function syncFromState() {
    const c = canvases.find(cv => cv.id === currentId);
    if (c) { c.shapes = state.shapes; c.arrows = state.arrows; c.pan = state.pan; c.zoom = state.zoom; }
  }

  function syncToState(id) {
    const c = canvases.find(cv => cv.id === id);
    if (c) {
      state.shapes = c.shapes || [];
      state.arrows = c.arrows || [];
      state.pan = c.pan || { x: 0, y: 0 };
      state.zoom = c.zoom || 1;
      state.selected = new Set();
      currentId = id;
    }
  }

  function save() {
    syncFromState();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(canvases)); } catch (_) {}
  }

  function ensureCanvasForContext() {
    const filtered = teamFilteredCanvases();
    if (filtered.length) {
      syncToState(filtered[0].id);
    } else {
      const teamId = window.datascope?.activeTeamId || null;
      const id = uid();
      canvases.push({ id, teamId, name: "Untitled", shapes: [], arrows: [], pan: { x: 0, y: 0 }, zoom: 1 });
      syncToState(id);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) {
        const teamId = window.datascope?.activeTeamId || null;
        const id = uid();
        canvases = [{ id, teamId, name: "Untitled", shapes: [], arrows: [], pan: { x: 0, y: 0 }, zoom: 1 }];
        currentId = id;
        return;
      }
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        canvases = data;
      } else if (data && typeof data === "object") {
        const id = uid();
        canvases = [{ id, teamId: null, name: "Untitled", shapes: data.shapes || [], arrows: data.arrows || [], pan: data.pan || { x: 0, y: 0 }, zoom: data.zoom || 1 }];
      }
      if (!canvases.length) {
        const id = uid();
        canvases = [{ id, teamId: null, name: "Untitled", shapes: [], arrows: [], pan: { x: 0, y: 0 }, zoom: 1 }];
      }
      ensureCanvasForContext();
    } catch (_) {
      const id = uid();
      canvases = [{ id, teamId: null, name: "Untitled", shapes: [], arrows: [], pan: { x: 0, y: 0 }, zoom: 1 }];
      currentId = id;
    }
  }

  // ---------- Canvas management ----------
  function createCanvas(name) {
    syncFromState();
    const id = uid();
    canvases.push({ id, teamId: window.datascope?.activeTeamId || null, name: name || "Untitled", shapes: [], arrows: [], pan: { x: 0, y: 0 }, zoom: 1 });
    syncToState(id);
    updateZoomLabel();
    save();
    draw();
    buildCanvasBar();
  }

  function switchCanvas(id) {
    if (id === currentId) return;
    syncFromState();
    syncToState(id);
    updateZoomLabel();
    save();
    draw();
    buildCanvasBar();
  }

  function deleteCanvas(id) {
    if (canvases.length <= 1) return;
    const idx = canvases.findIndex(cv => cv.id === id);
    canvases.splice(idx, 1);
    if (currentId === id) {
      syncToState(canvases[Math.min(idx, canvases.length - 1)].id);
      updateZoomLabel();
      draw();
    }
    save();
    buildCanvasBar();
  }

  function renameCanvas(id, name) {
    const c = canvases.find(cv => cv.id === id);
    if (c) { c.name = name || "Untitled"; save(); buildCanvasBar(); }
  }

  function teamFilteredCanvases() {
    const teamId = window.datascope?.activeTeamId || null;
    return canvases.filter(c => (c.teamId || null) === teamId);
  }

  function buildCanvasBar() {
    const bar = document.getElementById("canvasBar");
    if (!bar) return;
    bar.innerHTML = "";
    teamFilteredCanvases().forEach(c => {
      const tab = document.createElement("button");
      tab.className = "canvas-tab" + (c.id === currentId ? " active" : "");
      tab.type = "button";
      const nameSpan = document.createElement("span");
      nameSpan.className = "canvas-tab-name";
      nameSpan.textContent = c.name;
      tab.appendChild(nameSpan);
      if (teamFilteredCanvases().length > 1) {
        const del = document.createElement("span");
        del.className = "canvas-tab-del";
        del.textContent = "×";
        del.title = "Delete canvas";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          if (confirm('Delete "' + c.name + '"?')) deleteCanvas(c.id);
        });
        tab.appendChild(del);
      }
      tab.addEventListener("click", () => switchCanvas(c.id));
      tab.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const input = document.createElement("input");
        input.className = "canvas-tab-rename";
        input.value = c.name;
        input.type = "text";
        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        const finish = () => {
          renameCanvas(c.id, input.value.trim() || "Untitled");
        };
        input.addEventListener("blur", finish);
        input.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter") input.blur();
          if (ke.key === "Escape") { input.value = c.name; input.blur(); }
        });
      });
      bar.appendChild(tab);
    });
    const addBtn = document.createElement("button");
    addBtn.className = "canvas-tab canvas-tab-add";
    addBtn.type = "button";
    addBtn.textContent = "+";
    addBtn.title = "New canvas";
    addBtn.addEventListener("click", () => createCanvas());
    bar.appendChild(addBtn);

    const ds = window.datascope;
    const active = canvases.find(cv => cv.id === currentId);
    if (ds?.userTeams?.length && active) {
      const wrap = document.createElement("div");
      wrap.className = "team-move-wrap";
      wrap.style.cssText = "margin-left:auto;padding-right:8px";
      const lbl = document.createElement("label");
      lbl.className = "team-move-label";
      lbl.textContent = "Owner";
      wrap.appendChild(lbl);
      const moveSel = ds.buildTeamMoveSelect(active.teamId || null);
      moveSel.addEventListener("change", () => {
        active.teamId = moveSel.value || null;
        save();
        buildCanvasBar();
      });
      wrap.appendChild(moveSel);
      bar.appendChild(wrap);
    }
  }

  // ---------- Coordinate transforms ----------
  function screenToWorld(sx, sy) {
    return { x: (sx - state.pan.x) / state.zoom, y: (sy - state.pan.y) / state.zoom };
  }

  function worldToScreen(wx, wy) {
    return { x: wx * state.zoom + state.pan.x, y: wy * state.zoom + state.pan.y };
  }

  // ---------- Snap alignment ----------
  function computeSnap(shape) {
    snapGuides = [];
    const movingX = [shape.x, shape.x + shape.w / 2, shape.x + shape.w];
    const movingY = [shape.y, shape.y + shape.h / 2, shape.y + shape.h];
    let bestDx = SNAP_THRESHOLD, bestDy = SNAP_THRESHOLD;
    let snapX = null, snapY = null, guideX = null, guideY = null;

    for (const other of state.shapes) {
      if (other.id === shape.id) continue;
      const otherX = [other.x, other.x + other.w / 2, other.x + other.w];
      const otherY = [other.y, other.y + other.h / 2, other.y + other.h];

      for (let m = 0; m < 3; m++) {
        for (let o = 0; o < 3; o++) {
          const dx = Math.abs(movingX[m] - otherX[o]);
          if (dx < bestDx) {
            bestDx = dx;
            snapX = otherX[o] - (movingX[m] - shape.x);
            guideX = otherX[o];
          }
          const dy = Math.abs(movingY[m] - otherY[o]);
          if (dy < bestDy) {
            bestDy = dy;
            snapY = otherY[o] - (movingY[m] - shape.y);
            guideY = otherY[o];
          }
        }
      }
    }

    if (snapX !== null) { shape.x = snapX; snapGuides.push({ axis: "x", pos: guideX }); }
    if (snapY !== null) { shape.y = snapY; snapGuides.push({ axis: "y", pos: guideY }); }
  }

  // ---------- Resize handles ----------
  function getHandlePositions(s) {
    return {
      tl: { x: s.x, y: s.y },
      t:  { x: s.x + s.w / 2, y: s.y },
      tr: { x: s.x + s.w, y: s.y },
      r:  { x: s.x + s.w, y: s.y + s.h / 2 },
      br: { x: s.x + s.w, y: s.y + s.h },
      b:  { x: s.x + s.w / 2, y: s.y + s.h },
      bl: { x: s.x, y: s.y + s.h },
      l:  { x: s.x, y: s.y + s.h / 2 },
    };
  }

  function hitTestHandle(wx, wy) {
    if (state.selected.size !== 1) return null;
    const shapeId = [...state.selected][0];
    const s = state.shapes.find((sh) => sh.id === shapeId);
    if (!s) return null;
    const hs = (HANDLE_SIZE + 4) / state.zoom / 2;
    const positions = getHandlePositions(s);
    for (const [name, pos] of Object.entries(positions)) {
      if (Math.abs(wx - pos.x) <= hs && Math.abs(wy - pos.y) <= hs) {
        return { handle: name, shapeId: s.id };
      }
    }
    return null;
  }

  function handleCursor(handle) {
    const map = { tl: "nwse-resize", br: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", t: "ns-resize", b: "ns-resize", l: "ew-resize", r: "ew-resize" };
    return map[handle] || "default";
  }

  function drawHandles(s) {
    const positions = getHandlePositions(s);
    const hs = HANDLE_SIZE / state.zoom;
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#0b1020";
    ctx.lineWidth = 1.5 / state.zoom;
    for (const pos of Object.values(positions)) {
      ctx.fillRect(pos.x - hs / 2, pos.y - hs / 2, hs, hs);
      ctx.strokeRect(pos.x - hs / 2, pos.y - hs / 2, hs, hs);
    }
  }

  // ---------- Hit testing ----------
  function hitTest(wx, wy) {
    for (let i = state.shapes.length - 1; i >= 0; i--) {
      const s = state.shapes[i];
      if (shapeContains(s, wx, wy)) return s;
    }
    return null;
  }

  function shapeContains(s, wx, wy) {
    if (s.type === "rect" || s.type === "text") {
      return wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h;
    }
    if (s.type === "circle") {
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      const rx = s.w / 2, ry = s.h / 2;
      return ((wx - cx) / rx) ** 2 + ((wy - cy) / ry) ** 2 <= 1;
    }
    if (s.type === "diamond") {
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      return Math.abs(wx - cx) / (s.w / 2) + Math.abs(wy - cy) / (s.h / 2) <= 1;
    }
    return false;
  }

  // ---------- Arrow hit testing ----------
  function getArrowPoints(a) {
    const from = a.from ? state.shapes.find(s => s.id === a.from) : null;
    const to = a.to ? state.shapes.find(s => s.id === a.to) : null;
    let p1, p2;
    if (from && to) {
      const fc = shapeCenter(from), tc = shapeCenter(to);
      const angle = Math.atan2(tc.y - fc.y, tc.x - fc.x);
      p1 = shapeBorderPoint(from, angle);
      p2 = shapeBorderPoint(to, angle + Math.PI);
    } else if (from) {
      p2 = { x: a.x2, y: a.y2 };
      const fc = shapeCenter(from);
      const angle = Math.atan2(p2.y - fc.y, p2.x - fc.x);
      p1 = shapeBorderPoint(from, angle);
    } else if (to) {
      p1 = { x: a.x1, y: a.y1 };
      const tc = shapeCenter(to);
      const angle = Math.atan2(p1.y - tc.y, p1.x - tc.x);
      p2 = shapeBorderPoint(to, angle);
    } else {
      p1 = { x: a.x1 || 0, y: a.y1 || 0 };
      p2 = { x: a.x2 || 0, y: a.y2 || 0 };
    }
    return { p1, p2 };
  }

  function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function hitTestArrow(wx, wy) {
    const threshold = ARROW_HIT_DIST / state.zoom;
    for (let i = state.arrows.length - 1; i >= 0; i--) {
      const a = state.arrows[i];
      const { p1, p2 } = getArrowPoints(a);
      if (pointToSegmentDist(wx, wy, p1.x, p1.y, p2.x, p2.y) <= threshold) return a;
    }
    return null;
  }

  function hitTestArrowHandle(wx, wy) {
    if (state.selectedArrows.size !== 1) return null;
    const aId = [...state.selectedArrows][0];
    const a = state.arrows.find(ar => ar.id === aId);
    if (!a) return null;
    const { p1, p2 } = getArrowPoints(a);
    const hs = (HANDLE_SIZE + 6) / state.zoom;
    if (Math.hypot(wx - p1.x, wy - p1.y) <= hs) return { arrowId: a.id, endpoint: "from" };
    if (Math.hypot(wx - p2.x, wy - p2.y) <= hs) return { arrowId: a.id, endpoint: "to" };
    return null;
  }

  function shapeCenter(s) {
    return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  }

  function shapeBorderPoint(s, angle) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    if (s.type === "circle") {
      return { x: cx + (s.w / 2) * cos, y: cy + (s.h / 2) * sin };
    }
    if (s.type === "diamond") {
      const t = 1 / (Math.abs(cos) / (s.w / 2) + Math.abs(sin) / (s.h / 2));
      return { x: cx + t * cos, y: cy + t * sin };
    }
    // rect / text
    const hw = s.w / 2, hh = s.h / 2;
    let t = Math.min(hw / Math.abs(cos || 0.001), hh / Math.abs(sin || 0.001));
    return { x: cx + t * cos, y: cy + t * sin };
  }

  // ---------- Drawing ----------
  function draw() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    ctx.save();
    ctx.translate(state.pan.x, state.pan.y);
    ctx.scale(state.zoom, state.zoom);

    // Arrows
    state.arrows.forEach((a) => {
      const selected = state.selectedArrows.has(a.id);
      drawArrowFull(a, selected);
    });

    // Arrow/line preview while creating
    if ((state.tool === "arrow" || state.tool === "line") && creating) {
      let sx, sy;
      if (arrowStart) {
        const from = state.shapes.find((s) => s.id === arrowStart);
        if (from) { const fc = shapeCenter(from); sx = fc.x; sy = fc.y; }
      }
      if (sx === undefined) { sx = creating.startX; sy = creating.startY; }
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(creating.currentX, creating.currentY);
      ctx.strokeStyle = "rgba(110, 168, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Shapes
    state.shapes.forEach((s) => drawShape(s, state.selected.has(s.id)));

    // Resize handles
    if (state.selected.size === 1) {
      const sel = state.shapes.find((s) => state.selected.has(s.id));
      if (sel) drawHandles(sel);
    }

    // Arrow endpoint handles
    if (state.selectedArrows.size === 1) {
      const aId = [...state.selectedArrows][0];
      const a = state.arrows.find(ar => ar.id === aId);
      if (a) {
        const { p1, p2 } = getArrowPoints(a);
        const hs = HANDLE_SIZE / state.zoom;
        ctx.fillStyle = "#fbbf24";
        ctx.strokeStyle = "#0b1020";
        ctx.lineWidth = 1.5 / state.zoom;
        [p1, p2].forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, hs / 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      }
    }

    // Creation preview
    if (creating && creating.type !== "arrow" && creating.w !== undefined) {
      drawShapePreview(creating);
    }

    drawSnapGuides();
    drawMarquee();

    ctx.restore();
  }

  function drawGrid() {
    const spacing = 40 * state.zoom;
    if (spacing < 8) return;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;

    const offX = state.pan.x % spacing;
    const offY = state.pan.y % spacing;

    for (let x = offX; x < canvas.width; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = offY; y < canvas.height; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  function drawShape(s, selected) {
    const sw = s.strokeWidth || 1.5;
    const hasFill = s.fill && s.fill !== "transparent" && s.fill !== "none";
    const hasStroke = s.stroke && s.stroke !== "transparent" && s.stroke !== "none";

    if (hasFill) ctx.fillStyle = s.fill;
    ctx.strokeStyle = selected ? "#fbbf24" : (hasStroke ? s.stroke : "transparent");
    ctx.lineWidth = selected ? sw + 1 : sw;

    if (s.type === "rect") {
      const r = 6;
      roundRect(s.x, s.y, s.w, s.h, r);
      if (hasFill) ctx.fill();
      if (hasStroke || selected) ctx.stroke();
    } else if (s.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      if (hasFill) ctx.fill();
      if (hasStroke || selected) ctx.stroke();
    } else if (s.type === "diamond") {
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, s.y);
      ctx.lineTo(s.x + s.w, cy);
      ctx.lineTo(cx, s.y + s.h);
      ctx.lineTo(s.x, cy);
      ctx.closePath();
      if (hasFill) ctx.fill();
      if (hasStroke || selected) ctx.stroke();
    } else if (s.type === "text") {
      if (selected) {
        ctx.strokeStyle = "#fbbf24";
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(s.x, s.y, s.w, s.h);
        ctx.setLineDash([]);
      }
    }

    // Draw text
    if (s.label) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x, s.y, s.w, s.h);
      ctx.clip();
      const align = s.textAlign || "center";
      ctx.fillStyle = s.textColor || "#e7ecff";
      ctx.font = `${s.fontSize || 14}px Inter, system-ui, sans-serif`;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      const tx = align === "left" ? s.x + 8 : align === "right" ? s.x + s.w - 8 : s.x + s.w / 2;
      wrapText(s.label, tx, s.y + s.h / 2, s.w - 16, s.fontSize || 14, s.h);
      ctx.restore();
    }
  }

  function drawShapePreview(p) {
    ctx.fillStyle = "rgba(29, 37, 74, 0.5)";
    ctx.strokeStyle = "rgba(110, 168, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);

    const x = Math.min(p.startX, p.startX + p.w);
    const y = Math.min(p.startY, p.startY + p.h);
    const w = Math.abs(p.w);
    const h = Math.abs(p.h);

    if (p.type === "rect" || p.type === "text") {
      ctx.strokeRect(x, y, w, h);
    } else if (p.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === "diamond") {
      const cx = x + w / 2, cy = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, y); ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawArrowFull(a, selected) {
    const { p1, p2 } = getArrowPoints(a);
    if (!p1 || !p2) return;
    const color = selected ? "#fbbf24" : (a.color || "#6ea8ff");

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();

    if (!a.lineOnly) {
      const headLen = 10;
      const a1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLen * Math.cos(a1 - 0.4), p2.y - headLen * Math.sin(a1 - 0.4));
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLen * Math.cos(a1 + 0.4), p2.y - headLen * Math.sin(a1 + 0.4));
      ctx.stroke();
    }

    if (a.label) {
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      ctx.save();
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(a.label).width + 12;
      ctx.fillStyle = "rgba(11, 16, 32, 0.85)";
      ctx.fillRect(mx - tw / 2, my - 10, tw, 20);
      ctx.fillStyle = a.labelColor || "#e7ecff";
      ctx.fillText(a.label, mx, my);
      ctx.restore();
    }
  }

  function drawArrow(from, to, color) {
    const fc = shapeCenter(from);
    const tc = shapeCenter(to);
    const angle = Math.atan2(tc.y - fc.y, tc.x - fc.x);
    const start = shapeBorderPoint(from, angle);
    const end = shapeBorderPoint(to, angle + Math.PI);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    const headLen = 10;
    const a1 = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(a1 - 0.4), end.y - headLen * Math.sin(a1 - 0.4));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(a1 + 0.4), end.y - headLen * Math.sin(a1 + 0.4));
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(text, cx, cy, maxWidth, fontSize, shapeH) {
    const lines = text.split("\n");
    const allLines = [];
    lines.forEach((line) => {
      if (!line.trim()) { allLines.push(""); return; }
      const words = line.split(" ");
      let current = "";
      words.forEach((word) => {
        const test = current ? current + " " + word : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          allLines.push(current);
          current = word;
        } else {
          current = test;
        }
      });
      if (current) allLines.push(current);
    });

    const lineH = fontSize * 1.3;
    const totalH = allLines.length * lineH;
    const fitsInShape = !shapeH || totalH <= shapeH - 16;
    const startY = fitsInShape
      ? cy - totalH / 2 + lineH / 2
      : cy - (shapeH || totalH) / 2 + 12 + lineH / 2;
    allLines.forEach((line, i) => {
      ctx.fillText(line, cx, startY + i * lineH);
    });
  }

  function drawSnapGuides() {
    if (!snapGuides.length) return;
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = "#ff44cc";
    ctx.lineWidth = 1 / state.zoom;
    ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
    snapGuides.forEach((g) => {
      ctx.beginPath();
      if (g.axis === "x") { ctx.moveTo(g.pos, topLeft.y); ctx.lineTo(g.pos, bottomRight.y); }
      else { ctx.moveTo(topLeft.x, g.pos); ctx.lineTo(bottomRight.x, g.pos); }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawMarquee() {
    if (!marquee) return;
    const x = Math.min(marquee.startX, marquee.startX + marquee.w);
    const y = Math.min(marquee.startY, marquee.startY + marquee.h);
    const w = Math.abs(marquee.w);
    const h = Math.abs(marquee.h);
    ctx.save();
    ctx.fillStyle = "rgba(110, 168, 255, 0.1)";
    ctx.strokeStyle = "rgba(110, 168, 255, 0.6)";
    ctx.lineWidth = 1 / state.zoom;
    ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ---------- Tool management ----------
  function setTool(tool) {
    if (tool === "shape") tool = state.currentShape;
    state.tool = tool;
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      const match = btn.dataset.tool === tool || (btn.dataset.tool === "shape" && ["rect", "circle", "diamond"].includes(tool));
      btn.classList.toggle("active", match);
    });
    const viewport = document.getElementById("viewport");
    if (tool === "select") viewport.style.cursor = "default";
    else if (tool === "hand") viewport.style.cursor = "grab";
    else viewport.style.cursor = "crosshair";
  }

  function setTextAlign(align) {
    state.textAlign = align;
    document.querySelectorAll(".tool-align-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.align === align);
    });
    if (state.selected.size) {
      state.shapes.forEach(s => { if (state.selected.has(s.id)) s.textAlign = align; });
      save(); draw();
    }
  }

  function setCurrentShape(shape) {
    state.currentShape = shape;
    const icon = document.getElementById("shapeBtnIcon");
    if (icon) icon.innerHTML = SHAPE_ICONS[shape] || SHAPE_ICONS.rect;
    document.querySelectorAll(".shape-flyout-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.shape === shape);
    });
    const flyout = document.getElementById("shapeFlyout");
    if (flyout) flyout.hidden = true;
    setTool(shape);
  }

  // ---------- Mouse events ----------
  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      panning = true;
      panLast = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    if (state.tool === "hand") {
      panning = true;
      panLast = { x: e.clientX, y: e.clientY };
      document.getElementById("viewport").style.cursor = "grabbing";
      return;
    }

    const pos = getCanvasPos(e);
    const world = screenToWorld(pos.x, pos.y);

    if (state.tool === "select") {
      // 1. Arrow endpoint handles
      const arrowHandle = hitTestArrowHandle(world.x, world.y);
      if (arrowHandle) {
        const a = state.arrows.find(ar => ar.id === arrowHandle.arrowId);
        if (a) {
          const { p1, p2 } = getArrowPoints(a);
          const pt = arrowHandle.endpoint === "from" ? p1 : p2;
          arrowEndpointDrag = { arrowId: a.id, endpoint: arrowHandle.endpoint, x: pt.x, y: pt.y };
          return;
        }
      }

      // 2. Shape resize handles
      const handleHit = hitTestHandle(world.x, world.y);
      if (handleHit) {
        const s = state.shapes.find((sh) => sh.id === handleHit.shapeId);
        if (s) {
          resizing = {
            handle: handleHit.handle,
            shapeId: s.id,
            startX: world.x,
            startY: world.y,
            origX: s.x, origY: s.y,
            origW: s.w, origH: s.h,
          };
          document.getElementById("viewport").style.cursor = handleCursor(handleHit.handle);
          return;
        }
      }

      // 3. Arrow body hit
      const arrowHit = hitTestArrow(world.x, world.y);
      if (arrowHit) {
        if (e.metaKey || e.ctrlKey) {
          const ns = new Set(state.selectedArrows);
          if (ns.has(arrowHit.id)) ns.delete(arrowHit.id); else ns.add(arrowHit.id);
          state.selectedArrows = ns;
        } else {
          state.selectedArrows = new Set([arrowHit.id]);
        }
        state.selected = new Set();
        const { p1, p2 } = getArrowPoints(arrowHit);
        arrowBodyDrag = {
          arrowId: arrowHit.id,
          startX: world.x, startY: world.y,
          origFrom: arrowHit.from, origTo: arrowHit.to,
          origX1: p1.x, origY1: p1.y,
          origX2: p2.x, origY2: p2.y,
        };
        draw();
        return;
      }

      // 4. Shape hit
      const hit = hitTest(world.x, world.y);
      if (hit) {
        if (e.metaKey || e.ctrlKey) {
          const ns = new Set(state.selected);
          if (ns.has(hit.id)) ns.delete(hit.id); else ns.add(hit.id);
          state.selected = ns;
        } else if (!state.selected.has(hit.id)) {
          state.selected = new Set([hit.id]);
        }
        state.selectedArrows = new Set();
        dragging = true;
        dragStart = { x: world.x, y: world.y };
        dragShapeStarts = {};
        for (const id of state.selected) {
          const s = state.shapes.find((sh) => sh.id === id);
          if (s) dragShapeStarts[id] = { x: s.x, y: s.y };
        }
      } else {
        if (!(e.metaKey || e.ctrlKey)) {
          state.selected = new Set();
          state.selectedArrows = new Set();
        }
        marquee = { startX: world.x, startY: world.y, w: 0, h: 0 };
      }
      draw();
    } else if (state.tool === "arrow" || state.tool === "line") {
      const hit = hitTest(world.x, world.y);
      if (hit) {
        arrowStart = hit.id;
        creating = { type: state.tool, currentX: world.x, currentY: world.y, startX: world.x, startY: world.y };
        state.selected = new Set([hit.id]);
      } else {
        arrowStart = null;
        creating = { type: state.tool, currentX: world.x, currentY: world.y, startX: world.x, startY: world.y };
      }
      draw();
    } else {
      state.selected = new Set();
      creating = { type: state.tool, startX: world.x, startY: world.y, w: 0, h: 0 };
      draw();
    }
  }

  function onMouseMove(e) {
    if (panning) {
      state.pan.x += e.clientX - panLast.x;
      state.pan.y += e.clientY - panLast.y;
      panLast = { x: e.clientX, y: e.clientY };
      draw();
      return;
    }

    const pos = getCanvasPos(e);
    const world = screenToWorld(pos.x, pos.y);

    if (arrowEndpointDrag) {
      arrowEndpointDrag.x = world.x;
      arrowEndpointDrag.y = world.y;
      const a = state.arrows.find(ar => ar.id === arrowEndpointDrag.arrowId);
      if (a) {
        if (arrowEndpointDrag.endpoint === "from") {
          a.from = null;
          a.x1 = world.x; a.y1 = world.y;
        } else {
          a.to = null;
          a.x2 = world.x; a.y2 = world.y;
        }
      }
      draw();
      return;
    }

    if (arrowBodyDrag) {
      const dx = world.x - arrowBodyDrag.startX;
      const dy = world.y - arrowBodyDrag.startY;
      const a = state.arrows.find(ar => ar.id === arrowBodyDrag.arrowId);
      if (a) {
        a.from = null;
        a.to = null;
        a.x1 = arrowBodyDrag.origX1 + dx;
        a.y1 = arrowBodyDrag.origY1 + dy;
        a.x2 = arrowBodyDrag.origX2 + dx;
        a.y2 = arrowBodyDrag.origY2 + dy;
      }
      draw();
      return;
    }

    if (resizing) {
      const s = state.shapes.find((sh) => sh.id === resizing.shapeId);
      if (s) {
        const dx = world.x - resizing.startX;
        const dy = world.y - resizing.startY;
        const h = resizing.handle;
        const left = h === "tl" || h === "l" || h === "bl";
        const right = h === "tr" || h === "r" || h === "br";
        const top = h === "tl" || h === "t" || h === "tr";
        const bottom = h === "bl" || h === "b" || h === "br";

        let nx = resizing.origX, ny = resizing.origY;
        let nw = resizing.origW, nh = resizing.origH;
        if (left)   { nx += dx; nw -= dx; }
        if (right)  { nw += dx; }
        if (top)    { ny += dy; nh -= dy; }
        if (bottom) { nh += dy; }

        if (e.metaKey || e.ctrlKey) {
          const aspect = resizing.origW / resizing.origH;
          const isCorner = (h === "tl" || h === "tr" || h === "bl" || h === "br");
          if (isCorner) {
            const avgDim = (Math.abs(nw) + Math.abs(nh) * aspect) / 2;
            nw = avgDim; nh = avgDim / aspect;
            if (left) nx = resizing.origX + resizing.origW - nw;
            if (top) ny = resizing.origY + resizing.origH - nh;
          } else if (h === "t" || h === "b") {
            nw = nh * aspect;
            nx = resizing.origX + (resizing.origW - nw) / 2;
          } else {
            nh = nw / aspect;
            ny = resizing.origY + (resizing.origH - nh) / 2;
          }
        }

        if (nw < MIN_SHAPE_SIZE) {
          if (left) nx = resizing.origX + resizing.origW - MIN_SHAPE_SIZE;
          nw = MIN_SHAPE_SIZE;
        }
        if (nh < MIN_SHAPE_SIZE) {
          if (top) ny = resizing.origY + resizing.origH - MIN_SHAPE_SIZE;
          nh = MIN_SHAPE_SIZE;
        }
        s.x = nx; s.y = ny; s.w = nw; s.h = nh;
      }
      draw();
      return;
    }

    if (dragging && state.selected.size) {
      const dx = world.x - dragStart.x;
      const dy = world.y - dragStart.y;
      for (const id of state.selected) {
        const s = state.shapes.find((sh) => sh.id === id);
        const st = dragShapeStarts[id];
        if (s && st) { s.x = st.x + dx; s.y = st.y + dy; }
      }
      if (state.selected.size === 1) {
        const shape = state.shapes.find((s) => state.selected.has(s.id));
        if (shape) computeSnap(shape);
      }
      draw();
    } else if (marquee) {
      marquee.w = world.x - marquee.startX;
      marquee.h = world.y - marquee.startY;
      draw();
    } else if (creating) {
      if (creating.type === "arrow" || creating.type === "line") {
        creating.currentX = world.x;
        creating.currentY = world.y;
      } else {
        creating.w = world.x - creating.startX;
        creating.h = world.y - creating.startY;
      }
      draw();
    } else if (state.tool === "select") {
      const ah = hitTestArrowHandle(world.x, world.y);
      if (ah) {
        document.getElementById("viewport").style.cursor = "crosshair";
        return;
      }
      const hh = hitTestHandle(world.x, world.y);
      if (hh) {
        document.getElementById("viewport").style.cursor = handleCursor(hh.handle);
        return;
      }
      const arrowHover = hitTestArrow(world.x, world.y);
      document.getElementById("viewport").style.cursor = arrowHover ? "pointer" : "default";
    }
  }

  function onMouseUp(e) {
    if (panning) {
      panning = false;
      if (state.tool === "hand") document.getElementById("viewport").style.cursor = "grab";
      save();
      return;
    }

    if (arrowEndpointDrag) {
      const a = state.arrows.find(ar => ar.id === arrowEndpointDrag.arrowId);
      if (a) {
        const hit = hitTest(arrowEndpointDrag.x, arrowEndpointDrag.y);
        if (hit) {
          if (arrowEndpointDrag.endpoint === "from") {
            a.from = hit.id;
            delete a.x1; delete a.y1;
          } else {
            a.to = hit.id;
            delete a.x2; delete a.y2;
          }
        }
      }
      arrowEndpointDrag = null;
      save();
      draw();
      return;
    }

    if (arrowBodyDrag) {
      const a = state.arrows.find(ar => ar.id === arrowBodyDrag.arrowId);
      if (a) {
        const hitFrom = hitTest(a.x1, a.y1);
        const hitTo = hitTest(a.x2, a.y2);
        if (hitFrom) { a.from = hitFrom.id; delete a.x1; delete a.y1; }
        if (hitTo) { a.to = hitTo.id; delete a.x2; delete a.y2; }
      }
      arrowBodyDrag = null;
      save();
      draw();
      return;
    }

    if (resizing) {
      resizing = null;
      save();
      draw();
      return;
    }

    if (dragging) {
      dragging = false;
      snapGuides = [];
      save();
      draw();
      return;
    }

    if (marquee) {
      const mx = Math.min(marquee.startX, marquee.startX + marquee.w);
      const my = Math.min(marquee.startY, marquee.startY + marquee.h);
      const mw = Math.abs(marquee.w);
      const mh = Math.abs(marquee.h);
      if (mw > 2 || mh > 2) {
        const sel = new Set();
        for (const s of state.shapes) {
          if (s.x + s.w > mx && s.x < mx + mw && s.y + s.h > my && s.y < my + mh) sel.add(s.id);
        }
        state.selected = sel;
        const selArrows = new Set();
        for (const a of state.arrows) {
          const { p1, p2 } = getArrowPoints(a);
          if (p1.x >= mx && p1.x <= mx + mw && p1.y >= my && p1.y <= my + mh &&
              p2.x >= mx && p2.x <= mx + mw && p2.y >= my && p2.y <= my + mh) {
            selArrows.add(a.id);
          }
        }
        state.selectedArrows = selArrows;
      }
      marquee = null;
      draw();
      return;
    }

    if (creating) {
      if (creating.type === "arrow" || creating.type === "line") {
        const pos = getCanvasPos(e);
        const world = screenToWorld(pos.x, pos.y);
        const hit = hitTest(world.x, world.y);
        const dist = Math.hypot(world.x - creating.startX, world.y - creating.startY);
        if (dist > 5) {
          const arrow = { id: uid(), color: state.strokeColor };
          if (creating.type === "line") arrow.lineOnly = true;
          if (arrowStart) {
            arrow.from = arrowStart;
          } else {
            arrow.from = null;
            arrow.x1 = creating.startX;
            arrow.y1 = creating.startY;
          }
          if (hit && hit.id !== arrowStart) {
            arrow.to = hit.id;
          } else {
            arrow.to = null;
            arrow.x2 = world.x;
            arrow.y2 = world.y;
          }
          const duplicate = arrowStart && hit && state.arrows.some((a) => a.from === arrowStart && a.to === hit.id);
          if (!duplicate) {
            state.arrows.push(arrow);
            state.selectedArrows = new Set([arrow.id]);
            state.selected = new Set();
          }
        }
        arrowStart = null;
        creating = null;
        setTool("select");
        save();
        draw();
        return;
      }

      const x = Math.min(creating.startX, creating.startX + creating.w);
      const y = Math.min(creating.startY, creating.startY + creating.h);
      const w = Math.abs(creating.w);
      const h = Math.abs(creating.h);

      if (w < MIN_SHAPE_SIZE && h < MIN_SHAPE_SIZE) {
        const defaultW = creating.type === "text" ? 160 : 140;
        const defaultH = creating.type === "text" ? 40 : 80;
        const shape = {
          id: uid(),
          type: creating.type,
          x: creating.startX - defaultW / 2,
          y: creating.startY - defaultH / 2,
          w: defaultW,
          h: defaultH,
          fill: creating.type === "text" ? "transparent" : state.fillColor,
          stroke: state.strokeColor,
          strokeWidth: state.strokeWidth,
          label: "",
          textColor: state.textColor,
          textAlign: state.textAlign || "center",
          fontSize: 14,
        };
        state.shapes.push(shape);
        state.selected = new Set([shape.id]);
        creating = null;
        setTool("select");
        save();
        draw();
        openTextEditor(shape);
        return;
      }

      const shape = {
        id: uid(),
        type: creating.type,
        x, y, w, h,
        fill: creating.type === "text" ? "transparent" : state.fillColor,
        stroke: state.strokeColor,
        strokeWidth: state.strokeWidth,
        label: "",
        textColor: state.textColor,
        textAlign: state.textAlign || "center",
        fontSize: 14,
      };
      state.shapes.push(shape);
      state.selected = new Set([shape.id]);
      creating = null;
      setTool("select");
      save();
      draw();
      openTextEditor(shape);
    }
  }

  function onDoubleClick(e) {
    const pos = getCanvasPos(e);
    const world = screenToWorld(pos.x, pos.y);
    const hit = hitTest(world.x, world.y);
    if (hit) {
      state.selected = new Set([hit.id]);
      draw();
      openTextEditor(hit);
      return;
    }
    const arrowHit = hitTestArrow(world.x, world.y);
    if (arrowHit) {
      state.selectedArrows = new Set([arrowHit.id]);
      draw();
      openArrowLabelEditor(arrowHit);
    }
  }

  function openArrowLabelEditor(arrow) {
    const { p1, p2 } = getArrowPoints(arrow);
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const screen = worldToScreen(mx, my);
    const editor = document.getElementById("textEditor");
    const edW = 160, edH = 30;
    editor.style.left = (screen.x - edW / 2) + "px";
    editor.style.top = (screen.y - edH / 2) + "px";
    editor.style.width = edW + "px";
    editor.style.height = edH + "px";
    editor.style.fontSize = 12 * state.zoom + "px";
    editor.value = arrow.label || "";
    editor.hidden = false;
    editor.focus();
    editor.select();

    const onBlur = () => {
      arrow.label = editor.value;
      editor.hidden = true;
      editor.removeEventListener("blur", onBlur);
      editor.removeEventListener("keydown", onKey);
      save();
      draw();
    };
    const onKey = (e) => {
      if (e.key === "Escape") editor.blur();
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editor.blur(); }
    };
    editor.addEventListener("blur", onBlur);
    editor.addEventListener("keydown", onKey);
  }

  function onWheel(e) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    const newZoom = Math.min(5, Math.max(0.15, state.zoom * factor));

    // Zoom toward cursor
    state.pan.x = pos.x - (pos.x - state.pan.x) * (newZoom / state.zoom);
    state.pan.y = pos.y - (pos.y - state.pan.y) * (newZoom / state.zoom);
    state.zoom = newZoom;

    updateZoomLabel();
    draw();
    save();
  }

  // ---------- Text editor ----------
  function openTextEditor(shape) {
    const editor = document.getElementById("textEditor");
    const screen = worldToScreen(shape.x, shape.y);

    editor.style.left = screen.x + "px";
    editor.style.top = screen.y + "px";
    editor.style.width = (shape.w * state.zoom) + "px";
    editor.style.height = (shape.h * state.zoom) + "px";
    editor.style.fontSize = (shape.fontSize || 14) * state.zoom + "px";
    editor.style.textAlign = shape.textAlign || "center";
    editor.value = shape.label || "";
    editor.hidden = false;
    editor.focus();
    editor.select();

    const onBlur = () => {
      shape.label = editor.value;
      editor.hidden = true;
      editor.removeEventListener("blur", onBlur);
      editor.removeEventListener("keydown", onKey);
      save();
      draw();
    };

    const onKey = (e) => {
      if (e.key === "Escape") { editor.blur(); }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); editor.blur(); }
    };

    editor.addEventListener("blur", onBlur);
    editor.addEventListener("keydown", onKey);
  }

  // ---------- Keyboard ----------
  function onKeyDown(e) {
    if (!document.getElementById("textEditor").hidden) return;
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) return;

    const mod = e.metaKey || e.ctrlKey;

    if (e.key === "Delete" || e.key === "Backspace") {
      deleteSelected();
      e.preventDefault();
    }

    // Copy
    if (mod && e.key === "c") {
      copySelected();
      e.preventDefault();
      return;
    }
    // Paste
    if (mod && e.key === "v") {
      pasteClipboard();
      e.preventDefault();
      return;
    }
    // Select all
    if (mod && e.key === "a") {
      state.selected = new Set(state.shapes.map(s => s.id));
      state.selectedArrows = new Set(state.arrows.map(a => a.id));
      draw();
      e.preventDefault();
      return;
    }

    // Arrow key movement
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (state.selected.size || state.selectedArrows.size) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        moveSelected(dx, dy);
        e.preventDefault();
      }
      return;
    }

    if (!mod) {
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "s" || e.key === "S") setTool("shape");
      if (e.key === "r" || e.key === "R") setCurrentShape("rect");
      if (e.key === "c" || e.key === "C") setCurrentShape("circle");
      if (e.key === "d" || e.key === "D") setCurrentShape("diamond");
      if (e.key === "t" || e.key === "T") setTool("text");
      if (e.key === "a" || e.key === "A") setTool("arrow");
      if (e.key === "l" || e.key === "L") setTool("line");
      if (e.key === "h" || e.key === "H") setTool("hand");
      if (e.key === "]") { bringForward(); e.preventDefault(); }
      if (e.key === "[") { sendBackward(); e.preventDefault(); }
    }
  }

  function moveSelected(dx, dy) {
    for (const id of state.selected) {
      const s = state.shapes.find(sh => sh.id === id);
      if (s) { s.x += dx; s.y += dy; }
    }
    for (const id of state.selectedArrows) {
      const a = state.arrows.find(ar => ar.id === id);
      if (a) {
        const { p1, p2 } = getArrowPoints(a);
        if (a.from && !state.selected.has(a.from)) {
          a.from = null; a.x1 = p1.x + dx; a.y1 = p1.y + dy;
        } else if (!a.from && a.x1 !== undefined) { a.x1 += dx; a.y1 += dy; }
        if (a.to && !state.selected.has(a.to)) {
          a.to = null; a.x2 = p2.x + dx; a.y2 = p2.y + dy;
        } else if (!a.to && a.x2 !== undefined) { a.x2 += dx; a.y2 += dy; }
      }
    }
    save();
    draw();
  }

  function copySelected() {
    const shapes = state.shapes.filter(s => state.selected.has(s.id));
    const shapeIds = new Set(shapes.map(s => s.id));
    const arrows = state.arrows.filter(a => state.selectedArrows.has(a.id) || (shapeIds.has(a.from) && shapeIds.has(a.to)));
    if (!shapes.length && !arrows.length) return;
    clipboard = {
      shapes: JSON.parse(JSON.stringify(shapes)),
      arrows: JSON.parse(JSON.stringify(arrows)),
    };
  }

  function pasteClipboard() {
    if (!clipboard || (!clipboard.shapes.length && !clipboard.arrows.length)) return;
    const idMap = {};
    const offset = 20;
    const newShapes = clipboard.shapes.map(s => {
      const newId = uid();
      idMap[s.id] = newId;
      return { ...s, id: newId, x: s.x + offset, y: s.y + offset };
    });
    const newArrows = clipboard.arrows.map(a => {
      const newId = uid();
      const na = { ...a, id: newId };
      if (a.from && idMap[a.from]) na.from = idMap[a.from];
      else if (a.from) { na.from = null; na.x1 = (a.x1 || 0) + offset; na.y1 = (a.y1 || 0) + offset; }
      if (a.x1 !== undefined && !a.from) { na.x1 = a.x1 + offset; na.y1 = a.y1 + offset; }
      if (a.to && idMap[a.to]) na.to = idMap[a.to];
      else if (a.to) { na.to = null; na.x2 = (a.x2 || 0) + offset; na.y2 = (a.y2 || 0) + offset; }
      if (a.x2 !== undefined && !a.to) { na.x2 = a.x2 + offset; na.y2 = a.y2 + offset; }
      return na;
    });
    state.shapes.push(...newShapes);
    state.arrows.push(...newArrows);
    state.selected = new Set(newShapes.map(s => s.id));
    state.selectedArrows = new Set(newArrows.map(a => a.id));
    // Shift clipboard for consecutive pastes
    clipboard.shapes.forEach(s => { s.x += offset; s.y += offset; });
    clipboard.arrows.forEach(a => {
      if (a.x1 !== undefined) { a.x1 += offset; a.y1 += offset; }
      if (a.x2 !== undefined) { a.x2 += offset; a.y2 += offset; }
    });
    save();
    draw();
  }

  function deleteSelected() {
    if (!state.selected.size && !state.selectedArrows.size) return;
    if (state.selected.size) {
      state.shapes = state.shapes.filter((s) => !state.selected.has(s.id));
      state.arrows = state.arrows.filter((a) => !state.selected.has(a.from) && !state.selected.has(a.to));
      state.selected = new Set();
    }
    if (state.selectedArrows.size) {
      state.arrows = state.arrows.filter((a) => !state.selectedArrows.has(a.id));
      state.selectedArrows = new Set();
    }
    save();
    draw();
  }

  // ---------- Z-order ----------
  function bringForward() {
    if (!state.selected.size) return;
    for (let i = state.shapes.length - 2; i >= 0; i--) {
      if (state.selected.has(state.shapes[i].id) && !state.selected.has(state.shapes[i + 1].id)) {
        [state.shapes[i], state.shapes[i + 1]] = [state.shapes[i + 1], state.shapes[i]];
      }
    }
    save(); draw();
  }

  function sendBackward() {
    if (!state.selected.size) return;
    for (let i = 1; i < state.shapes.length; i++) {
      if (state.selected.has(state.shapes[i].id) && !state.selected.has(state.shapes[i - 1].id)) {
        [state.shapes[i], state.shapes[i - 1]] = [state.shapes[i - 1], state.shapes[i]];
      }
    }
    save(); draw();
  }

  // ---------- Zoom controls ----------
  function updateZoomLabel() {
    document.getElementById("zoomLabel").textContent = Math.round(state.zoom * 100) + "%";
  }

  // ---------- Export ----------
  function renderToImage(shapes, arrows) {
    if (!shapes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapes.forEach((s) => {
      minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.w); maxY = Math.max(maxY, s.y + s.h);
    });
    const pad = 40, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
    const off = document.createElement("canvas");
    off.width = w * 2; off.height = h * 2;
    const oc = off.getContext("2d");
    oc.scale(2, 2);
    oc.fillStyle = "#0f1126";
    oc.fillRect(0, 0, w, h);
    oc.translate(pad - minX, pad - minY);
    const origCtx = ctx;
    ctx = oc;
    arrows.forEach((a) => drawArrowFull(a, false));
    shapes.forEach((s) => drawShape(s, false));
    ctx = origCtx;
    return off;
  }

  function exportPng(all) {
    const shapes = all ? [...state.shapes] : state.shapes.filter((s) => state.selected.has(s.id));
    if (!shapes.length) { alert(all ? "Nothing to export." : "Select a shape first."); return; }
    const ids = new Set(shapes.map((s) => s.id));
    const arrows = state.arrows.filter((a) => ids.has(a.from) && ids.has(a.to));
    const off = renderToImage(shapes, arrows);
    if (!off) return;
    const link = document.createElement("a");
    link.download = all ? "canvas-export.png" : "canvas-selection.png";
    link.href = off.toDataURL("image/png");
    link.click();
  }

  function sendToSlides(all) {
    const shapes = all ? [...state.shapes] : state.shapes.filter((s) => state.selected.has(s.id));
    if (!shapes.length) { alert(all ? "Nothing to send." : "Select a shape first."); return; }
    const ids = new Set(shapes.map((s) => s.id));
    const arrows = state.arrows.filter((a) => ids.has(a.from) && ids.has(a.to));
    const off = renderToImage(shapes, arrows);
    if (!off) return;
    const title = all ? "Canvas Export" : (shapes[0].label || "Canvas Selection");
    localStorage.setItem("datascope_chart_to_slides", JSON.stringify({ image: off.toDataURL("image/png"), title }));
    window.location.href = "slides.html";
  }

  // ---------- Document Import ----------
  const ACCEPTED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "txt",
    "text/csv": "txt",
  };

  const ACCEPTED_EXTENSIONS = { ".pdf": "pdf", ".docx": "docx", ".txt": "txt", ".md": "txt", ".csv": "txt", ".rtf": "txt" };

  function detectFileType(file) {
    const byMime = ACCEPTED_TYPES[file.type];
    if (byMime) return byMime;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    return ACCEPTED_EXTENSIONS[ext] || null;
  }

  function openFileImportPicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.txt,.md,.csv,.rtf";
    input.addEventListener("change", () => {
      if (input.files[0]) importDocumentFile(input.files[0]);
    });
    input.click();
  }

  async function importDocumentFile(file, dropX, dropY) {
    const type = detectFileType(file);
    if (!type) {
      alert("Unsupported file type. Please use PDF, Word (.docx), or text files.");
      return;
    }

    let text = "";
    try {
      if (type === "txt") {
        text = await file.text();
      } else if (type === "pdf") {
        text = await extractPdfText(file);
      } else if (type === "docx") {
        text = await extractDocxText(file);
      }
    } catch (err) {
      alert("Could not read the file: " + (err.message || err));
      return;
    }

    text = text.trim();
    if (!text) {
      alert("No text content found in the file.");
      return;
    }

    const fileName = file.name.replace(/\.[^.]+$/, "");
    createDocumentShape(text, fileName, dropX, dropY);
  }

  async function extractPdfText(file) {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("PDF library is still loading. Please try again in a moment.");
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      if (pageText.trim()) pages.push(pageText.trim());
    }
    return pages.join("\n\n");
  }

  async function extractDocxText(file) {
    if (typeof mammoth === "undefined") {
      throw new Error("Word document library is still loading. Please try again in a moment.");
    }
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  function createDocumentShape(text, title, dropX, dropY) {
    const shapeW = 400;
    const lineH = 14 * 1.3;
    const charsPerLine = Math.floor((shapeW - 32) / 7);
    const lines = text.split("\n").reduce((acc, line) => {
      if (!line.trim()) { acc.push(""); return acc; }
      for (let i = 0; i < line.length; i += charsPerLine) {
        acc.push(line.slice(i, i + charsPerLine));
      }
      return acc;
    }, []);
    const shapeH = Math.max(60, Math.min(600, lines.length * lineH + 32));

    let wx, wy;
    if (dropX !== undefined && dropY !== undefined) {
      const world = screenToWorld(dropX, dropY);
      wx = world.x - shapeW / 2;
      wy = world.y - 20;
    } else {
      const vp = document.getElementById("viewport");
      const center = screenToWorld(vp.clientWidth / 2, vp.clientHeight / 2);
      wx = center.x - shapeW / 2;
      wy = center.y - shapeH / 2;
    }

    const label = title ? title + "\n\n" + text : text;

    const shape = {
      id: uid(),
      type: "rect",
      x: wx,
      y: wy,
      w: shapeW,
      h: shapeH,
      fill: "#111733",
      stroke: state.strokeColor,
      strokeWidth: 1,
      label,
      textColor: state.textColor,
      textAlign: "left",
      fontSize: 12,
    };

    state.shapes.push(shape);
    state.selected = new Set([shape.id]);
    save();
    draw();
  }

  function setupDocumentDrop() {
    const viewport = document.getElementById("viewport");
    const overlay = document.getElementById("dropOverlay");
    let dragCounter = 0;

    viewport.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) overlay.hidden = false;
    });

    viewport.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    viewport.addEventListener("dragleave", (e) => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.hidden = true;
      }
    });

    viewport.addEventListener("drop", (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.hidden = true;

      const file = e.dataTransfer.files[0];
      if (!file) return;

      const rect = viewport.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;
      importDocumentFile(file, dropX, dropY);
    });
  }

  // ---------- Init ----------
  function init() {
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");
    const viewport = document.getElementById("viewport");

    load();
    updateZoomLabel();
    buildCanvasBar();

    // Toolbar
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tool === "shape") setTool("shape");
        else setTool(btn.dataset.tool);
      });
    });

    // Shape flyout
    const shapeFlyout = document.getElementById("shapeFlyout");
    const shapeBtn = document.getElementById("shapeBtn");
    if (shapeBtn) {
      shapeBtn.addEventListener("click", () => {
        shapeFlyout.hidden = !shapeFlyout.hidden;
      });
    }
    document.querySelectorAll(".shape-flyout-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setCurrentShape(btn.dataset.shape);
      });
    });
    document.addEventListener("click", (e) => {
      if (shapeFlyout && !shapeFlyout.hidden && !shapeFlyout.contains(e.target) && e.target !== shapeBtn) {
        shapeFlyout.hidden = true;
      }
    });

    document.getElementById("fillColor").value = state.fillColor;
    document.getElementById("strokeColor").value = state.strokeColor;
    document.getElementById("strokeWidth").value = state.strokeWidth;
    document.getElementById("textColor").value = state.textColor;
    document.getElementById("fillColor").addEventListener("input", (e) => {
      fillNone.checked = false;
      state.fillColor = e.target.value;
      if (state.selected.size) {
        state.shapes.forEach((s) => { if (state.selected.has(s.id)) s.fill = e.target.value; });
        save(); draw();
      }
    });
    document.getElementById("strokeColor").addEventListener("input", (e) => {
      strokeNone.checked = false;
      state.strokeColor = e.target.value;
      if (state.selected.size) {
        state.shapes.forEach((s) => { if (state.selected.has(s.id)) s.stroke = e.target.value; });
        save(); draw();
      }
    });
    document.getElementById("strokeWidth").addEventListener("input", (e) => {
      const val = Math.max(0.5, parseFloat(e.target.value) || 1.5);
      state.strokeWidth = val;
      if (state.selected.size) {
        state.shapes.forEach((s) => { if (state.selected.has(s.id)) s.strokeWidth = val; });
        save(); draw();
      }
    });
    document.getElementById("textColor").addEventListener("input", (e) => {
      state.textColor = e.target.value;
      if (state.selected.size) {
        state.shapes.forEach((s) => { if (state.selected.has(s.id)) s.textColor = e.target.value; });
        save(); draw();
      }
      if (state.selectedArrows.size) {
        state.arrows.forEach((a) => { if (state.selectedArrows.has(a.id)) a.labelColor = e.target.value; });
        save(); draw();
      }
    });

    const fillNone = document.getElementById("fillNone");
    const strokeNone = document.getElementById("strokeNone");
    const fillColorInput = document.getElementById("fillColor");
    const strokeColorInput = document.getElementById("strokeColor");

    fillNone.addEventListener("change", () => {
      if (fillNone.checked) {
        state.fillColor = "transparent";
        fillColorInput.disabled = true;
      } else {
        state.fillColor = fillColorInput.value;
        fillColorInput.disabled = false;
      }
      if (state.selected.size) {
        state.shapes.forEach((s) => { if (state.selected.has(s.id)) s.fill = state.fillColor; });
        save(); draw();
      }
    });

    strokeNone.addEventListener("change", () => {
      if (strokeNone.checked) {
        state.strokeColor = "transparent";
        strokeColorInput.disabled = true;
      } else {
        state.strokeColor = strokeColorInput.value;
        strokeColorInput.disabled = false;
      }
      if (state.selected.size) {
        state.shapes.forEach((s) => { if (state.selected.has(s.id)) s.stroke = state.strokeColor; });
        save(); draw();
      }
    });

    // Text alignment buttons
    document.querySelectorAll(".tool-align-btn").forEach(btn => {
      btn.addEventListener("click", () => setTextAlign(btn.dataset.align));
    });

    document.getElementById("bringFwdBtn").addEventListener("click", bringForward);
    document.getElementById("sendBackBtn").addEventListener("click", sendBackward);

    document.getElementById("deleteBtn").addEventListener("click", deleteSelected);
    document.getElementById("clearBtn").addEventListener("click", () => {
      if (!confirm("Clear all shapes and arrows?")) return;
      state.shapes = [];
      state.arrows = [];
      state.selected = new Set();
      save();
      draw();
    });

    document.getElementById("zoomInBtn").addEventListener("click", () => {
      state.zoom = Math.min(5, state.zoom * 1.2);
      updateZoomLabel();
      save();
      draw();
    });
    document.getElementById("zoomOutBtn").addEventListener("click", () => {
      state.zoom = Math.max(0.15, state.zoom / 1.2);
      updateZoomLabel();
      save();
      draw();
    });

    // Export buttons
    document.getElementById("exportAllPngBtn").addEventListener("click", () => exportPng(true));
    document.getElementById("exportSelPngBtn").addEventListener("click", () => exportPng(false));
    document.getElementById("sendAllSlidesBtn").addEventListener("click", () => sendToSlides(true));
    document.getElementById("sendSelSlidesBtn").addEventListener("click", () => sendToSlides(false));

    // Document import
    document.getElementById("importDocBtn").addEventListener("click", openFileImportPicker);
    setupDocumentDrop();

    // Canvas events
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("dblclick", onDoubleClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);

    // Resize
    const resizeObserver = new ResizeObserver(() => draw());
    resizeObserver.observe(viewport);

    draw();

    document.addEventListener("datascope:teamchange", () => {
      syncFromState();
      ensureCanvasForContext();
      updateZoomLabel();
      buildCanvasBar();
      draw();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
