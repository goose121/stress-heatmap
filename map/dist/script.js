/**
 * MRU Student Stress Heatmap
 * Open Source mapping module using deck.gl and MapTiler
 */

const { DeckGL, HeatmapLayer } = deck;

const MRU_BOUNDS = {
    minLng: -114.1412,
    minLat: 51.0079,
    maxLng: -114.1226,
    maxLat: 51.0158
};

const CONFIG = {
    POLL_INTERVAL: 10000,
    API_ENDPOINT: '/api/stress-data',
    MAP_STYLE: 'https://api.maptiler.com/maps/019c1bd6-12b7-714c-b6bf-9263d596cb2d/style.json?key=3PX9PsaOURZUbN8IyyTK',
    
    INITIAL_LONGITUDE: -114.130731,
    INITIAL_LATITUDE: 51.011812,
    INITIAL_ZOOM: 15,
    MIN_ZOOM: 15,
    MAX_ZOOM: 19,
    
    HEATMAP_INTENSITY: 1,
    HEATMAP_RADIUS_PIXELS: 20,
    HEATMAP_THRESHOLD: 0.03,
    HEATMAP_OPACITY: 0.8
};

let stressData = [];
let deckInstance = null;
const stressRange = {
    min: 1,
    max: 5
};
const dateRange = {
    start: null,
    end: null
};
let hasInitializedDateRange = false;

/**
 * parseRecordTimestamp - Parses API datetime values into epoch milliseconds
 */
function parseRecordTimestamp(datetimeValue) {
    if (!datetimeValue) return null;

    const raw = String(datetimeValue).trim();
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const parsed = Date.parse(normalized);

    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * parseDateStart - Parses YYYY-MM-DD as local day start
 */
function parseDateStart(value) {
    if (!value) return null;
    const parsed = Date.parse(`${value}T00:00:00`);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * parseDateEnd - Parses YYYY-MM-DD as local day end
 */
function parseDateEnd(value) {
    if (!value) return null;
    const parsed = Date.parse(`${value}T23:59:59.999`);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * toLocalDateInputValue - Converts Date to YYYY-MM-DD using local timezone date parts
 */
function toLocalDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * getStartOfWeek - Returns local Sunday 00:00 for the provided date
 */
function getStartOfWeek(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    return start;
}

/**
 * clampDateToDataBounds - Clamps date to available fetched data bounds
 */
function clampDateToDataBounds(date, minTimestamp, maxTimestamp) {
    const minDate = new Date(minTimestamp);
    const maxDate = new Date(maxTimestamp);
    if (date < minDate) return minDate;
    if (date > maxDate) return maxDate;
    return date;
}

/**
 * matchesFilters - Returns true when a record passes stress and date filters
 */
function matchesFilters(record) {
    const inStressRange = record.stress_level >= stressRange.min && record.stress_level <= stressRange.max;
    if (!inStressRange) return false;

    if (dateRange.start === null && dateRange.end === null) return true;
    if (record.timestamp === null) return false;

    if (dateRange.start !== null && record.timestamp < dateRange.start) return false;
    if (dateRange.end !== null && record.timestamp > dateRange.end) return false;

    return true;
}

/**
 * getFilteredData - Returns records matching all active filters
 */
function getFilteredData() {
    return stressData.filter(matchesFilters);
}

/**
 * aggregateOverlappingPoints - Groups points that share coordinates and averages stress level
 */
function aggregateOverlappingPoints(records) {
    const groupedByPosition = new Map();

    records.forEach((record) => {
        const longitude = Number(record.longitude);
        const latitude = Number(record.latitude);
        const key = `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
        const existing = groupedByPosition.get(key);

        if (existing) {
            existing.totalStress += Number(record.stress_level);
            existing.count += 1;
            return;
        }

        groupedByPosition.set(key, {
            longitude,
            latitude,
            totalStress: Number(record.stress_level),
            count: 1
        });
    });

    return Array.from(groupedByPosition.values()).map((group) => ({
        longitude: group.longitude,
        latitude: group.latitude,
        stress_level: group.totalStress / group.count
    }));
}

/**
 * initSidebarToggle - Wires up collapse/expand behavior for sidebar panel
 */
function initSidebarToggle() {
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    if (!sidebar || !toggleButton) return;

    toggleButton.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        toggleButton.textContent = isCollapsed ? '>' : '<';
        toggleButton.setAttribute('aria-expanded', String(!isCollapsed));
        toggleButton.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });
}

/**
 * constrainViewState - Restricts map view to MRU campus bounds
 */
function constrainViewState(viewState) {
    const { minLng, maxLng, minLat, maxLat } = MRU_BOUNDS;
    
    viewState.longitude = Math.max(minLng, Math.min(maxLng, viewState.longitude));
    viewState.latitude = Math.max(minLat, Math.min(maxLat, viewState.latitude));
    viewState.zoom = Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, viewState.zoom));
    
    return viewState;
}

/**
 * createHeatmapLayer - Creates heatmap layer using Gaussian kernel density estimation
 */
function createHeatmapLayer(records = getFilteredData()) {
    const averagedData = aggregateOverlappingPoints(records);

    return new HeatmapLayer({
        id: 'stress-heatmap',
        data: averagedData,
        
        getPosition: d => [d.longitude, d.latitude],
        getWeight: d => d.stress_level,
        
        aggregation: 'MEAN',
        
        colorRange: [
            [0, 0, 255],
            [0, 255, 0],
            [255, 255, 0],
            [255, 165, 0],
            [255, 0, 0]
        ],
        
        intensity: CONFIG.HEATMAP_INTENSITY,
        radiusPixels: CONFIG.HEATMAP_RADIUS_PIXELS,
        threshold: CONFIG.HEATMAP_THRESHOLD,
        opacity: CONFIG.HEATMAP_OPACITY,
        colorDomain: [1, 5]
    });
}

/**
 * initMap - Initialize deck.gl map instance
 */
function initMap() {
    deckInstance = new DeckGL({
        container: 'map-container',
        mapStyle: CONFIG.MAP_STYLE,
        
        initialViewState: {
            longitude: CONFIG.INITIAL_LONGITUDE,
            latitude: CONFIG.INITIAL_LATITUDE,
            zoom: CONFIG.INITIAL_ZOOM,
            pitch: 0,
            bearing: 0
        },
        
        controller: true,
        onViewStateChange: ({ viewState }) => constrainViewState(viewState),
        layers: [createHeatmapLayer()]
    });
}

/**
 * updateHeatmap - Refresh heatmap with current data
 */
function updateHeatmap() {
    if (!deckInstance) return;

    const filteredData = getFilteredData();

    console.log('Updating heatmap with', filteredData.length, 'filtered data points');
    deckInstance.setProps({ layers: [createHeatmapLayer(filteredData)] });
}

/**
 * updateRangeSelectionBar - Greys out out-of-range sections while keeping gradient static
 */
function updateRangeSelectionBar() {
    const leftMask = document.getElementById('range-mask-left');
    const rightMask = document.getElementById('range-mask-right');
    if (!leftMask || !rightMask) return;

    const minPercent = ((stressRange.min - 1) / 4) * 100;
    const maxPercent = ((stressRange.max - 1) / 4) * 100;

    leftMask.style.left = '0%';
    leftMask.style.right = `${100 - minPercent}%`;

    rightMask.style.left = `${maxPercent}%`;
    rightMask.style.right = '0%';
}

/**
 * updateVisibleCount - Shows filtered point count with total
 */
function updateVisibleCount() {
    const filteredCount = getFilteredData().length;
    document.getElementById('data-count').textContent = `${filteredCount} / ${stressData.length}`;
}

/**
 * initDateRangeControls - Wires up start/end date filters for records
 */
function initDateRangeControls() {
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    const resetButton = document.getElementById('date-reset');
    const thisWeekButton = document.getElementById('date-preset-this-week');
    const thisMonthButton = document.getElementById('date-preset-this-month');
    const lastMonthButton = document.getElementById('date-preset-last-month');

    if (!startInput || !endInput || !resetButton) return;

    const applyDateFilter = () => {
        dateRange.start = parseDateStart(startInput.value);
        dateRange.end = parseDateEnd(endInput.value);

        if (dateRange.start !== null && dateRange.end !== null && dateRange.start > dateRange.end) {
            dateRange.end = dateRange.start;
            endInput.value = startInput.value;
        }

        updateVisibleCount();
        updateHeatmap();
    };

    startInput.addEventListener('change', applyDateFilter);
    endInput.addEventListener('change', applyDateFilter);

    const applyPresetRange = (startDate, endDate) => {
        const timestamps = stressData
            .map((record) => record.timestamp)
            .filter((timestamp) => timestamp !== null);

        if (timestamps.length > 0) {
            const minTimestamp = Math.min(...timestamps);
            const maxTimestamp = Math.max(...timestamps);
            const clampedStart = clampDateToDataBounds(startDate, minTimestamp, maxTimestamp);
            const clampedEnd = clampDateToDataBounds(endDate, minTimestamp, maxTimestamp);

            startInput.value = toLocalDateInputValue(clampedStart);
            endInput.value = toLocalDateInputValue(clampedEnd < clampedStart ? clampedStart : clampedEnd);
        } else {
            startInput.value = toLocalDateInputValue(startDate);
            endInput.value = toLocalDateInputValue(endDate);
        }

        applyDateFilter();
    };

    if (thisWeekButton) {
        thisWeekButton.addEventListener('click', () => {
            const now = new Date();
            const weekStart = getStartOfWeek(now);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            applyPresetRange(weekStart, weekEnd);
        });
    }

    if (thisMonthButton) {
        thisMonthButton.addEventListener('click', () => {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            applyPresetRange(monthStart, monthEnd);
        });
    }

    if (lastMonthButton) {
        lastMonthButton.addEventListener('click', () => {
            const now = new Date();
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            applyPresetRange(lastMonthStart, lastMonthEnd);
        });
    }

    resetButton.addEventListener('click', () => {
        startInput.value = '';
        endInput.value = '';
        dateRange.start = null;
        dateRange.end = null;
        updateVisibleCount();
        updateHeatmap();
    });
}

/**
 * updateDateFilterBounds - Keeps date input bounds aligned with fetched data
 */
function updateDateFilterBounds() {
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    if (!startInput || !endInput) return;

    const timestamps = stressData
        .map((record) => record.timestamp)
        .filter((timestamp) => timestamp !== null);

    if (timestamps.length === 0) {
        startInput.min = '';
        startInput.max = '';
        endInput.min = '';
        endInput.max = '';
        return;
    }

    const minDate = toLocalDateInputValue(new Date(Math.min(...timestamps)));
    const maxDate = toLocalDateInputValue(new Date(Math.max(...timestamps)));
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    startInput.min = minDate;
    startInput.max = maxDate;
    endInput.min = minDate;
    endInput.max = maxDate;

    if (!hasInitializedDateRange) {
        const now = new Date();
        const weekStart = getStartOfWeek(now);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const clampedStart = clampDateToDataBounds(weekStart, minTimestamp, maxTimestamp);
        const clampedEnd = clampDateToDataBounds(weekEnd, minTimestamp, maxTimestamp);

        startInput.value = toLocalDateInputValue(clampedStart);
        endInput.value = toLocalDateInputValue(clampedEnd < clampedStart ? clampedStart : clampedEnd);
        dateRange.start = parseDateStart(startInput.value);
        dateRange.end = parseDateEnd(endInput.value);
        hasInitializedDateRange = true;
    }
}

/**
 * initStressRangeControls - Wires up min/max stress sliders
 */
function initStressRangeControls() {
    const minSlider = document.getElementById('stress-min');
    const maxSlider = document.getElementById('stress-max');

    if (!minSlider || !maxSlider) return;

    minSlider.addEventListener('input', () => {
        stressRange.min = Number(minSlider.value);

        if (stressRange.min > stressRange.max) {
            stressRange.max = stressRange.min;
            maxSlider.value = String(stressRange.max);
        }

        updateRangeSelectionBar();
        updateVisibleCount();
        updateHeatmap();
    });

    maxSlider.addEventListener('input', () => {
        stressRange.max = Number(maxSlider.value);

        if (stressRange.max < stressRange.min) {
            stressRange.min = stressRange.max;
            minSlider.value = String(stressRange.min);
        }

        updateRangeSelectionBar();
        updateVisibleCount();
        updateHeatmap();
    });

    updateRangeSelectionBar();
}

/**
 * fetchStressData - Fetch stress data from API and update visualization
 */
async function fetchStressData() {
    try {
        const response = await fetch(CONFIG.API_ENDPOINT);
        if (!response.ok) throw new Error('HTTP error status: ' + response.status);
        
        const data = await response.json();
        console.log('Received', data.length, 'records');
        
        stressData = data.map((record) => ({
            ...record,
            timestamp: parseRecordTimestamp(record.datetime)
        }));
        updateDateFilterBounds();
        updateHeatmap();
        updateVisibleCount();
        
    } catch (error) {
        console.error('Error fetching stress data:', error);
        document.getElementById('data-count').textContent = 'Error';
    }
}

/**
 * startPolling - Begin periodic data fetching
 */
function startPolling() {
    fetchStressData();
    setInterval(fetchStressData, CONFIG.POLL_INTERVAL);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting MRU Stress Heatmap');
    initSidebarToggle();
    initStressRangeControls();
    initDateRangeControls();
    initMap();
    startPolling();
});