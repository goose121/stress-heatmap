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
    [-114.13236048415135, 51.015601290115555],
    [-114.12291537273408, 51.01228879720036],
    [-114.12356570719953, 51.01182553528292],
    [-114.12730806536716, 51.01106093048902],
    [-114.12863221207917, 51.010639016879075],
    [-114.1293741097477, 51.010010293965635],
    [-114.13499620859784, 51.00791230857671],
    [-114.13729462624703, 51.00945214674479],
    [-114.13720000276643, 51.0113932209571],
    [-114.13641114214886, 51.011892595450576],
    [-114.13740498223731, 51.012567090761245],
    [-114.13402403375976, 51.0149920570997],
    [-114.13288616195481, 51.01545876123327]
];

const DEPARTMENT_TO_FACULTY = {
    'Economics, Justice, and Policy Studies': 'Faculty of Arts',
    'English, Languages, and Cultures': 'Faculty of Arts',
    'Humanities': 'Faculty of Arts',
    'Interior Design': 'Faculty of Arts',
    'Psychology': 'Faculty of Arts',
    'Sociology and Anthropology': 'Faculty of Arts',

    'Communication Studies and Aviation': 'Bissett School of Business',
    'Accounting': 'Bissett School of Business',
    'Aviation': 'Bissett School of Business',
    'Aviation Management': 'Bissett School of Business',
    'Finance': 'Bissett School of Business',
    'General Management': 'Bissett School of Business',
    'Human Resources': 'Bissett School of Business',
    'Innovation & Entrepreneurship': 'Bissett School of Business',
    'International Business': 'Bissett School of Business',
    'Marketing': 'Bissett School of Business',
    'Social Innovation': 'Bissett School of Business',
    'Supply Chain Management': 'Bissett School of Business',

    'Broadcast Media Studies': 'School of Communication Studies',
    'Information Design': 'School of Communication Studies',
    'Journalism and Digital Media': 'School of Communication Studies',
    'Public Relations': 'School of Communication Studies',

    'Professional and Continuing Studies': 'Faculty of Continuing Education',
    'The Conservatory': 'Faculty of Continuing Education',
    'Occupational programs': 'Faculty of Continuing Education',
    'Academic Upgrading': 'Faculty of Continuing Education',
    'Transitional Vocational Programs': 'Faculty of Continuing Education',
    'Inclusive Post-Secondary Education': 'Faculty of Continuing Education',

    'Child Studies and Social Work': 'Faculty of Health, Community and Education',
    'Education': 'Faculty of Health, Community and Education',
    'Health and Physical Education': 'Faculty of Health, Community and Education',
    'School of Nursing and Midwifery': 'Faculty of Health, Community and Education',

    'Biology': 'Faculty of Science and Technology',
    'Chemistry and Physics': 'Faculty of Science and Technology',
    'Earth and Environmental Sciences': 'Faculty of Science and Technology',
    'Mathematics and Computing': 'Faculty of Science and Technology'
};

const VALID_DEPARTMENTS = new Set(Object.keys(DEPARTMENT_TO_FACULTY));

function normalizeStressLevel(value) {
    return Number(Number(value).toFixed(2));
}

/**
 * toSqliteUtcDatetime - Converts Date to SQLite UTC datetime format.
 */
function toSqliteUtcDatetime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
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
 * Basic startup check: only verify required tables exist.
 */
function validateSchema() {
    const requiredTables = ['stress_reports', 'display'];
    for (const tableName of requiredTables) {
        const tableExists = db.prepare(`
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = ?
        `).get(tableName);

        if (!tableExists) {
            throw new Error('Missing required table: ' + tableName);
        }
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
            SELECT stress_level, longitude, latitude, week_of, department, faculty
            FROM display
        `;
        
        const rows = db.prepare(query).all();
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

/**
 * POST /api/stress-data - Add or update stress report
 * One submission per user per week in display; same-week submissions override
 */
app.post('/api/stress-data', (req, res) => {
    const {
        ip_address,
        stress_level,
        longitude,
        latitude,
        datetime,
        department
    } = req.body;
    const parsedStress = Number(stress_level);
    const parsedLongitude = Number(longitude);
    const parsedLatitude = Number(latitude);
    
    if (!ip_address || !department || !Number.isFinite(parsedStress) || !Number.isFinite(parsedLongitude) || !Number.isFinite(parsedLatitude)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!VALID_DEPARTMENTS.has(department)) {
        return res.status(400).json({ error: 'Invalid department selection' });
    }
    
    if (parsedStress < 1 || parsedStress > 5) {
        return res.status(400).json({ error: 'Stress level must be between 1.00 and 5.00' });
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

    try {
        const query = `
            INSERT INTO stress_reports (ip_address, stress_level, longitude, latitude, datetime, department)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(ip_address)
            DO UPDATE SET
                stress_level = excluded.stress_level,
                longitude = excluded.longitude,
                latitude = excluded.latitude,
                datetime = excluded.datetime,
                department = excluded.department
        `;
        
        db.prepare(query).run(ip_address, normalizeStressLevel(parsedStress), parsedLongitude, parsedLatitude, recordDatetime, department);
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