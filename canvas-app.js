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
    selected: null,
    pan: { x: 0, y: 0 },
    zoom: 1,
  };

  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  let dragOffset = { x: 0, y: 0 };
  let creating = null; // { type, startX, startY }
  let arrowStart = null; // shape id for arrow source
  let panning = false;
  let panLast = { x: 0, y: 0 };
  let snapGuides = [];
  const SNAP_THRESHOLD = 8;

  let canvas, ctx;

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  // ---------- Persistence ----------
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ shapes: state.shapes, arrows: state.arrows, pan: state.pan, zoom: state.zoom }));
    } catch (_) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.shapes)) state.shapes = data.shapes;
      if (Array.isArray(data.arrows)) state.arrows = data.arrows;
      if (data.pan) state.pan = data.pan;
      if (data.zoom) state.zoom = data.zoom;
    } catch (_) {}
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
    state.shapes.forEach((s) => drawShape(s, s.id === state.selected));

    // Creation preview
    if (creating && creating.type !== "arrow" && creating.w !== undefined) {
      drawShapePreview(creating);
    }

    drawSnapGuides();

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
    ctx.fillStyle = s.fill || "#1d254a";
    ctx.strokeStyle = selected ? "#fbbf24" : (s.stroke || "#6ea8ff");
    ctx.lineWidth = selected ? 2.5 : 1.5;

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

  // ---------- Tool management ----------
  function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });
    const viewport = document.getElementById("viewport");
    if (tool === "select") viewport.style.cursor = "default";
    else if (tool === "arrow") viewport.style.cursor = "crosshair";
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

    const pos = getCanvasPos(e);
    const world = screenToWorld(pos.x, pos.y);

    if (state.tool === "select") {
      const hit = hitTest(world.x, world.y);
      state.selected = hit ? hit.id : null;

      if (hit) {
        dragging = true;
        dragOffset = { x: world.x - hit.x, y: world.y - hit.y };
      } else {
        panning = true;
        panLast = { x: e.clientX, y: e.clientY };
      }
      draw();
    } else if (state.tool === "arrow") {
      const hit = hitTest(world.x, world.y);
      if (hit) {
        arrowStart = hit.id;
        creating = { type: "arrow", currentX: world.x, currentY: world.y };
        state.selected = hit.id;
      }
      draw();
    } else {
      state.selected = null;
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

    if (dragging && state.selected) {
      const shape = state.shapes.find((s) => s.id === state.selected);
      if (shape) {
        shape.x = world.x - dragOffset.x;
        shape.y = world.y - dragOffset.y;
        computeSnap(shape);
        draw();
      }
    } else if (creating) {
      if (creating.type === "arrow") {
        creating.currentX = world.x;
        creating.currentY = world.y;
      } else {
        creating.w = world.x - creating.startX;
        creating.h = world.y - creating.startY;
      }
      draw();
    }
  }

  function onMouseUp(e) {
    if (panning) {
      panning = false;
      save();
      return;
    }

    if (dragging) {
      dragging = false;
      snapGuides = [];
      save();
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
          label: "",
          textColor: "#e7ecff",
          fontSize: 14,
        };
        state.shapes.push(shape);
        state.selected = shape.id;
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
        label: "",
        textColor: "#e7ecff",
        fontSize: 14,
      };
      state.shapes.push(shape);
      state.selected = shape.id;
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
      state.selected = hit.id;
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
  }

  function deleteSelected() {
    if (!state.selected) return;
    state.shapes = state.shapes.filter((s) => s.id !== state.selected);
    state.arrows = state.arrows.filter((a) => a.from !== state.selected && a.to !== state.selected);
    state.selected = null;
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
    const shapes = all ? [...state.shapes] : state.shapes.filter((s) => s.id === state.selected);
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
    const shapes = all ? [...state.shapes] : state.shapes.filter((s) => s.id === state.selected);
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

    // Toolbar
    document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => setTool(btn.dataset.tool));
    });

    document.getElementById("fillColor").value = state.fillColor;
    document.getElementById("strokeColor").value = state.strokeColor;
    document.getElementById("fillColor").addEventListener("input", (e) => {
      state.fillColor = e.target.value;
      if (state.selected) {
        const s = state.shapes.find((sh) => sh.id === state.selected);
        if (s) { s.fill = e.target.value; save(); draw(); }
      }
    });
    document.getElementById("strokeColor").addEventListener("input", (e) => {
      state.strokeColor = e.target.value;
      if (state.selected) {
        const s = state.shapes.find((sh) => sh.id === state.selected);
        if (s) { s.stroke = e.target.value; save(); draw(); }
      }
    });

    document.getElementById("deleteBtn").addEventListener("click", deleteSelected);
    document.getElementById("clearBtn").addEventListener("click", () => {
      if (!confirm("Clear all shapes and arrows?")) return;
      state.shapes = [];
      state.arrows = [];
      state.selected = null;
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
