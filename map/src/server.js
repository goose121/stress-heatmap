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
            SELECT ip_address, stress_level, longitude, latitude
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
            REPLACE INTO stress_reports (ip_address, stress_level, longitude, latitude)
            VALUES (?, ?, ?, ?)
        `;
        
        db.prepare(query).run(ip_address, stress_level, longitude, latitude);
        console.log('Updated record for IP:', ip_address);
        res.json({ success: true, ip_address: ip_address });
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