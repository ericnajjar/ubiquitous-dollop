# DataScope

A two-section interactive data visualization page. Everything runs in the
browser — there's no build step and no server.

## Sections

1. **Visualize your data** — a short pitch with three example charts
   (bar, line, doughnut) so you can see what kinds of visualizations are
   possible.
2. **Data explorer** — a live chart paired with an editable data grid.
   - Edit any cell, rename columns, add/remove rows and columns
   - Upload a CSV or load the sample dataset
   - Pick one X column (labels) and *multiple* Y columns (values) — each
     Y column becomes its own series
   - Chart types: vertical/horizontal bar, smooth/straight/stepped line,
     area, doughnut, pie, polar area, radar, scatter plot
   - Stack toggle for bar and area with multiple series
   - Pick a font family and size — applies to every chart on the page
   - Customize per-series (or per-row, when single-series) colors
   - Export the chart as PNG or SVG

## Run it

Just open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project layout

| File         | Purpose                                               |
| ------------ | ----------------------------------------------------- |
| `index.html` | Page structure, showcase, and explorer markup         |
| `styles.css` | Dark theme, grid layout, editable-table styling       |
| `app.js`     | Chart.js rendering, CSV parsing, data-editor logic    |
