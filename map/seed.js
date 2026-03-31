/**
 * Database Seeding Script
 * Creates stress_reports table and populates with test data
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbFilePath = path.join(__dirname, 'data.sqlite');

const MRU_CAMPUS_POLYGON = [
    [-114.1376, 51.0073],
    [-114.1350, 51.0070],
    [-114.1326, 51.0072],
    [-114.1293, 51.0078],
    [-114.1269, 51.0083],
    [-114.1246, 51.0098],
    [-114.1230, 51.0116],
    [-114.1224, 51.0136],
    [-114.1233, 51.0150],
    [-114.1264, 51.0158],
    [-114.1302, 51.0159],
    [-114.1336, 51.0154],
    [-114.1362, 51.0145],
    [-114.1378, 51.0128],
    [-114.1380, 51.0105],
    [-114.1376, 51.0073]
];

const db = new Database(dbFilePath);

console.log('Setting up data.sqlite\n');

/**
 * Create stress_reports table
 */
db.exec(`
    DROP TABLE IF EXISTS stress_reports;

    CREATE TABLE stress_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        stress_level INTEGER NOT NULL CHECK(stress_level BETWEEN 1 AND 5),
        longitude REAL NOT NULL,
        latitude REAL NOT NULL,
        datetime TEXT NOT NULL DEFAULT (datetime('now')),
        week_start TEXT NOT NULL
    );

    CREATE UNIQUE INDEX idx_stress_reports_ip_week
    ON stress_reports (ip_address, week_start)
`);

console.log('Table created/verified');

/**
 * toSqliteUtcDatetime - Converts Date to SQLite UTC datetime format.
 */
function toSqliteUtcDatetime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * getWeekStartUtcDate - Returns YYYY-MM-DD for Monday of the datetime week in UTC.
 */
function getWeekStartUtcDate(date) {
    const utc = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0
    ));

    const day = utc.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    utc.setUTCDate(utc.getUTCDate() + diffToMonday);
    return utc.toISOString().slice(0, 10);
}

/**
 * isPointInPolygon - Ray casting containment check for [lng, lat] polygon.
 */
function isPointInPolygon(longitude, latitude, polygon) {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];

        const intersects = ((yi > latitude) !== (yj > latitude))
            && (longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi);

        if (intersects) inside = !inside;
    }

    return inside;
}

/**
 * randomCampusCoordinate - Returns a random [lng, lat] inside MRU campus polygon.
 */
function randomCampusCoordinate() {
    const minLng = -114.1380;
    const maxLng = -114.1220;
    const minLat = 51.0070;
    const maxLat = 51.0160;

    for (let attempts = 0; attempts < 300; attempts++) {
        const longitude = minLng + Math.random() * (maxLng - minLng);
        const latitude = minLat + Math.random() * (maxLat - minLat);

        if (isPointInPolygon(longitude, latitude, MRU_CAMPUS_POLYGON)) {
            return [longitude, latitude];
        }
    }

    return [-114.130731, 51.011812];
}

/**
 * randomUtcDatetimeInRange - Returns a random UTC datetime between start and end.
 */
function randomUtcDatetimeInRange(startDate, endDate) {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const timestampMs = startMs + Math.floor(Math.random() * (endMs - startMs + 1));
    return new Date(timestampMs);
}

/**
 * stressFromDate - Later dates trend toward higher stress values.
 */
function stressFromDate(date, startDate, endDate) {
    const totalSpan = endDate.getTime() - startDate.getTime();
    const elapsed = date.getTime() - startDate.getTime();
    const progress = totalSpan === 0 ? 1 : Math.max(0, Math.min(1, elapsed / totalSpan));

    // Base rises from ~1 to ~5 over time, then add mild noise.
    const base = 1 + (progress * 4);
    const noise = (Math.random() * 1.4) - 0.7;
    return Math.max(1, Math.min(5, Math.round(base + noise)));
}

/**
 * generateHotspots - Creates dense clusters of stress reports at specific campus locations
 */
function generateHotspots(startDate, endDate) {
    const hotspots = [];
    
    const hotspotLocations = [
        { lng: -114.1285, lat: 51.0118, name: 'Library', stressBias: 1, count: 220 },
        { lng: -114.1270, lat: 51.0130, name: 'Science Wing', stressBias: 1, count: 190 },
        { lng: -114.1265, lat: 51.0128, name: 'Study Hall', stressBias: 1, count: 170 },
        { lng: -114.1310, lat: 51.0105, name: 'Main Building', stressBias: 0, count: 130 },
        { lng: -114.1295, lat: 51.0122, name: 'Student Center', stressBias: 0, count: 130 },
        { lng: -114.1320, lat: 51.0140, name: 'Recreation Center', stressBias: -1, count: 90 },
        { lng: -114.1340, lat: 51.0085, name: 'Campus Grounds', stressBias: -1, count: 70 }
    ];
    
    let ipCounter = 1000;
    
    hotspotLocations.forEach(hotspot => {
        for (let i = 0; i < hotspot.count; i++) {
            const ip = `10.${Math.floor(ipCounter / 255)}.${ipCounter % 255}.${i}`;
            const date = randomUtcDatetimeInRange(startDate, endDate);
            const baselineStress = stressFromDate(date, startDate, endDate);
            const stressLevel = Math.max(1, Math.min(5, baselineStress + hotspot.stressBias));
            
            const longitude = hotspot.lng + (Math.random() - 0.5) * 0.0015;
            const latitude = hotspot.lat + (Math.random() - 0.5) * 0.001;
            const datetime = toSqliteUtcDatetime(date);
            const weekStart = getWeekStartUtcDate(date);

            hotspots.push([ip, stressLevel, longitude, latitude, datetime, weekStart]);
            ipCounter++;
        }
    });
    
    return hotspots;
}

/**
 * generateRandomDataPoints - Generate scattered stress reports across campus
 */
function generateRandomDataPoints(count, startDate, endDate) {
    const data = [];
    
    for (let i = 0; i < count; i++) {
        const ip = `192.168.${Math.floor(i / 255)}.${i % 255}`;
        const date = randomUtcDatetimeInRange(startDate, endDate);
        const stressLevel = stressFromDate(date, startDate, endDate);
        const [longitude, latitude] = randomCampusCoordinate();
        const datetime = toSqliteUtcDatetime(date);
        const weekStart = getWeekStartUtcDate(date);

        data.push([ip, stressLevel, longitude, latitude, datetime, weekStart]);
    }
    
    return data;
}

const startDate = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)); // Jan 1, 2026
const endDate = new Date(Date.UTC(2026, 3, 20, 23, 59, 59)); // Apr 20, 2026

const hotspotData = generateHotspots(startDate, endDate);
const randomData = generateRandomDataPoints(700, startDate, endDate);
const testData = [...hotspotData, ...randomData];

const stmt = db.prepare(`
    INSERT INTO stress_reports (ip_address, stress_level, longitude, latitude, datetime, week_start)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ip_address, week_start)
    DO UPDATE SET
        stress_level = excluded.stress_level,
        longitude = excluded.longitude,
        latitude = excluded.latitude,
        datetime = excluded.datetime
`);

testData.forEach(row => {
    stmt.run(row);
});

const rows = db.prepare('SELECT * FROM stress_reports ORDER BY stress_level DESC').all();
console.log(`Total records in database: ${rows.length}`);

const rangeCheck = db.prepare(`
    SELECT MIN(datetime) AS min_datetime, MAX(datetime) AS max_datetime
    FROM stress_reports
`).get();
console.log('Date range:', rangeCheck.min_datetime, 'to', rangeCheck.max_datetime);

console.log('\nSample data (first 5 records):');
console.table(rows.slice(0, 5));

db.close();