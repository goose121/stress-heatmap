## stress-heatmap | MRU Student Stress Heatmap
# Mapping Module

I was given the task to map data points (IP address, stress level, longitude, latitude) as a heatmap onto MRU.

I started by looking into GIS through QGIS to map the data points and was originally considering a 3D map with height also being mapped, but I quickly realized that was more work and maybe something that could be added later, but not necessary. I also found out about deck.gl and for a bit was comparing using QGIS and deck.gl, but realized learning GIS was a separate skill and outside the needed scope of the project, especially when deck.gl had a heatmap example I could build upon.

I abandoned QGIS and started setting up deck.gl, which I did through **HTML, CSS, JavaScript, and Node.js**. As I was familiar with basic web development, it went pretty well. I did run into trouble setting up the server and client side, but that was honestly me not reading the documentation properly. I created a temporary database and created fake data points. I did use AI (Claude Sonnet 4.5) to make my fake data more realistic and had it create hotspots where data points would cluster. The prompt I used was *"create more realistic datapoint placement"* and I uploaded my original `seed.js` file.

Git branch management was something I ignored as long as possible as I wasn't fully comfortable with it and honestly had forgotten about pushing to Github.

# Run Instructions

From the `map` folder, run:

```bash
npm install
npm run seed
npm start
```

What each command does:

- `npm install`: installs project dependencies.
- `npm run seed`: seeds the SQLite database with sample stress data.
- `npm start`: starts the Express server (`src/server.js`).