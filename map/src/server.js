/**
 * MRU Stress Heatmap - Backend Server
 */

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, '..', 'data.sqlite');
const db = new Database(DB_PATH);

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
 * Validate expected schema without mutating legacy databases.
 */
function validateSchema() {
    const tableExists = db.prepare(`
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = 'stress_reports'
    `).get();

    if (!tableExists) {
        throw new Error('Missing required table: stress_reports. Run seed.js first.');
    }

    const columns = db.prepare(`PRAGMA table_info(stress_reports)`).all();
    const hasRequiredColumns = ['ip_address', 'stress_level', 'longitude', 'latitude', 'datetime', 'week_start']
        .every((name) => columns.some((column) => column.name === name));
    const hasIpWeekPrimaryKey = columns.some((column) => column.name === 'ip_address' && column.pk === 1)
        && columns.some((column) => column.name === 'week_start' && column.pk === 2);

    if (!hasRequiredColumns || !hasIpWeekPrimaryKey) {
        throw new Error('Unexpected stress_reports schema. Reseed the database with seed.js.');
    }
}

validateSchema();

/**
 * CORS middleware - Allow cross-origin requests
 */
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.static(path.join(__dirname, '..', 'dist')));
app.use(express.json());

/**
 * GET /api/stress-data - Fetch all stress reports
 */
app.get('/api/stress-data', (req, res) => {
    try {
        const query = `
            SELECT stress_level, longitude, latitude, datetime
            FROM stress_reports
        `;
        
        const rows = db.prepare(query).all();
        console.log('Fetched', rows.length, 'records');
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * POST /api/stress-data - Add or update stress report
 * Points are considered the same for the same IP within the same week
 */
app.post('/api/stress-data', (req, res) => {
    const { ip_address, stress_level, longitude, latitude, datetime } = req.body;
    const parsedStress = Number(stress_level);
    const parsedLongitude = Number(longitude);
    const parsedLatitude = Number(latitude);
    
    if (!ip_address || !Number.isFinite(parsedStress) || !Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (parsedStress < 1 || parsedStress > 5) {
        return res.status(400).json({ error: 'Stress level must be between 1 and 5' });
    }

    if (!isPointInPolygon(parsedLongitude, parsedLatitude, MRU_CAMPUS_POLYGON)) {
        console.log('Ignored outside-campus data point');
        return res.json({ success: true, ignored: true });
    }

    const recordDate = datetime ? new Date(datetime) : new Date();
    if (Number.isNaN(recordDate.getTime())) {
        return res.status(400).json({ error: 'Invalid datetime value' });
    }

    const recordDatetime = toSqliteUtcDatetime(recordDate);
    const weekStart = getWeekStartUtcDate(recordDate);
    
    try {
        const query = `
            INSERT INTO stress_reports (ip_address, stress_level, longitude, latitude, datetime, week_start)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(ip_address, week_start)
            DO UPDATE SET
                stress_level = excluded.stress_level,
                longitude = excluded.longitude,
                latitude = excluded.latitude,
                datetime = excluded.datetime
        `;
        
        db.prepare(query).run(ip_address, parsedStress, parsedLongitude, parsedLatitude, recordDatetime, weekStart);
        console.log('Updated stress report record');
        res.json({ success: true });
    } catch (err) {
        console.error('Insert error:', err);
        res.status(500).json({ error: 'Failed to insert data' });
    }
});

app.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
    console.log('Serving from:', path.join(__dirname, '..', 'dist'));
});

/**
 * Graceful shutdown - Close database on exit
 */
process.on('SIGINT', () => {
    console.log('Shutting down');
    db.close();
    process.exit(0);
});