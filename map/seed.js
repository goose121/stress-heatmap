/**
 * Database Seeding Script
 * Creates stress_reports table and populates with test data
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbFilePath = path.join(__dirname, 'data.sqlite');

if (fs.existsSync(dbFilePath)) {
    try {
        fs.unlinkSync(dbFilePath);
    } catch (error) {
        if (error.code !== 'EBUSY' && error.code !== 'EPERM') {
            throw error;
        }

        console.warn('data.sqlite is in use; seeding in-place without file recreation.');
    }
}

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

const DEPARTMENTS = Object.keys(DEPARTMENT_TO_FACULTY);

const DEPARTMENT_FACULTY_CASE_SQL = DEPARTMENTS.map((department) => {
    const faculty = DEPARTMENT_TO_FACULTY[department];
    return `WHEN '${department.replace(/'/g, "''")}' THEN '${faculty.replace(/'/g, "''")}'`;
}).join('\n                ');

function normalizeStressLevel(value) {
    return Number(Number(value).toFixed(2));
}

const db = new Database(dbFilePath);

console.log('Setting up data.sqlite\n');

db.exec(`
    DROP TABLE IF EXISTS display;
    DROP TABLE IF EXISTS stress_reports;

    CREATE TABLE stress_reports (
        ip_address TEXT NOT NULL,
        stress_level REAL NOT NULL CHECK(
            stress_level BETWEEN 1 AND 5
            AND abs(stress_level - round(stress_level, 2)) < 0.000001
        ),
        longitude REAL NOT NULL,
        latitude REAL NOT NULL,
        datetime TEXT NOT NULL DEFAULT (datetime('now')),
        department TEXT NOT NULL,
        PRIMARY KEY (ip_address)
    );

    CREATE INDEX idx_stress_reports_datetime
    ON stress_reports (datetime);

    CREATE TABLE display (
        ip_address TEXT NOT NULL,
        stress_level REAL NOT NULL CHECK(
            stress_level BETWEEN 1 AND 5
            AND abs(stress_level - round(stress_level, 2)) < 0.000001
        ),
        longitude REAL NOT NULL,
        latitude REAL NOT NULL,
        week_of TEXT NOT NULL,
        department TEXT NOT NULL,
        faculty TEXT NOT NULL CHECK(faculty IN (
            'Bissett School of Business',
            'Faculty of Arts',
            'Faculty of Continuing Education',
            'Faculty of Health, Community and Education',
            'Faculty of Science and Technology',
            'School of Communication Studies'
        )),
        PRIMARY KEY (ip_address, week_of)
    );

    CREATE INDEX idx_display_week_of
    ON display (week_of);

    CREATE INDEX idx_display_department
    ON display (department);

    CREATE TRIGGER trg_stress_reports_ai
    AFTER INSERT ON stress_reports
    BEGIN
        INSERT INTO display (ip_address, stress_level, longitude, latitude, week_of, department, faculty)
        VALUES (
            NEW.ip_address,
            NEW.stress_level,
            NEW.longitude,
            NEW.latitude,
            date(NEW.datetime, '-' || strftime('%w', NEW.datetime) || ' days'),
            NEW.department,
            CASE NEW.department
                ${DEPARTMENT_FACULTY_CASE_SQL}
                ELSE 'Unknown'
            END
        )
        ON CONFLICT(ip_address, week_of)
        DO UPDATE SET
            stress_level = excluded.stress_level,
            longitude = excluded.longitude,
            latitude = excluded.latitude,
            department = excluded.department,
            faculty = excluded.faculty;
    END;

    CREATE TRIGGER trg_stress_reports_au
    AFTER UPDATE ON stress_reports
    BEGIN
        INSERT INTO display (ip_address, stress_level, longitude, latitude, week_of, department, faculty)
        VALUES (
            NEW.ip_address,
            NEW.stress_level,
            NEW.longitude,
            NEW.latitude,
            date(NEW.datetime, '-' || strftime('%w', NEW.datetime) || ' days'),
            NEW.department,
            CASE NEW.department
                ${DEPARTMENT_FACULTY_CASE_SQL}
                ELSE 'Unknown'
            END
        )
        ON CONFLICT(ip_address, week_of)
        DO UPDATE SET
            stress_level = excluded.stress_level,
            longitude = excluded.longitude,
            latitude = excluded.latitude,
            department = excluded.department,
            faculty = excluded.faculty;
    END;

    CREATE TRIGGER trg_stress_reports_ad
    AFTER DELETE ON stress_reports
    BEGIN
        DELETE FROM display
        WHERE ip_address = OLD.ip_address;
    END;
`);

/**
 * toSqliteUtcDatetime - Converts Date to SQLite UTC datetime format.
 */
function toSqliteUtcDatetime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function randomDepartment() {
    return DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
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
    return normalizeStressLevel(Math.max(1, Math.min(5, base + noise)));
}

/**
 * generateHotspots - Creates dense clusters of stress reports at specific campus locations
 */
function generateHotspots(startDate, endDate) {
    const hotspots = [];
    
    const hotspotLocations = [
        { lng: -114.1285, lat: 51.0118, stressBias: 1, count: 220 },
        { lng: -114.1270, lat: 51.0130, stressBias: 1, count: 190 },
        { lng: -114.1265, lat: 51.0128, stressBias: 1, count: 170 },
        { lng: -114.1310, lat: 51.0105, stressBias: 0, count: 130 },
        { lng: -114.1295, lat: 51.0122, stressBias: 0, count: 130 },
        { lng: -114.1320, lat: 51.0140, stressBias: -1, count: 90 },
        { lng: -114.1340, lat: 51.0085, stressBias: -1, count: 70 }
    ];
    
    let ipCounter = 1000;
    
    hotspotLocations.forEach(hotspot => {
        for (let i = 0; i < hotspot.count; i++) {
            const ip = `10.${Math.floor(ipCounter / 255)}.${ipCounter % 255}.${i}`;
            const date = randomUtcDatetimeInRange(startDate, endDate);
            const baselineStress = stressFromDate(date, startDate, endDate);
            const stressLevel = normalizeStressLevel(Math.max(1, Math.min(5, baselineStress + hotspot.stressBias)));
            
            const longitude = hotspot.lng + (Math.random() - 0.5) * 0.0015;
            const latitude = hotspot.lat + (Math.random() - 0.5) * 0.001;
            const datetime = toSqliteUtcDatetime(date);
            const department = randomDepartment();

            hotspots.push([ip, stressLevel, longitude, latitude, datetime, department]);
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
        const department = randomDepartment();

        data.push([ip, stressLevel, longitude, latitude, datetime, department]);
    }
    
    return data;
}

const startDate = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)); // Jan 1, 2026
const endDate = new Date(Date.UTC(2026, 3, 20, 23, 59, 59)); // Apr 20, 2026

const hotspotData = generateHotspots(startDate, endDate);
const randomData = generateRandomDataPoints(700, startDate, endDate);
const testData = [...hotspotData, ...randomData];

const stmt = db.prepare(`
    INSERT INTO stress_reports (ip_address, stress_level, longitude, latitude, datetime, department)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ip_address)
    DO UPDATE SET
        stress_level = excluded.stress_level,
        longitude = excluded.longitude,
        latitude = excluded.latitude,
        datetime = excluded.datetime,
        department = excluded.department
`);

testData.forEach(row => {
    stmt.run(row);
});

const sourceCount = db.prepare('SELECT COUNT(*) AS count FROM stress_reports').get().count;
console.log(`Total records in database: ${sourceCount}`);

const displayCount = db.prepare('SELECT COUNT(*) AS count FROM display').get().count;
console.log(`Total display rows in database: ${displayCount}`);

const rangeCheck = db.prepare(`
    SELECT MIN(datetime) AS min_datetime, MAX(datetime) AS max_datetime
    FROM stress_reports
`).get();
console.log('Date range:', rangeCheck.min_datetime, 'to', rangeCheck.max_datetime);

db.close();