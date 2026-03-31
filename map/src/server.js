/**
 * MRU Stress Heatmap - Backend Server
 */

const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;

const dbPath = path.join(__dirname, '..', 'data.sqlite');
console.log('Database path:', dbPath);

const db = new Database(dbPath);
console.log('Connected to data.sqlite');

/**
 * Ensure schema includes report timestamp for existing databases.
 */
function ensureSchema() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS stress_reports (
            ip_address TEXT PRIMARY KEY,
            stress_level INTEGER NOT NULL CHECK(stress_level BETWEEN 1 AND 5),
            longitude REAL NOT NULL,
            latitude REAL NOT NULL,
            datetime TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    const columns = db.prepare(`PRAGMA table_info(stress_reports)`).all();
    const hasDatetime = columns.some((column) => column.name === 'datetime');
    const hasReportedAt = columns.some((column) => column.name === 'reported_at');

    if (!hasDatetime) {
        db.exec(`
            ALTER TABLE stress_reports
            ADD COLUMN datetime TEXT
        `);

        if (hasReportedAt) {
            db.exec(`
                UPDATE stress_reports
                SET datetime = reported_at
                WHERE datetime IS NULL
            `);
        }

        db.exec(`
            UPDATE stress_reports
            SET datetime = datetime('now')
            WHERE datetime IS NULL
        `);

        console.log('Added datetime column to stress_reports');
    }
}

ensureSchema();

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
 * Uses REPLACE to update if ip_address exists
 */
app.post('/api/stress-data', (req, res) => {
    const { ip_address, stress_level, longitude, latitude } = req.body;
    
    if (!ip_address || !stress_level || !longitude || !latitude) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (stress_level < 1 || stress_level > 5) {
        return res.status(400).json({ error: 'Stress level must be between 1 and 5' });
    }
    
    try {
        const query = `
            REPLACE INTO stress_reports (ip_address, stress_level, longitude, latitude, datetime)
            VALUES (?, ?, ?, ?, datetime('now'))
        `;
        
        db.prepare(query).run(ip_address, stress_level, longitude, latitude);
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