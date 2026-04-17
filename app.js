// DataScope — simplified: showcase + editable data explorer.
(() => {
  const defaultPalette = [
    "#6ea8ff",
    "#8b5cf6",
    "#4ade80",
    "#f472b6",
    "#fbbf24",
    "#22d3ee",
    "#f87171",
    "#a78bfa",
  ];

  // ---------- Shared Chart.js helpers ----------
  function baseOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#c9d1ff", boxWidth: 12, boxHeight: 12 } },
        tooltip: {
          backgroundColor: "rgba(22, 29, 61, 0.95)",
          borderColor: "rgba(110, 168, 255, 0.3)",
          borderWidth: 1,
          titleColor: "#fff",
          bodyColor: "#c9d1ff",
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: { color: "#9aa4c7" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: { color: "#9aa4c7" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    };
  }

  function noScaleOptions() {
    const o = baseOptions();
    delete o.scales;
    return o;
  }

  // ---------- Font ----------
  // Keep showcase charts so font changes propagate to them too.
  const showcaseCharts = [];

  function applyFontDefaults() {
    const familySel = document.getElementById("fontFamilySelect");
    const sizeSel = document.getElementById("fontSizeSelect");
    if (!familySel || !sizeSel) return;
    if (typeof Chart === "undefined") return;
    Chart.defaults.font.family = familySel.value;
    Chart.defaults.font.size = Number(sizeSel.value) || 13;
  }

  // ---------- Section 1: example charts ----------
  function renderExamples() {
    showcaseCharts.push(new Chart(document.getElementById("exampleBar"), {
      type: "bar",
      data: {
        labels: ["Q1", "Q2", "Q3", "Q4"],
        datasets: [
          {
            label: "Revenue",
            data: [42, 58, 51, 73],
            backgroundColor: defaultPalette.slice(0, 4),
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...baseOptions(),
        plugins: {
          ...baseOptions().plugins,
          legend: { display: false },
        },
      },
    }));

    showcaseCharts.push(new Chart(document.getElementById("exampleLine"), {
      type: "line",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [
          {
            label: "Users",
            data: [120, 145, 160, 210, 260, 320],
            borderColor: defaultPalette[0],
            backgroundColor: "rgba(110, 168, 255, 0.18)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      },
      options: {
        ...baseOptions(),
        plugins: {
          ...baseOptions().plugins,
          legend: { display: false },
        },
      },
    }));

    showcaseCharts.push(new Chart(document.getElementById("exampleDoughnut"), {
      type: "doughnut",
      data: {
        labels: ["Organic", "Paid", "Referral", "Social"],
        datasets: [
          {
            data: [48, 22, 18, 12],
            backgroundColor: defaultPalette.slice(0, 4),
            borderColor: "#161d3d",
            borderWidth: 2,
          },
        ],
      },
      options: { ...noScaleOptions(), cutout: "60%" },
    }));
  }

  // ---------- Section 2: data explorer ----------
  // Editable dataset: { headers: [string], rows: [[any]] }
  const state = {
    headers: [],
    rows: [],
    colors: [...defaultPalette],
    seriesIndices: [], // indices of columns currently plotted on the Y axis
    chart: null,
  };

  const SAMPLE = {
    headers: ["Category", "Revenue", "Units"],
    rows: [
      ["Software", 182400, 420],
      ["Services", 96200, 210],
      ["Hardware", 64800, 95],
      ["Training", 38500, 140],
      ["Subscriptions", 121300, 610],
      ["Support", 54700, 330],
    ],
  };

  function emptyDataset() {
    return {
      headers: ["Label", "Value"],
      rows: [
        ["A", 10],
        ["B", 20],
        ["C", 30],
      ],
    };
  }

  function isNumericColumn(headerIndex) {
    return state.rows.every((r) => {
      const v = r[headerIndex];
      return v === "" || v === null || !Number.isNaN(Number(v));
    });
  }

  function numericColumnIndices() {
    return state.headers
      .map((_, i) => i)
      .filter((i) => isNumericColumn(i) && state.rows.length > 0);
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = [];
    let field = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ",") {
          row.push(field);
          field = "";
        } else if (c === "\n" || c === "\r") {
          if (c === "\r" && text[i + 1] === "\n") i++;
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else {
          field += c;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((v) => v !== ""));
  }

  function loadFromCSV(text) {
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      alert("CSV needs at least a header row and one data row.");
      return;
    }
    const headers = parsed[0].map((h) => h.trim() || "Column");
    const rows = parsed.slice(1).map((r) =>
      headers.map((_, i) => {
        const raw = (r[i] ?? "").trim();
        const num = Number(raw);
        return raw !== "" && !Number.isNaN(num) ? num : raw;
      })
    );
    setDataset({ headers, rows });
  }

  // ---------- Dataset mutation ----------
  function setDataset({ headers, rows }) {
    state.headers = [...headers];
    state.rows = rows.map((r) => [...r]);
    // Pad colors if needed (enough for either rows or series cardinality)
    while (state.colors.length < Math.max(state.rows.length, state.headers.length, 8)) {
      state.colors.push(
        defaultPalette[state.colors.length % defaultPalette.length]
      );
    }
    // Default Y series: first numeric column, or first non-X column.
    const numeric = numericColumnIndices();
    state.seriesIndices = numeric.length > 0 ? [numeric[0]] : state.headers.length > 1 ? [1] : [0];
    renderAxisSelects();
    renderTable();
    renderColorSwatches();
    renderExplorerChart();
  }

  function addRow() {
    const newRow = state.headers.map((_, i) => {
      // Default to 0 for numeric-looking columns, empty otherwise.
      const numeric = state.rows.length === 0 || isNumericColumn(i);
      return numeric ? 0 : "";
    });
    // Give the label column a friendly default.
    if (state.headers.length > 0 && state.rows[0]) {
      const labelIdx = state.headers.findIndex((_, i) => !isNumericColumn(i));
      if (labelIdx >= 0) {
        newRow[labelIdx] = `Item ${state.rows.length + 1}`;
      }
    }
    state.rows.push(newRow);
    renderTable();
    renderColorSwatches();
    renderExplorerChart();
  }

  function removeRow(index) {
    state.rows.splice(index, 1);
    renderTable();
    renderColorSwatches();
    renderExplorerChart();
  }

  function addColumn() {
    const name = `Column ${state.headers.length + 1}`;
    state.headers.push(name);
    state.rows.forEach((r) => r.push(0));
    renderAxisSelects();
    renderTable();
    renderExplorerChart();
  }

  function removeColumn(index) {
    if (state.headers.length <= 1) return;
    state.headers.splice(index, 1);
    state.rows.forEach((r) => r.splice(index, 1));
    // Drop removed column from series; shift higher indices down.
    state.seriesIndices = state.seriesIndices
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i));
    if (state.seriesIndices.length === 0) {
      const numeric = numericColumnIndices();
      state.seriesIndices = numeric.length > 0 ? [numeric[0]] : [0];
    }
    renderAxisSelects();
    renderTable();
    renderColorSwatches();
    renderExplorerChart();
  }

  function flipData() {
    // Transpose: rows become columns, columns become rows.
    const fullMatrix = [state.headers, ...state.rows];
    const maxCols = Math.max(...fullMatrix.map((r) => r.length));
    const padded = fullMatrix.map((r) => {
      const row = [...r];
      while (row.length < maxCols) row.push("");
      return row;
    });
    const transposed = padded[0].map((_, c) => padded.map((r) => r[c]));
    const newHeaders = transposed[0].map((v) => String(v));
    const newRows = transposed.slice(1).map((r) =>
      r.map((v) => {
        const num = Number(v);
        return v !== "" && !Number.isNaN(num) ? num : v;
      })
    );
    setDataset({ headers: newHeaders, rows: newRows });
  }

  function updateCell(rowIdx, colIdx, raw) {
    const num = Number(raw);
    state.rows[rowIdx][colIdx] =
      raw !== "" && !Number.isNaN(num) ? num : raw;
    renderExplorerChart();
  }

  function updateHeader(colIdx, value) {
    state.headers[colIdx] = value || `Column ${colIdx + 1}`;
    renderAxisSelects();
    renderExplorerChart();
  }

  // ---------- Rendering: table ----------
  function renderTable() {
    const table = document.getElementById("editorTable");
    table.innerHTML = "";

    // Header row
    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");

    state.headers.forEach((h, colIdx) => {
      const th = document.createElement("th");
      const wrap = document.createElement("div");
      wrap.className = "col-head";

      const input = document.createElement("input");
      input.type = "text";
      input.className = "col-input";
      input.value = h;
      input.setAttribute("aria-label", `Column ${colIdx + 1} name`);
      input.addEventListener("change", (e) =>
        updateHeader(colIdx, e.target.value.trim())
      );
      wrap.appendChild(input);

      if (state.headers.length > 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "col-action";
        btn.title = "Remove column";
        btn.setAttribute("aria-label", `Remove column ${h}`);
        btn.textContent = "×";
        btn.addEventListener("click", () => removeColumn(colIdx));
        wrap.appendChild(btn);
      }

      th.appendChild(wrap);
      trHead.appendChild(th);
    });

    // trailing cell for row actions
    const trailTh = document.createElement("th");
    trailTh.className = "row-action-cell";
    trailTh.setAttribute("aria-label", "Row actions");
    trHead.appendChild(trailTh);

    thead.appendChild(trHead);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    state.rows.forEach((row, rowIdx) => {
      const tr = document.createElement("tr");
      row.forEach((val, colIdx) => {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "text";
        input.className = "cell-input";
        input.value = String(val);
        input.setAttribute(
          "aria-label",
          `${state.headers[colIdx] || "Column"} row ${rowIdx + 1}`
        );
        if (typeof val === "number") input.classList.add("numeric");
        input.addEventListener("change", (e) => {
          updateCell(rowIdx, colIdx, e.target.value);
          if (!Number.isNaN(Number(e.target.value)) && e.target.value !== "") {
            input.classList.add("numeric");
          } else {
            input.classList.remove("numeric");
          }
        });
        td.appendChild(input);
        tr.appendChild(td);
      });

      const actionTd = document.createElement("td");
      actionTd.className = "row-action-cell";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "row-action";
      btn.title = "Remove row";
      btn.setAttribute("aria-label", `Remove row ${rowIdx + 1}`);
      btn.textContent = "×";
      btn.addEventListener("click", () => removeRow(rowIdx));
      actionTd.appendChild(btn);
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    document.getElementById("editorHint").textContent =
      `${state.rows.length} row${state.rows.length === 1 ? "" : "s"} • ${state.headers.length} column${state.headers.length === 1 ? "" : "s"}`;
  }

  // ---------- Rendering: axis selects ----------
  function renderAxisSelects() {
    const xSel = document.getElementById("xAxisSelect");
    const prevX = xSel.value;
    xSel.innerHTML = "";

    state.headers.forEach((h, i) => {
      const xOpt = document.createElement("option");
      xOpt.value = String(i);
      xOpt.textContent = h;
      xSel.appendChild(xOpt);
    });

    if (prevX && [...xSel.options].some((o) => o.value === prevX)) {
      xSel.value = prevX;
    } else {
      const nonNumeric = state.headers.findIndex((_, i) => !isNumericColumn(i));
      xSel.value = String(nonNumeric >= 0 ? nonNumeric : 0);
    }

    renderYPills();
  }

  function renderYPills() {
    const wrap = document.getElementById("yAxisPills");
    wrap.innerHTML = "";

    const numericCols = numericColumnIndices();
    const cols =
      numericCols.length > 0 ? numericCols : state.headers.map((_, i) => i);

    // Clean up stale series indices (columns that no longer exist / are no longer numeric).
    state.seriesIndices = state.seriesIndices.filter((i) => cols.includes(i));
    if (state.seriesIndices.length === 0 && cols.length > 0) {
      state.seriesIndices = [cols[0]];
    }

    cols.forEach((i) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "pill";
      if (state.seriesIndices.includes(i)) pill.classList.add("active");
      pill.textContent = state.headers[i];
      pill.setAttribute("aria-pressed", String(state.seriesIndices.includes(i)));
      pill.addEventListener("click", () => toggleSeries(i));
      wrap.appendChild(pill);
    });
  }

  function toggleSeries(idx) {
    const pos = state.seriesIndices.indexOf(idx);
    if (pos >= 0) {
      // Keep at least one series selected.
      if (state.seriesIndices.length <= 1) return;
      state.seriesIndices.splice(pos, 1);
    } else {
      state.seriesIndices.push(idx);
    }
    renderYPills();
    renderColorSwatches();
    renderExplorerChart();
  }

  // ---------- Rendering: color swatches ----------
  function renderColorSwatches() {
    const wrap = document.getElementById("colorSwatches");
    wrap.innerHTML = "";

    const type = document.getElementById("chartTypeSelect").value;
    const seriesCount = state.seriesIndices.length;
    // One swatch per row only when there's a single series on a per-point type.
    const isPerRow = PER_POINT_TYPES.has(type) && seriesCount === 1;
    const count = isPerRow ? Math.max(state.rows.length, 1) : Math.max(seriesCount, 1);

    for (let i = 0; i < count; i++) {
      const swatch = document.createElement("label");
      swatch.className = "swatch";
      swatch.style.background =
        state.colors[i] || defaultPalette[i % defaultPalette.length];
      swatch.title = isPerRow
        ? state.rows[i]
          ? `Color for row ${i + 1}`
          : `Color ${i + 1}`
        : `Color for ${state.headers[state.seriesIndices[i]] || `series ${i + 1}`}`;

      const input = document.createElement("input");
      input.type = "color";
      input.value = normalizeHex(
        state.colors[i] || defaultPalette[i % defaultPalette.length]
      );
      input.addEventListener("input", (e) => {
        state.colors[i] = e.target.value;
        swatch.style.background = e.target.value;
        renderExplorerChart();
      });
      swatch.appendChild(input);
      wrap.appendChild(swatch);
    }
  }

  function normalizeHex(c) {
    // color inputs only accept #rrggbb
    if (!c) return "#6ea8ff";
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    // named / rgba fallback — just use default
    return "#6ea8ff";
  }

  // ---------- Rendering: chart ----------
  // Types that color each data point individually (categorical look).
  const PER_POINT_TYPES = new Set([
    "bar",
    "bar-horizontal",
    "doughnut",
    "pie",
    "polarArea",
  ]);
  // Types whose Chart.js type is "line" but with tweaks.
  const LINE_VARIANTS = new Set(["line", "line-straight", "line-stepped", "area"]);
  // Types that use no x/y scales.
  const NO_SCALE_TYPES = new Set(["doughnut", "pie", "polarArea", "radar"]);

  // Resolve our UI value into the Chart.js `type` string.
  function resolveChartJsType(uiType) {
    if (uiType === "bar-horizontal" || uiType === "bar") return "bar";
    if (LINE_VARIANTS.has(uiType)) return "line";
    return uiType;
  }

  // Circular types inherently show composition of a single series.
  const SINGLE_SERIES_TYPES = new Set(["doughnut", "pie", "polarArea"]);
  // Types where stacking makes sense.
  const STACKABLE_TYPES = new Set(["bar", "bar-horizontal", "area"]);

  function updateStackToggleVisibility() {
    const uiType = document.getElementById("chartTypeSelect").value;
    const wrap = document.getElementById("stackToggleWrap");
    wrap.hidden = !STACKABLE_TYPES.has(uiType);
  }

  function renderExplorerChart() {
    applyFontDefaults();
    updateStackToggleVisibility();

    const xIdx = Number(document.getElementById("xAxisSelect").value);
    const uiType = document.getElementById("chartTypeSelect").value;

    // Circular types only support one Y column; truncate if the user has more selected.
    const effectiveSeries = SINGLE_SERIES_TYPES.has(uiType)
      ? state.seriesIndices.slice(0, 1)
      : [...state.seriesIndices];

    if (
      Number.isNaN(xIdx) ||
      !state.headers[xIdx] ||
      effectiveSeries.length === 0 ||
      state.rows.length === 0
    ) {
      if (state.chart) {
        state.chart.destroy();
        state.chart = null;
      }
      document.getElementById("explorerTitle").textContent = "Chart";
      return;
    }

    const ctx = document.getElementById("explorerChart");
    if (state.chart) state.chart.destroy();

    const chartJsType = resolveChartJsType(uiType);
    const labels = state.rows.map((r) => String(r[xIdx] ?? ""));
    const seriesCount = effectiveSeries.length;
    const isPerRow = PER_POINT_TYPES.has(uiType) && seriesCount === 1;
    const pointColors = labels.map(
      (_, i) => state.colors[i] || defaultPalette[i % defaultPalette.length]
    );
    const seriesColorFor = (i) =>
      state.colors[i] || defaultPalette[i % defaultPalette.length];
    const stacked =
      STACKABLE_TYPES.has(uiType) &&
      document.getElementById("stackToggle").checked &&
      seriesCount > 1;

    // Base options
    let options = NO_SCALE_TYPES.has(uiType) ? noScaleOptions() : baseOptions();
    // Show the legend whenever there's more than one series, or for shape types.
    const showLegend = seriesCount > 1 || NO_SCALE_TYPES.has(uiType);
    options.plugins = {
      ...options.plugins,
      legend: { display: showLegend, labels: { color: "#c9d1ff" } },
    };
    if (uiType === "bar-horizontal") options.indexAxis = "y";
    if (uiType === "doughnut") options.cutout = "60%";

    // Build datasets, one per selected Y column.
    const buildBar = (yIdx, i) => {
      const color = seriesColorFor(i);
      const values = state.rows.map((r) => Number(r[yIdx]) || 0);
      return {
        label: state.headers[yIdx],
        data: values,
        backgroundColor: isPerRow ? pointColors : color,
        borderColor: isPerRow ? pointColors : color,
        borderWidth: 0,
        borderRadius: 6,
      };
    };

    const buildLine = (yIdx, i, variant) => {
      const color = seriesColorFor(i);
      const values = state.rows.map((r) => Number(r[yIdx]) || 0);
      const ds = {
        label: state.headers[yIdx],
        data: values,
        borderColor: color,
        backgroundColor: hexWithAlpha(color, 0.28),
        pointBackgroundColor: color,
        borderWidth: 2,
        pointRadius: 3,
      };
      if (variant === "line") {
        ds.tension = 0.35;
        ds.fill = false;
      } else if (variant === "line-straight") {
        ds.tension = 0;
        ds.fill = false;
      } else if (variant === "line-stepped") {
        ds.stepped = true;
        ds.fill = false;
      } else if (variant === "area") {
        ds.tension = 0.35;
        ds.fill = stacked ? (i === 0 ? "origin" : "-1") : "origin";
      }
      return ds;
    };

    const buildRadar = (yIdx, i) => {
      const color = seriesColorFor(i);
      const values = state.rows.map((r) => Number(r[yIdx]) || 0);
      return {
        label: state.headers[yIdx],
        data: values,
        borderColor: color,
        backgroundColor: hexWithAlpha(color, 0.25),
        pointBackgroundColor: color,
        borderWidth: 2,
        pointRadius: 3,
        fill: true,
      };
    };

    const buildCircular = (yIdx) => {
      const values = state.rows.map((r) => Number(r[yIdx]) || 0);
      if (uiType === "polarArea") {
        return {
          label: state.headers[yIdx],
          data: values,
          backgroundColor: pointColors.map((c) => hexWithAlpha(c, 0.55)),
          borderColor: pointColors,
          borderWidth: 2,
        };
      }
      return {
        label: state.headers[yIdx],
        data: values,
        backgroundColor: pointColors,
        borderColor: "#161d3d",
        borderWidth: 2,
      };
    };

    let data;

    if (uiType === "scatter") {
      const xNumeric = state.rows.every(
        (r) => r[xIdx] === "" || !Number.isNaN(Number(r[xIdx]))
      );
      const datasets = effectiveSeries.map((yIdx, i) => {
        const color = seriesColorFor(i);
        const points = state.rows.map((r, ri) => ({
          x: xNumeric ? Number(r[xIdx]) || 0 : ri + 1,
          y: Number(r[yIdx]) || 0,
        }));
        return {
          label: state.headers[yIdx],
          data: points,
          showLine: false,
          pointRadius: 5,
          pointHoverRadius: 7,
          backgroundColor: hexWithAlpha(color, 0.75),
          borderColor: color,
        };
      });
      options.scales = {
        x: {
          type: "linear",
          position: "bottom",
          ticks: { color: "#9aa4c7" },
          grid: { color: "rgba(255,255,255,0.05)" },
          title: {
            display: true,
            text: xNumeric ? state.headers[xIdx] : "Row #",
            color: "#9aa4c7",
          },
        },
        y: {
          ticks: { color: "#9aa4c7" },
          grid: { color: "rgba(255,255,255,0.05)" },
          title: {
            display: true,
            text:
              seriesCount === 1 ? state.headers[effectiveSeries[0]] : "Value",
            color: "#9aa4c7",
          },
        },
      };
      data = { datasets };
    } else {
      const datasets = effectiveSeries.map((yIdx, i) => {
        if (uiType === "bar" || uiType === "bar-horizontal") return buildBar(yIdx, i);
        if (LINE_VARIANTS.has(uiType)) return buildLine(yIdx, i, uiType);
        if (uiType === "radar") return buildRadar(yIdx, i);
        if (SINGLE_SERIES_TYPES.has(uiType)) return buildCircular(yIdx);
        return buildBar(yIdx, i); // fallback
      });
      data = { labels, datasets };
    }

    // Apply stacking to the relevant scale.
    if (stacked && options.scales) {
      options.scales = {
        x: { ...options.scales.x, stacked: true },
        y: { ...options.scales.y, stacked: true },
      };
    }

    state.chart = new Chart(ctx, {
      type: chartJsType,
      data,
      options,
    });

    // Title
    const yLabel =
      effectiveSeries.length === 1
        ? state.headers[effectiveSeries[0]]
        : effectiveSeries.length === 2
          ? effectiveSeries.map((i) => state.headers[i]).join(" & ")
          : `${effectiveSeries.length} series`;
    document.getElementById("explorerTitle").textContent =
      `${yLabel} by ${state.headers[xIdx]}`;
  }

  function hexWithAlpha(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ---------- Export ----------
  // Flatten the chart onto a backing canvas with a solid background, so
  // exports look right on any host (light or dark).
  function chartToFlatCanvas(bg = "#161d3d") {
    if (!state.chart) return null;
    const src = state.chart.canvas;
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, 0, 0);
    return out;
  }

  function safeFilename(base) {
    const slug = String(base || "chart")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    return slug || "chart";
  }

  function triggerDownload(href, filename) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function exportPng() {
    const canvas = chartToFlatCanvas();
    if (!canvas) return;
    const name = safeFilename(
      document.getElementById("explorerTitle").textContent
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${name}.png`);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  function exportSvg() {
    const canvas = chartToFlatCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const w = canvas.width;
    const h = canvas.height;
    // Chart.js renders to canvas, so the SVG embeds the rendered PNG as an
    // <image>. The file is a valid, scalable SVG — just not pure vector.
    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<image width="${w}" height="${h}" href="${dataUrl}"/>` +
      `</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const name = safeFilename(
      document.getElementById("explorerTitle").textContent
    );
    triggerDownload(url, `${name}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sendToSlides() {
    const canvas = chartToFlatCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const title = document.getElementById("explorerTitle").textContent || "Chart";
    localStorage.setItem("datascope_chart_to_slides", JSON.stringify({ image: dataUrl, title }));
    window.location.href = "slides.html";
  }

  // ---------- Wire-up ----------
  function onFontChange() {
    applyFontDefaults();
    // Showcase charts created earlier need to pick up the new defaults.
    showcaseCharts.forEach((c) => c.update());
    renderExplorerChart();
  }

  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    applyFontDefaults();
    renderExamples();

    setDataset(SAMPLE);

    // Axis + chart type (Y is handled via the pills UI in toggleSeries)
    document
      .getElementById("xAxisSelect")
      .addEventListener("change", renderExplorerChart);
    document
      .getElementById("chartTypeSelect")
      .addEventListener("change", () => {
        updateStackToggleVisibility();
        renderColorSwatches();
        renderExplorerChart();
      });
    document
      .getElementById("stackToggle")
      .addEventListener("change", renderExplorerChart);

    // Font controls
    document
      .getElementById("fontFamilySelect")
      .addEventListener("change", onFontChange);
    document
      .getElementById("fontSizeSelect")
      .addEventListener("change", onFontChange);

    // Editor buttons
    document.getElementById("addRowBtn").addEventListener("click", addRow);
    document.getElementById("addColBtn").addEventListener("click", addColumn);
    document
      .getElementById("clearDataBtn")
      .addEventListener("click", () => setDataset(emptyDataset()));
    document
      .getElementById("loadSampleBtn")
      .addEventListener("click", () => setDataset(SAMPLE));
    document
      .getElementById("flipDataBtn")
      .addEventListener("click", flipData);

    // CSV upload
    document.getElementById("csvInput").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadFromCSV(String(ev.target.result || ""));
      reader.readAsText(file);
      e.target.value = "";
    });

    // Export
    document.getElementById("exportPngBtn").addEventListener("click", exportPng);
    document.getElementById("exportSvgBtn").addEventListener("click", exportSvg);
    document.getElementById("sendToSlidesBtn").addEventListener("click", sendToSlides);

    // Reset palette
    document.getElementById("resetColorsBtn").addEventListener("click", () => {
      state.colors = [...defaultPalette];
      const needed = Math.max(
        state.rows.length,
        state.seriesIndices.length,
        defaultPalette.length
      );
      while (state.colors.length < needed) {
        state.colors.push(
          defaultPalette[state.colors.length % defaultPalette.length]
        );
      }
      renderColorSwatches();
      renderExplorerChart();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
