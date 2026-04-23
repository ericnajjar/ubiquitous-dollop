// DataScope Canvas — interactive journey mapping / diagramming tool.
(() => {
  const STORE_KEY = "datascope_canvas";
  const MIN_SHAPE_SIZE = 20;

  // ---------- State ----------
  const state = {
    shapes: [],
    arrows: [],
    tool: "select",
    fillColor: "#1d254a",
    strokeColor: "#6ea8ff",
    strokeWidth: 1.5,
    selected: new Set(),
    pan: { x: 0, y: 0 },
    zoom: 1,
  };

  let canvases = [];
  let currentId = null;

  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let creating = null; // { type, startX, startY }
  let arrowStart = null; // shape id for arrow source
  let panning = false;
  let panLast = { x: 0, y: 0 };
  let snapGuides = [];
  let marquee = null;
  let dragShapeStarts = {};
  let resizing = null;
  const SNAP_THRESHOLD = 8;
  const HANDLE_SIZE = 8;

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
      const from = state.shapes.find((s) => s.id === a.from);
      const to = state.shapes.find((s) => s.id === a.to);
      if (!from || !to) return;
      drawArrow(from, to, a.color || "#6ea8ff");
    });

    // Arrow preview while creating
    if (state.tool === "arrow" && arrowStart && creating) {
      const from = state.shapes.find((s) => s.id === arrowStart);
      if (from) {
        const fc = shapeCenter(from);
        ctx.beginPath();
        ctx.moveTo(fc.x, fc.y);
        ctx.lineTo(creating.currentX, creating.currentY);
        ctx.strokeStyle = "rgba(110, 168, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Shapes
    state.shapes.forEach((s) => drawShape(s, state.selected.has(s.id)));

    // Resize handles
    if (state.selected.size === 1) {
      const sel = state.shapes.find((s) => state.selected.has(s.id));
      if (sel) drawHandles(sel);
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
    ctx.fillStyle = s.fill || "#1d254a";
    ctx.strokeStyle = selected ? "#fbbf24" : (s.stroke || "#6ea8ff");
    ctx.lineWidth = selected ? sw + 1 : sw;

    if (s.type === "rect") {
      const r = 6;
      roundRect(s.x, s.y, s.w, s.h, r);
      ctx.fill();
      ctx.stroke();
    } else if (s.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (s.type === "diamond") {
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, s.y);
      ctx.lineTo(s.x + s.w, cy);
      ctx.lineTo(cx, s.y + s.h);
      ctx.lineTo(s.x, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (s.type === "text") {
      // text shapes have a subtle bg
      if (selected) {
        ctx.strokeStyle = "#fbbf24";
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(s.x, s.y, s.w, s.h);
        ctx.setLineDash([]);
      }
    }

    // Draw text
    if (s.label) {
      ctx.fillStyle = s.textColor || "#e7ecff";
      ctx.font = `${s.fontSize || 14}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrapText(s.label, s.x + s.w / 2, s.y + s.h / 2, s.w - 16, s.fontSize || 14);
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

  function drawArrow(from, to, color) {
    const fc = shapeCenter(from);
    const tc = shapeCenter(to);
    const angle = Math.atan2(tc.y - fc.y, tc.x - fc.x);
    const reverseAngle = angle + Math.PI;

    const start = shapeBorderPoint(from, angle);
    const end = shapeBorderPoint(to, reverseAngle);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowhead
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

  function wrapText(text, cx, cy, maxWidth, fontSize) {
    const lines = text.split("\n");
    const allLines = [];
    lines.forEach((line) => {
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
    const startY = cy - totalH / 2 + lineH / 2;
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
    state.tool = tool;
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });
    const viewport = document.getElementById("viewport");
    if (tool === "select") viewport.style.cursor = "default";
    else if (tool === "hand") viewport.style.cursor = "grab";
    else viewport.style.cursor = "crosshair";
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

      const hit = hitTest(world.x, world.y);
      if (hit) {
        if (e.metaKey || e.ctrlKey) {
          const ns = new Set(state.selected);
          if (ns.has(hit.id)) ns.delete(hit.id); else ns.add(hit.id);
          state.selected = ns;
        } else if (!state.selected.has(hit.id)) {
          state.selected = new Set([hit.id]);
        }
        dragging = true;
        dragStart = { x: world.x, y: world.y };
        dragShapeStarts = {};
        for (const id of state.selected) {
          const s = state.shapes.find((sh) => sh.id === id);
          if (s) dragShapeStarts[id] = { x: s.x, y: s.y };
        }
      } else {
        if (!(e.metaKey || e.ctrlKey)) state.selected = new Set();
        marquee = { startX: world.x, startY: world.y, w: 0, h: 0 };
      }
      draw();
    } else if (state.tool === "arrow") {
      const hit = hitTest(world.x, world.y);
      if (hit) {
        arrowStart = hit.id;
        creating = { type: "arrow", currentX: world.x, currentY: world.y };
        state.selected = new Set([hit.id]);
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
      if (creating.type === "arrow") {
        creating.currentX = world.x;
        creating.currentY = world.y;
      } else {
        creating.w = world.x - creating.startX;
        creating.h = world.y - creating.startY;
      }
      draw();
    } else if (state.tool === "select") {
      const hh = hitTestHandle(world.x, world.y);
      document.getElementById("viewport").style.cursor = hh ? handleCursor(hh.handle) : "default";
    }
  }

  function onMouseUp(e) {
    if (panning) {
      panning = false;
      if (state.tool === "hand") document.getElementById("viewport").style.cursor = "grab";
      save();
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
      }
      marquee = null;
      draw();
      return;
    }

    if (creating) {
      if (creating.type === "arrow") {
        const pos = getCanvasPos(e);
        const world = screenToWorld(pos.x, pos.y);
        const hit = hitTest(world.x, world.y);
        if (hit && arrowStart && hit.id !== arrowStart) {
          const exists = state.arrows.some((a) => a.from === arrowStart && a.to === hit.id);
          if (!exists) {
            state.arrows.push({ id: uid(), from: arrowStart, to: hit.id, color: state.strokeColor });
          }
        }
        arrowStart = null;
        creating = null;
        save();
        draw();
        return;
      }

      const x = Math.min(creating.startX, creating.startX + creating.w);
      const y = Math.min(creating.startY, creating.startY + creating.h);
      const w = Math.abs(creating.w);
      const h = Math.abs(creating.h);

      if (w < MIN_SHAPE_SIZE && h < MIN_SHAPE_SIZE) {
        // Click without drag — create with default size
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
          textColor: "#e7ecff",
          fontSize: 14,
        };
        state.shapes.push(shape);
        state.selected = new Set([shape.id]);
        creating = null;
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
        textColor: "#e7ecff",
        fontSize: 14,
      };
      state.shapes.push(shape);
      state.selected = new Set([shape.id]);
      creating = null;
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
    }
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

    if (e.key === "Delete" || e.key === "Backspace") {
      deleteSelected();
      e.preventDefault();
    }
    if (e.key === "v" || e.key === "V") setTool("select");
    if (e.key === "r" || e.key === "R") setTool("rect");
    if (e.key === "c" || e.key === "C") setTool("circle");
    if (e.key === "d" || e.key === "D") setTool("diamond");
    if (e.key === "t" || e.key === "T") setTool("text");
    if (e.key === "a" || e.key === "A") setTool("arrow");
    if (e.key === "h" || e.key === "H") setTool("hand");
  }

  function deleteSelected() {
    if (!state.selected.size) return;
    state.shapes = state.shapes.filter((s) => !state.selected.has(s.id));
    state.arrows = state.arrows.filter((a) => !state.selected.has(a.from) && !state.selected.has(a.to));
    state.selected = new Set();
    save();
    draw();
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
    arrows.forEach((a) => {
      const from = shapes.find((s) => s.id === a.from);
      const to = shapes.find((s) => s.id === a.to);
      if (from && to) drawArrow(from, to, a.color || "#6ea8ff");
    });
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
      btn.addEventListener("click", () => setTool(btn.dataset.tool));
    });

    document.getElementById("fillColor").value = state.fillColor;
    document.getElementById("strokeColor").value = state.strokeColor;
    document.getElementById("strokeWidth").value = state.strokeWidth;
    document.getElementById("fillColor").addEventListener("input", (e) => {
      state.fillColor = e.target.value;
      if (state.selected.size) {
        state.shapes.forEach((s) => { if (state.selected.has(s.id)) s.fill = e.target.value; });
        save(); draw();
      }
    });
    document.getElementById("strokeColor").addEventListener("input", (e) => {
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
