// DataScope — interactive data visualization
// All rendering happens client-side with Chart.js.

(() => {
  const palette = [
    "#6ea8ff",
    "#8b5cf6",
    "#4ade80",
    "#f472b6",
    "#fbbf24",
    "#22d3ee",
    "#f87171",
    "#a78bfa",
  ];

  // ---------- Sample dataset ----------
  const months = [
    "May 2025",
    "Jun 2025",
    "Jul 2025",
    "Aug 2025",
    "Sep 2025",
    "Oct 2025",
    "Nov 2025",
    "Dec 2025",
    "Jan 2026",
    "Feb 2026",
    "Mar 2026",
    "Apr 2026",
  ];

  const revenueSeries = [
    42000, 45500, 48200, 51000, 49800, 56400, 63100, 71200, 68900, 74500,
    80300, 86100,
  ];
  const usersSeries = [
    1120, 1180, 1240, 1330, 1310, 1460, 1620, 1810, 1760, 1895, 2035, 2170,
  ];

  const categoryData = {
    labels: [
      "Software",
      "Services",
      "Hardware",
      "Training",
      "Subscriptions",
      "Support",
    ],
    values: [182400, 96200, 64800, 38500, 121300, 54700],
  };

  const trafficData = {
    labels: ["Organic", "Direct", "Referral", "Social", "Email", "Paid"],
    values: [38, 22, 12, 14, 8, 6],
  };

  const scatterData = Array.from({ length: 24 }, (_, i) => {
    const spend = 500 + i * 250 + Math.random() * 400;
    const conversions =
      spend * 0.08 + Math.random() * 60 - (i > 16 ? i * 3 : 0);
    return { x: Math.round(spend), y: Math.max(20, Math.round(conversions)) };
  });

  // ---------- Helpers ----------
  const fmtCurrency = (v) =>
    "$" + Math.round(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtNumber = (v) => Math.round(v).toLocaleString();
  const pctChange = (a, b) => (b === 0 ? 0 : ((a - b) / b) * 100);

  function defaultChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#c9d1ff", boxWidth: 12, boxHeight: 12 },
        },
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

  function polarOptions() {
    // No axes for doughnut/pie
    const o = defaultChartOptions();
    delete o.scales;
    return o;
  }

  // ---------- KPI ----------
  function setKpis(range = 12) {
    const rev = revenueSeries.slice(-range);
    const usr = usersSeries.slice(-range);

    const totalRev = rev.reduce((a, b) => a + b, 0);
    const totalUsers = usr[usr.length - 1];
    const conversion = 3.6 + (range === 3 ? 0.8 : range === 6 ? 0.4 : 0);
    const session = 6.2 - (range === 3 ? 0.3 : 0);

    // compare to previous equal-length window
    const prevRev = revenueSeries
      .slice(-range * 2, -range)
      .reduce((a, b) => a + b, 0);
    const prevUsr = usersSeries.slice(-range * 2, -range);
    const prevUsers = prevUsr[prevUsr.length - 1] || totalUsers;

    document.querySelector('[data-kpi="revenue"]').textContent =
      fmtCurrency(totalRev);
    document.querySelector('[data-kpi="users"]').textContent =
      fmtNumber(totalUsers);
    document.querySelector('[data-kpi="conversion"]').textContent =
      conversion.toFixed(1) + "%";
    document.querySelector('[data-kpi="session"]').textContent =
      session.toFixed(1) + "m";

    const revDelta = pctChange(totalRev, prevRev || totalRev);
    const usrDelta = pctChange(totalUsers, prevUsers);

    setDelta("revenue", revDelta);
    setDelta("users", usrDelta);
    setDelta("conversion", 4.2);
    setDelta("session", -1.8);
  }

  function setDelta(key, value) {
    const el = document.querySelector(`[data-kpi-delta="${key}"]`);
    if (!el) return;
    const positive = value >= 0;
    el.textContent = (positive ? "+" : "") + value.toFixed(1) + "%";
    el.classList.toggle("positive", positive);
    el.classList.toggle("negative", !positive);
  }

  // ---------- Charts ----------
  let lineChart, barChart, doughnutChart, scatterChart, explorerChart;

  function renderLineChart(range = 12) {
    const ctx = document.getElementById("lineChart");
    const labels = months.slice(-range);
    const revenue = revenueSeries.slice(-range);
    const users = usersSeries.slice(-range);

    const gradientRev = ctx
      .getContext("2d")
      .createLinearGradient(0, 0, 0, 320);
    gradientRev.addColorStop(0, "rgba(110, 168, 255, 0.45)");
    gradientRev.addColorStop(1, "rgba(110, 168, 255, 0)");

    const data = {
      labels,
      datasets: [
        {
          label: "Revenue",
          data: revenue,
          borderColor: palette[0],
          backgroundColor: gradientRev,
          fill: true,
          tension: 0.35,
          yAxisID: "y",
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Users",
          data: users,
          borderColor: palette[1],
          backgroundColor: "rgba(139, 92, 246, 0.1)",
          fill: false,
          tension: 0.35,
          yAxisID: "y1",
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    };

    const options = defaultChartOptions();
    options.interaction = { mode: "index", intersect: false };
    options.scales = {
      x: options.scales.x,
      y: {
        ...options.scales.y,
        position: "left",
        ticks: {
          ...options.scales.y.ticks,
          callback: (v) => "$" + (v / 1000).toFixed(0) + "k",
        },
      },
      y1: {
        position: "right",
        grid: { drawOnChartArea: false },
        ticks: { color: "#9aa4c7" },
      },
    };

    if (lineChart) lineChart.destroy();
    lineChart = new Chart(ctx, { type: "line", data, options });
  }

  function renderBarChart() {
    const ctx = document.getElementById("barChart");
    if (barChart) barChart.destroy();
    barChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: categoryData.labels,
        datasets: [
          {
            label: "Revenue",
            data: categoryData.values,
            backgroundColor: categoryData.labels.map(
              (_, i) => palette[i % palette.length]
            ),
            borderRadius: 6,
          },
        ],
      },
      options: {
        ...defaultChartOptions(),
        plugins: {
          ...defaultChartOptions().plugins,
          legend: { display: false },
        },
      },
    });
  }

  function renderDoughnutChart() {
    const ctx = document.getElementById("doughnutChart");
    if (doughnutChart) doughnutChart.destroy();
    doughnutChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: trafficData.labels,
        datasets: [
          {
            data: trafficData.values,
            backgroundColor: trafficData.labels.map(
              (_, i) => palette[i % palette.length]
            ),
            borderColor: "#161d3d",
            borderWidth: 2,
          },
        ],
      },
      options: {
        ...polarOptions(),
        cutout: "62%",
      },
    });
  }

  function renderScatterChart() {
    const ctx = document.getElementById("scatterChart");
    if (scatterChart) scatterChart.destroy();
    scatterChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Campaign",
            data: scatterData,
            backgroundColor: "rgba(139, 92, 246, 0.7)",
            borderColor: palette[1],
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        ...defaultChartOptions(),
        scales: {
          x: {
            ...defaultChartOptions().scales.x,
            title: {
              display: true,
              text: "Spend ($)",
              color: "#9aa4c7",
            },
            ticks: {
              color: "#9aa4c7",
              callback: (v) => "$" + v.toLocaleString(),
            },
          },
          y: {
            ...defaultChartOptions().scales.y,
            title: {
              display: true,
              text: "Conversions",
              color: "#9aa4c7",
            },
          },
        },
      },
    });
  }

  // ---------- CSV parsing ----------
  // Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes,
  // commas and newlines inside quotes.
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
    // drop trailing empty rows
    return rows.filter((r) => r.some((v) => v !== ""));
  }

  function toDataset(rows) {
    if (rows.length < 2) return null;
    const headers = rows[0].map((h) => h.trim());
    const records = rows.slice(1).map((r) => {
      const obj = {};
      headers.forEach((h, i) => {
        const raw = (r[i] ?? "").trim();
        const num = Number(raw);
        obj[h] = raw !== "" && !Number.isNaN(num) ? num : raw;
      });
      return obj;
    });

    const numericColumns = headers.filter((h) =>
      records.every((r) => r[h] === "" || typeof r[h] === "number")
    );
    return { headers, records, numericColumns };
  }

  // ---------- Explorer ----------
  const state = { dataset: null };

  function populateExplorerOptions(dataset) {
    const xSel = document.getElementById("xAxisSelect");
    const ySel = document.getElementById("yAxisSelect");
    xSel.innerHTML = "";
    ySel.innerHTML = "";

    dataset.headers.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      xSel.appendChild(opt);
    });

    dataset.numericColumns.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      ySel.appendChild(opt);
    });

    // Default selections: first non-numeric column for x, first numeric for y.
    const nonNumeric = dataset.headers.find(
      (h) => !dataset.numericColumns.includes(h)
    );
    xSel.value = nonNumeric || dataset.headers[0];
    ySel.value = dataset.numericColumns[0] || dataset.headers[1] || "";

    xSel.disabled = false;
    ySel.disabled = dataset.numericColumns.length === 0;
  }

  function renderExplorerChart() {
    const dataset = state.dataset;
    if (!dataset) return;

    const xKey = document.getElementById("xAxisSelect").value;
    const yKey = document.getElementById("yAxisSelect").value;
    const type = document.getElementById("chartTypeSelect").value;

    if (!xKey || !yKey) return;

    const labels = dataset.records.map((r) => String(r[xKey]));
    const values = dataset.records.map((r) => {
      const v = r[yKey];
      return typeof v === "number" ? v : Number(v) || 0;
    });

    const ctx = document.getElementById("explorerChart");
    if (explorerChart) explorerChart.destroy();

    const isCategorical = type === "doughnut";
    const colors = labels.map((_, i) => palette[i % palette.length]);

    const data = {
      labels,
      datasets: [
        {
          label: yKey,
          data: values,
          backgroundColor: isCategorical ? colors : palette[0],
          borderColor: isCategorical ? "#161d3d" : palette[0],
          borderWidth: isCategorical ? 2 : 2,
          borderRadius: type === "bar" ? 6 : 0,
          tension: 0.35,
          fill: type === "line" ? false : true,
          pointRadius: type === "line" ? 3 : 0,
        },
      ],
    };

    const options = isCategorical ? polarOptions() : defaultChartOptions();
    if (isCategorical) options.cutout = "60%";

    explorerChart = new Chart(ctx, { type, data, options });

    document.getElementById("explorerTitle").textContent = `${yKey} by ${xKey}`;
    document.getElementById("explorerHint").textContent = `${dataset.records.length} rows • ${dataset.headers.length} columns`;
  }

  function renderPreviewTable(dataset, maxRows = 10) {
    const wrap = document.getElementById("dataPreview");
    const table = document.getElementById("previewTable");
    table.innerHTML = "";

    const thead = document.createElement("thead");
    const trHead = document.createElement("tr");
    dataset.headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      trHead.appendChild(th);
    });
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    dataset.records.slice(0, maxRows).forEach((r) => {
      const tr = document.createElement("tr");
      dataset.headers.forEach((h) => {
        const td = document.createElement("td");
        const v = r[h];
        td.textContent =
          typeof v === "number" ? v.toLocaleString() : String(v);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrap.hidden = false;
  }

  function loadDataset(dataset) {
    state.dataset = dataset;
    populateExplorerOptions(dataset);
    renderExplorerChart();
    renderPreviewTable(dataset);
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target.result || "");
        const rows = parseCSV(text);
        const dataset = toDataset(rows);
        if (!dataset) {
          alert("Could not parse that CSV — is it empty?");
          return;
        }
        loadDataset(dataset);
      } catch (err) {
        console.error(err);
        alert("Failed to parse CSV: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function buildSampleDataset() {
    const headers = ["Month", "Revenue", "Users", "Conversions"];
    const records = months.map((m, i) => ({
      Month: m,
      Revenue: revenueSeries[i],
      Users: usersSeries[i],
      Conversions: Math.round(usersSeries[i] * (0.03 + Math.random() * 0.02)),
    }));
    return {
      headers,
      records,
      numericColumns: ["Revenue", "Users", "Conversions"],
    };
  }

  // ---------- Wire-up ----------
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();

    setKpis(12);
    renderLineChart(12);
    renderBarChart();
    renderDoughnutChart();
    renderScatterChart();

    document.getElementById("rangeSelect").addEventListener("change", (e) => {
      const r = Number(e.target.value);
      setKpis(r);
      renderLineChart(r);
    });

    // Explorer wiring
    const csvInput = document.getElementById("csvInput");
    const fileDrop = document.getElementById("fileDrop");

    csvInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

    ["dragenter", "dragover"].forEach((evt) =>
      fileDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        fileDrop.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      fileDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        fileDrop.classList.remove("dragover");
      })
    );
    fileDrop.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });

    document
      .getElementById("xAxisSelect")
      .addEventListener("change", renderExplorerChart);
    document
      .getElementById("yAxisSelect")
      .addEventListener("change", renderExplorerChart);
    document
      .getElementById("chartTypeSelect")
      .addEventListener("change", renderExplorerChart);

    document
      .getElementById("loadSampleBtn")
      .addEventListener("click", () => loadDataset(buildSampleDataset()));
  }

  // Chart.js is loaded with `defer`, so DOMContentLoaded is safe.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
