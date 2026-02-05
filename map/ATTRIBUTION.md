
# Attribution

This project makes use of several open-source libraries, tools, and data sources. I acknowledge and thank the contributors and maintainers of the following resources.

---

### Developer
Muhammad Abdullah (https://github.com/Atron1792)

## Visualization & Mapping

### deck.gl
- **Description:** WebGL-powered framework for high-performance data visualization.
- **Usage:** Used to render the stress heatmap via the HeatmapLayer.
- **License:** [MIT License](https://github.com/visgl/deck.gl/blob/master/LICENSE)
- **Source:** https://github.com/visgl/deck.gl
- **Documentation:** https://deck.gl/docs

---

### MapLibre GL JS
- **Description:** Open-source JavaScript library for interactive maps.
- **Usage:** Used as the map rendering engine for displaying the base map and handling map interactions.
- **License:** [BSD 3-Clause License](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt)
- **Source:** https://github.com/maplibre/maplibre-gl-js
- **Documentation:** https://maplibre.org/maplibre-gl-js/docs/

---

### MapTiler
- **Description:** Map tile and style service built on OpenStreetMap data.
- **Usage:** Provides the base map style used in the visualization.
- **License:** MapTiler terms (based on OpenStreetMap data under ODbL).
- **Source:** https://www.maptiler.com/
- **Documentation:** https://docs.maptiler.com/

---

## Backend & Server

### Node.js
- **Description:** JavaScript runtime built on Chrome’s V8 engine.
- **Usage:** Runtime environment for the backend server.
- **License:** [MIT License](https://github.com/nodejs/node/blob/main/LICENSE)
- **Source:** https://nodejs.org/
- **Documentation:** https://nodejs.org/docs/latest/api/

---

### Express.js
- **Description:** Minimal and flexible Node.js web application framework.
- **Usage:** Used to create the backend API and serve static files.
- **License:** [MIT License](https://github.com/expressjs/express/blob/master/LICENSE)
- **Source:** https://github.com/expressjs/express
- **Documentation:** https://expressjs.com/

---

### better-sqlite3
- **Description:** Fast, modern SQLite3 bindings for Node.js.
- **Usage:** Used for local data storage and querying stress reports.
- **License:** [MIT License](https://github.com/WiseLibs/better-sqlite3/blob/master/LICENSE)
- **Source:** https://github.com/WiseLibs/better-sqlite3

---

## Database

### SQLite
- **Description:** Lightweight, serverless SQL database engine.
- **Usage:** Stores stress report data locally.
- **License:** Public Domain
- **Source:** https://www.sqlite.org/

---

## Data Sources

### OpenStreetMap
- **Description:** Open geographic data created and maintained by a global community.
- **Usage:** Base geographic data underlying the map tiles.
- **License:** [Open Database License (ODbL)]( https://www.openstreetmap.org/copyright)
- **Source:** https://www.openstreetmap.org/

---

## Development Assistance

### AI Assistance
- **Tool Used:** Claude Sonnet 4.5 (Anthropic)
- **Usage:** Assisted with generating realistic mock data distributions and refining implementation details.
- **Role:** AI-generated suggestions were reviewed and modified by the developer; final decisions and implementation were human-driven.

---

## License Notice

Unless otherwise stated, original code in this repository is licensed under the **MIT License**.  
Third-party libraries and services retain their respective licenses as noted above.

---

If any attribution is missing or incorrect, please open an issue or submit a pull request.