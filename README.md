# DataScope

An interactive, static data visualization website. Everything runs in the
browser — there's no build step and no server.

## Features

- **KPI dashboard** with range filter (3 / 6 / 12 months)
- **Trend chart** (dual-axis line) for revenue vs. users
- **Category breakdown** (bar + doughnut + scatter)
- **Data explorer** — drop in your own CSV to chart it on the fly
- Fully responsive, dark theme, no external dependencies beyond Chart.js (CDN)

## Run it

Just open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project layout

| File         | Purpose                                               |
| ------------ | ----------------------------------------------------- |
| `index.html` | Page structure, sections, and canvases                |
| `styles.css` | Layout, dark theme, responsive grid                   |
| `app.js`     | Chart.js configuration, CSV parsing, UI interactions  |

## CSV format

The explorer expects the first row to be column headers. Numeric columns are
auto-detected and offered as Y-axis options; any column can be chosen as the
X axis (label).
