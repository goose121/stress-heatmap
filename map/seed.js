/**
 * Database Seeding Script
 * Creates stress_reports table and populates with test data
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbFilePath = path.join(__dirname, 'data.sqlite');

const MRU_CAMPUS_POLYGON = [
    [-114.13241725830541, 51.01570121296195],
    [-114.12267446381439, 51.01225661725332],
    [-114.12375903330657, 51.011668197055535],
    [-114.12697608177085, 51.01100395607877],
    [-114.1279496147216, 51.010871196610964],
    [-114.12856184446339, 51.010640471958524],
    [-114.12916055470588, 51.01023142276505],
    [-114.12949274226536, 51.00977254805247],
    [-114.12957772037544, 51.009410882686815],
    [-114.12956226972959, 51.008781873551804],
    [-114.1296311757615, 51.00799569543422],
    [-114.13541321345642, 51.00792847501724],
    [-114.1374109007201, 51.00932345864024],
    [-114.14087168274888, 51.00978899694478],
    [-114.1411416565343, 51.01238587337505],
    [-114.13852496651369, 51.01237885769734],
    [-114.1374910996301, 51.01260101359258],
    [-114.13639318782118, 51.01322034640498],
    [-114.13362306987396, 51.01530910192349],
    [-114.13241725830541, 51.01570121296195]
];

const db = new Database(dbFilePath);

console.log('Setting up data.sqlite\n');

/**
 * Create stress_reports table
 */
db.exec(`
    DROP TABLE IF EXISTS stress_reports;

    CREATE TABLE stress_reports (
        ip_address TEXT NOT NULL,
        stress_level INTEGER NOT NULL CHECK(stress_level BETWEEN 1 AND 5),
        longitude REAL NOT NULL,
        latitude REAL NOT NULL,
        datetime TEXT NOT NULL DEFAULT (datetime('now')),
        week_start TEXT NOT NULL,
        PRIMARY KEY (ip_address, week_start)
    );

    CREATE INDEX idx_stress_reports_datetime
    ON stress_reports (datetime)
`);

console.log('Table created/verified');

/**
 * toSqliteUtcDatetime - Converts Date to SQLite UTC datetime format.
 */
function toSqliteUtcDatetime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * getWeekStartUtcDate - Returns YYYY-MM-DD for Sunday of the datetime week in UTC.
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
    utc.setUTCDate(utc.getUTCDate() - day);
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
    const minLng = -114.1412;
    const maxLng = -114.1226;
    const minLat = 51.0079;
    const maxLat = 51.0158;

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