/**
 * Database Seeding Script
 * Creates stress_reports table and populates with test data
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbFilePath = path.join(__dirname, 'data.sqlite');

if (fs.existsSync(dbFilePath)) {
    fs.unlinkSync(dbFilePath);
    console.log('Removed existing data.sqlite');
}

const db = new Database(dbFilePath);

console.log('Setting up data.sqlite\n');

/**
 * Create stress_reports table
 */
db.exec(`
    CREATE TABLE stress_reports (
        ip_address TEXT PRIMARY KEY,
        stress_level INTEGER NOT NULL CHECK(stress_level BETWEEN 1 AND 5),
        longitude REAL NOT NULL,
        latitude REAL NOT NULL,
        datetime TEXT NOT NULL DEFAULT (datetime('now'))
    )
`);

console.log('Table created/verified');

/**
 * randomRecentUtcDatetime - Returns a UTC datetime string within the last N days.
 */
function randomRecentUtcDatetime(maxDaysBack = 14) {
    const nowMs = Date.now();
    const maxBackMs = maxDaysBack * 24 * 60 * 60 * 1000;
    const randomBackMs = Math.floor(Math.random() * maxBackMs);
    const timestamp = new Date(nowMs - randomBackMs);

    // Match SQLite datetime('now') format: YYYY-MM-DD HH:MM:SS (UTC)
    return timestamp.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * generateHotspots - Creates dense clusters of stress reports at specific campus locations
 */
function generateHotspots() {
    const hotspots = [];
    
    const hotspotLocations = [
        { lng: -114.1285, lat: 51.0118, name: 'Library', stress: 5, count: 30 },
        { lng: -114.1270, lat: 51.0130, name: 'Science Wing', stress: 4, count: 25 },
        { lng: -114.1265, lat: 51.0128, name: 'Study Hall', stress: 4, count: 20 },
        { lng: -114.1310, lat: 51.0105, name: 'Main Building', stress: 3, count: 15 },
        { lng: -114.1295, lat: 51.0122, name: 'Student Center', stress: 3, count: 15 },
        { lng: -114.1320, lat: 51.0140, name: 'Recreation Center', stress: 1, count: 20 },
        { lng: -114.1340, lat: 51.0085, name: 'Campus Grounds', stress: 2, count: 15 }
    ];
    
    let ipCounter = 1000;
    
    hotspotLocations.forEach(hotspot => {
        for (let i = 0; i < hotspot.count; i++) {
            const ip = `10.${Math.floor(ipCounter / 255)}.${ipCounter % 255}.${i}`;
            
            const variation = Math.random() < 0.8 ? 0 : (Math.random() < 0.5 ? -1 : 1);
            const stressLevel = Math.max(1, Math.min(5, hotspot.stress + variation));
            
            const longitude = hotspot.lng + (Math.random() - 0.5) * 0.0015;
            const latitude = hotspot.lat + (Math.random() - 0.5) * 0.001;
            
            const datetime = randomRecentUtcDatetime();

            hotspots.push([ip, stressLevel, longitude, latitude, datetime]);
            ipCounter++;
        }
    });
    
    return hotspots;
}

/**
 * generateRandomDataPoints - Generate scattered stress reports across campus
 */
function generateRandomDataPoints(count) {
    const data = [];
    
    const minLng = -114.1380;
    const maxLng = -114.1220;
    const minLat = 51.0070;
    const maxLat = 51.0160;
    
    for (let i = 0; i < count; i++) {
        const ip = `192.168.${Math.floor(i / 255)}.${i % 255}`;
        
        const rand = Math.random() + Math.random() + Math.random();
        const stressLevel = Math.min(5, Math.max(1, Math.floor(rand * 5 / 3) + 1));
        
        const longitude = minLng + Math.random() * (maxLng - minLng);
        const latitude = minLat + Math.random() * (maxLat - minLat);
        
        const datetime = randomRecentUtcDatetime();

        data.push([ip, stressLevel, longitude, latitude, datetime]);
    }
    
    return data;
}

const hotspotData = generateHotspots();
const randomData = generateRandomDataPoints(30);
const testData = [...hotspotData, ...randomData];

const stmt = db.prepare(`
    INSERT OR REPLACE INTO stress_reports (ip_address, stress_level, longitude, latitude, datetime)
    VALUES (?, ?, ?, ?, ?)
`);

testData.forEach(row => {
    stmt.run(row);
});

const rows = db.prepare('SELECT * FROM stress_reports ORDER BY stress_level DESC').all();
console.log(`Total records in database: ${rows.length}`);

console.log('\nSample data (first 5 records):');
console.table(rows.slice(0, 5));

db.close();