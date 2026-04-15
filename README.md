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
   - Pick the labels column and values column
   - Switch between bar, line, and doughnut
   - Customize per-bar / per-slice colors (or the line color) with color pickers

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
