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

  // ---------- Section 1: example charts ----------
  function renderExamples() {
    new Chart(document.getElementById("exampleBar"), {
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
    });

    new Chart(document.getElementById("exampleLine"), {
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
    });

    new Chart(document.getElementById("exampleDoughnut"), {
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
    });
  }

  // ---------- Section 2: data explorer ----------
  // Editable dataset: { headers: [string], rows: [[any]] }
  const state = {
    headers: [],
    rows: [],
    colors: [...defaultPalette],
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
    // Pad colors if needed
    while (state.colors.length < Math.max(state.rows.length, 8)) {
      state.colors.push(
        defaultPalette[state.colors.length % defaultPalette.length]
      );
    }
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
    renderAxisSelects();
    renderTable();
    renderExplorerChart();
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
    const ySel = document.getElementById("yAxisSelect");

    const prevX = xSel.value;
    const prevY = ySel.value;

    xSel.innerHTML = "";
    ySel.innerHTML = "";

    state.headers.forEach((h, i) => {
      const xOpt = document.createElement("option");
      xOpt.value = String(i);
      xOpt.textContent = h;
      xSel.appendChild(xOpt);
    });

    const numericCols = numericColumnIndices();
    const yHeaders = numericCols.length > 0 ? numericCols : state.headers.map((_, i) => i);
    yHeaders.forEach((i) => {
      const yOpt = document.createElement("option");
      yOpt.value = String(i);
      yOpt.textContent = state.headers[i];
      ySel.appendChild(yOpt);
    });

    // Preserve selection if still valid, otherwise pick sensible defaults.
    if (prevX && [...xSel.options].some((o) => o.value === prevX)) {
      xSel.value = prevX;
    } else {
      const nonNumeric = state.headers.findIndex((_, i) => !isNumericColumn(i));
      xSel.value = String(nonNumeric >= 0 ? nonNumeric : 0);
    }

    if (prevY && [...ySel.options].some((o) => o.value === prevY)) {
      ySel.value = prevY;
    } else {
      ySel.value = String(numericCols[0] ?? 1 ?? 0);
    }
  }

  // ---------- Rendering: color swatches ----------
  function renderColorSwatches() {
    const wrap = document.getElementById("colorSwatches");
    wrap.innerHTML = "";

    const type = document.getElementById("chartTypeSelect").value;
    // For bar/doughnut, per-row color. For line, a single series color.
    const count = type === "line" ? 1 : Math.max(state.rows.length, 1);

    for (let i = 0; i < count; i++) {
      const swatch = document.createElement("label");
      swatch.className = "swatch";
      swatch.style.background = state.colors[i] || defaultPalette[i % defaultPalette.length];
      swatch.title =
        type === "line"
          ? "Series color"
          : state.rows[i]
            ? `Color for row ${i + 1}`
            : `Color ${i + 1}`;

      const input = document.createElement("input");
      input.type = "color";
      input.value = normalizeHex(state.colors[i] || defaultPalette[i % defaultPalette.length]);
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
  function renderExplorerChart() {
    const xIdx = Number(document.getElementById("xAxisSelect").value);
    const yIdx = Number(document.getElementById("yAxisSelect").value);
    const type = document.getElementById("chartTypeSelect").value;

    if (
      Number.isNaN(xIdx) ||
      Number.isNaN(yIdx) ||
      !state.headers[xIdx] ||
      !state.headers[yIdx] ||
      state.rows.length === 0
    ) {
      if (state.chart) {
        state.chart.destroy();
        state.chart = null;
      }
      document.getElementById("explorerTitle").textContent = "Chart";
      return;
    }

    const labels = state.rows.map((r) => String(r[xIdx] ?? ""));
    const values = state.rows.map((r) => {
      const v = r[yIdx];
      return typeof v === "number" ? v : Number(v) || 0;
    });

    const ctx = document.getElementById("explorerChart");
    if (state.chart) state.chart.destroy();

    const perPoint = type === "bar" || type === "doughnut";
    const colors = labels.map(
      (_, i) => state.colors[i] || defaultPalette[i % defaultPalette.length]
    );
    const seriesColor = state.colors[0] || defaultPalette[0];

    const dataset = {
      label: state.headers[yIdx],
      data: values,
      backgroundColor: perPoint ? colors : hexWithAlpha(seriesColor, 0.18),
      borderColor: perPoint ? (type === "doughnut" ? "#161d3d" : colors) : seriesColor,
      borderWidth: type === "doughnut" ? 2 : 2,
      borderRadius: type === "bar" ? 6 : 0,
      tension: 0.35,
      fill: type === "line",
      pointRadius: type === "line" ? 3 : 0,
      pointBackgroundColor: seriesColor,
    };

    const options =
      type === "doughnut" ? { ...noScaleOptions(), cutout: "60%" } : baseOptions();

    if (type !== "doughnut") {
      options.plugins = {
        ...options.plugins,
        legend: { display: false },
      };
    }

    state.chart = new Chart(ctx, {
      type,
      data: { labels, datasets: [dataset] },
      options,
    });

    document.getElementById("explorerTitle").textContent =
      `${state.headers[yIdx]} by ${state.headers[xIdx]}`;
  }

  function hexWithAlpha(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ---------- Wire-up ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    renderExamples();

    setDataset(SAMPLE);

    // Axis + chart type
    document
      .getElementById("xAxisSelect")
      .addEventListener("change", renderExplorerChart);
    document
      .getElementById("yAxisSelect")
      .addEventListener("change", renderExplorerChart);
    document
      .getElementById("chartTypeSelect")
      .addEventListener("change", () => {
        renderColorSwatches();
        renderExplorerChart();
      });

    // Editor buttons
    document.getElementById("addRowBtn").addEventListener("click", addRow);
    document.getElementById("addColBtn").addEventListener("click", addColumn);
    document
      .getElementById("clearDataBtn")
      .addEventListener("click", () => setDataset(emptyDataset()));
    document
      .getElementById("loadSampleBtn")
      .addEventListener("click", () => setDataset(SAMPLE));

    // CSV upload
    document.getElementById("csvInput").addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => loadFromCSV(String(ev.target.result || ""));
      reader.readAsText(file);
      e.target.value = "";
    });

    // Reset palette
    document.getElementById("resetColorsBtn").addEventListener("click", () => {
      state.colors = [...defaultPalette];
      // pad if needed
      while (state.colors.length < state.rows.length) {
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
