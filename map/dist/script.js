/**
 * MRU Student Stress Heatmap
 * Open Source mapping module using deck.gl and MapTiler
 */

const { DeckGL, HeatmapLayer } = deck;

const MRU_BOUNDS = {
    minLng: -114.1410438541962,
    minLat: 51.006873208803576,
    maxLng: -114.11845117560004,
    maxLat: 51.01637355900997
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

const AUTH_CONFIG = {
    USERNAME: 'admin',
    PASSWORD: 'ps'
};

let stressData = [];
let deckInstance = null;
let departmentOptionsSignature = '';
const stressRange = {
    min: 1,
    max: 5
};
const dateRange = {
    start: null,
    end: null
};
const categoryFilters = {
    program: ''
};
let hasInitializedDateRange = false;
let hasStartedApp = false;

function getCookieValue(name) {
    const cookiePrefix = `${name}=`;
    const cookieParts = document.cookie.split(';');

    for (const part of cookieParts) {
        const cookie = part.trim();
        if (cookie.startsWith(cookiePrefix)) {
            return decodeURIComponent(cookie.slice(cookiePrefix.length));
        }
    }

    return '';
}

function setCookieValue(name, value, maxAgeSeconds) {
    const encodedValue = encodeURIComponent(value);
    document.cookie = `${name}=${encodedValue}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function normalizeStressLevel(value) {
    return Number(Number(value).toFixed(2));
}

function clampStressLevel(value) {
    return Math.max(1, Math.min(5, normalizeStressLevel(value)));
}

function readStressInputValue(inputElement, fallbackValue) {
    if (!inputElement) return fallbackValue;

    const parsedValue = Number(inputElement.value);
    return Number.isFinite(parsedValue) ? clampStressLevel(parsedValue) : fallbackValue;
}

function syncStressRangeControls() {
    const minSlider = document.getElementById('stress-min');
    const maxSlider = document.getElementById('stress-max');
    const minInput = document.getElementById('stress-min-input');
    const maxInput = document.getElementById('stress-max-input');

    if (minSlider) {
        minSlider.value = stressRange.min.toFixed(2);
    }

    if (maxSlider) {
        maxSlider.value = stressRange.max.toFixed(2);
    }

    if (minInput) {
        minInput.value = stressRange.min.toFixed(2);
    }

    if (maxInput) {
        maxInput.value = stressRange.max.toFixed(2);
    }
}

function getAvailableTimestamps() {
    return stressData
        .map((record) => record.timestamp)
        .filter((timestamp) => timestamp !== null);
}

function startApp() {
    if (hasStartedApp) return;
    hasStartedApp = true;

    initSidebarToggle();
    initStressRangeControls();
    initDateRangeControls();
    initCategoryFilters();
    initMap();
    startPolling();
}

function initLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    const form = document.getElementById('login-form');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const appShell = document.getElementById('app-shell');

    if (!overlay || !form || !usernameInput || !passwordInput || !appShell) return;

    const setLockedState = (locked) => {
        appShell.classList.toggle('app-shell--locked', locked);
        appShell.setAttribute('aria-hidden', locked ? 'true' : 'false');
    };

    const rememberedUsername = getCookieValue('stress-heatmap-username');
    if (rememberedUsername) {
        usernameInput.value = rememberedUsername;
    }

    setLockedState(true);
    overlay.classList.remove('hidden');

    if (rememberedUsername) {
        passwordInput.focus();
    } else {
        usernameInput.focus();
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const normalizedUsername = usernameInput.value.trim();
        const normalizedPassword = passwordInput.value.trim();

        const hasUsername = normalizedUsername.length > 0;
        const hasPassword = normalizedPassword.length > 0;

        if (!hasUsername || !hasPassword) {
            usernameInput.setCustomValidity('Enter both username and password.');
            passwordInput.setCustomValidity('Enter both username and password.');
            form.reportValidity();
            usernameInput.setCustomValidity('');
            passwordInput.setCustomValidity('');
            return;
        }

        const validCredentials =
            normalizedUsername === AUTH_CONFIG.USERNAME
            && normalizedPassword === AUTH_CONFIG.PASSWORD;

        if (!validCredentials) {
            passwordInput.value = '';
            passwordInput.setCustomValidity('Invalid username or password.');
            form.reportValidity();
            passwordInput.setCustomValidity('');
            passwordInput.focus();
            return;
        }

        setCookieValue('stress-heatmap-username', normalizedUsername, 60 * 60 * 24 * 30);
        overlay.classList.add('hidden');
        setLockedState(false);
        startApp();
    });
}

/**
 * parseWeekOfTimestamp - Parses display.week_of (YYYY-MM-DD) into epoch milliseconds
 */
function parseWeekOfTimestamp(weekOfValue) {
    if (!weekOfValue) return null;

    const raw = String(weekOfValue).trim();
    const parsed = Date.parse(`${raw}T00:00:00`);
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

function getCurrentWeekBounds() {
    const now = new Date();
    const weekStart = getStartOfWeek(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return { weekStart, weekEnd };
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

    if (categoryFilters.program) {
        if (categoryFilters.program.startsWith('faculty:')) {
            const selectedFaculty = categoryFilters.program.slice('faculty:'.length);
            if (record.faculty !== selectedFaculty) return false;
        } else if (categoryFilters.program.startsWith('department:')) {
            const selectedDepartment = categoryFilters.program.slice('department:'.length);
            if (record.department !== selectedDepartment) return false;
        }
    }

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
        stress_level: normalizeStressLevel(group.totalStress / group.count)
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
 * applyFiltersAndRender - Runs filtering once per UI action and updates map + count
 */
function applyFiltersAndRender() {
    const filteredData = getFilteredData();
    if (deckInstance) {
        deckInstance.setProps({ layers: [createHeatmapLayer(filteredData)] });
    }
    document.getElementById('data-count').textContent = `${filteredData.length} / ${stressData.length}`;
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

function refreshCategoryFilterOptions() {
    const departmentSelect = document.getElementById('filter-department');
    if (!departmentSelect) return;

    const groupedDepartments = new Map();

    stressData.forEach((record) => {
        if (!record.faculty || !record.department) return;
        if (!groupedDepartments.has(record.faculty)) {
            groupedDepartments.set(record.faculty, new Set());
        }
        groupedDepartments.get(record.faculty).add(record.department);
    });

    const facultyNames = Array.from(groupedDepartments.keys()).sort((a, b) => a.localeCompare(b));
    const nextSignature = facultyNames
        .map((faculty) => `${faculty}:${Array.from(groupedDepartments.get(faculty)).sort((a, b) => a.localeCompare(b)).join('|')}`)
        .join('||');

    if (nextSignature === departmentOptionsSignature) {
        return;
    }

    departmentOptionsSignature = nextSignature;

    const previous = departmentSelect.value;
    departmentSelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Faculties and Departments';
    departmentSelect.appendChild(allOption);

    facultyNames.forEach((faculty) => {
        const facultyOption = document.createElement('option');
        facultyOption.value = `faculty:${faculty}`;
        facultyOption.textContent = `Faculty: ${faculty}`;
        departmentSelect.appendChild(facultyOption);
    });

    facultyNames.forEach((faculty) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `${faculty} Departments`;

        Array.from(groupedDepartments.get(faculty)).sort((a, b) => a.localeCompare(b)).forEach((department) => {
            const option = document.createElement('option');
            option.value = `department:${department}`;
            option.textContent = department;
            optgroup.appendChild(option);
        });

        departmentSelect.appendChild(optgroup);
    });

    const availableValues = [''];

    facultyNames.forEach((faculty) => {
        availableValues.push(`faculty:${faculty}`);
        Array.from(groupedDepartments.get(faculty)).forEach((department) => {
            availableValues.push(`department:${department}`);
        });
    });

    if (availableValues.includes(previous)) {
        departmentSelect.value = previous;
    }

    if (categoryFilters.program && !availableValues.includes(categoryFilters.program)) {
        categoryFilters.program = '';
        departmentSelect.value = '';
    }
}

function initCategoryFilters() {
    const departmentSelect = document.getElementById('filter-department');
    if (!departmentSelect) return;

    departmentSelect.addEventListener('change', () => {
        categoryFilters.program = departmentSelect.value;
        applyFiltersAndRender();
    });
}

/**
 * initDateRangeControls - Wires up start/end date filters for records
 */
function initDateRangeControls() {
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    const clearButton = document.getElementById('date-preset-clear');
    const thisWeekButton = document.getElementById('date-preset-this-week');
    const thisMonthButton = document.getElementById('date-preset-this-month');
    const lastMonthButton = document.getElementById('date-preset-last-month');

    if (!startInput || !endInput || !clearButton) return;

    const applyDateFilter = () => {
        dateRange.start = parseDateStart(startInput.value);
        dateRange.end = parseDateEnd(endInput.value);

        if (dateRange.start !== null && dateRange.end !== null && dateRange.start > dateRange.end) {
            dateRange.end = dateRange.start;
            endInput.value = startInput.value;
        }

        applyFiltersAndRender();
    };

    startInput.addEventListener('change', applyDateFilter);
    endInput.addEventListener('change', applyDateFilter);

    const applyPresetRange = (startDate, endDate) => {
        const timestamps = getAvailableTimestamps();

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
            const { weekStart, weekEnd } = getCurrentWeekBounds();
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

    clearButton.addEventListener('click', () => {
        startInput.value = '';
        endInput.value = '';
        dateRange.start = null;
        dateRange.end = null;
        applyFiltersAndRender();
    });
}

/**
 * updateDateFilterBounds - Keeps date input bounds aligned with fetched data
 */
function updateDateFilterBounds() {
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    if (!startInput || !endInput) return;

    const setCurrentWeekRange = () => {
        const { weekStart, weekEnd } = getCurrentWeekBounds();
        startInput.value = toLocalDateInputValue(weekStart);
        endInput.value = toLocalDateInputValue(weekEnd);
        dateRange.start = parseDateStart(startInput.value);
        dateRange.end = parseDateEnd(endInput.value);
    };

    const timestamps = getAvailableTimestamps();

    if (timestamps.length === 0) {
        startInput.min = '';
        startInput.max = '';
        endInput.min = '';
        endInput.max = '';

        if (!hasInitializedDateRange) {
            setCurrentWeekRange();
            hasInitializedDateRange = true;
        }
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
        const { weekStart, weekEnd } = getCurrentWeekBounds();

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
    const minInput = document.getElementById('stress-min-input');
    const maxInput = document.getElementById('stress-max-input');

    if (!minSlider || !maxSlider || !minInput || !maxInput) return;

    const baseStep = 0.01;

    const getModifierDelta = (event) => {
        if (event?.ctrlKey) return 0.5;
        if (event?.shiftKey) return 0.1;
        return baseStep;
    };

    const handleMinimumChange = (value) => {
        stressRange.min = clampStressLevel(value);

        if (stressRange.min > stressRange.max) {
            stressRange.max = stressRange.min;
        }

        syncStressRangeControls();
        updateRangeSelectionBar();
        applyFiltersAndRender();
    };

    const handleMaximumChange = (value) => {
        stressRange.max = clampStressLevel(value);

        if (stressRange.max < stressRange.min) {
            stressRange.min = stressRange.max;
        }

        syncStressRangeControls();
        updateRangeSelectionBar();
        applyFiltersAndRender();
    };

    const handleModifiedPointerStep = (event, currentValue, applyValue) => {
        const delta = getModifierDelta(event);
        if (delta === baseStep) return;

        const target = event.currentTarget;
        if (!target) return;

        // For number inputs, only hijack clicks on the spinner affordance.
        if (target.type === 'number') {
            const rect = target.getBoundingClientRect();
            const spinnerWidth = Math.min(24, rect.width * 0.35);
            const clickedSpinner = event.clientX >= (rect.right - spinnerWidth);
            if (!clickedSpinner) return;

            event.preventDefault();
            const direction = event.clientY < (rect.top + rect.height / 2) ? 1 : -1;
            applyValue(currentValue() + (direction * delta));
            return;
        }

        // For range sliders, interpret click side relative to current thumb position.
        if (target.type === 'range') {
            const rect = target.getBoundingClientRect();
            const clickRatio = (event.clientX - rect.left) / Math.max(rect.width, 1);
            const currentRatio = (currentValue() - 1) / 4;
            const direction = clickRatio >= currentRatio ? 1 : -1;
            event.preventDefault();
            applyValue(currentValue() + (direction * delta));
        }
    };

    const handleModifiedArrowStep = (event, currentValue, applyValue) => {
        if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;

        const delta = getModifierDelta(event);
        if (delta === baseStep) return;

        event.preventDefault();
        const direction = (event.key === 'ArrowUp' || event.key === 'ArrowRight') ? 1 : -1;
        applyValue(currentValue() + (direction * delta));
    };

    minSlider.addEventListener('input', () => {
        handleMinimumChange(minSlider.value);
    });

    maxSlider.addEventListener('input', () => {
        handleMaximumChange(maxSlider.value);
    });

    minInput.addEventListener('input', () => {
        handleMinimumChange(readStressInputValue(minInput, stressRange.min));
    });

    maxInput.addEventListener('input', () => {
        handleMaximumChange(readStressInputValue(maxInput, stressRange.max));
    });

    minSlider.addEventListener('pointerdown', (event) => {
        handleModifiedPointerStep(event, () => stressRange.min, handleMinimumChange);
    });
    maxSlider.addEventListener('pointerdown', (event) => {
        handleModifiedPointerStep(event, () => stressRange.max, handleMaximumChange);
    });

    minInput.addEventListener('pointerdown', (event) => {
        handleModifiedPointerStep(event, () => stressRange.min, handleMinimumChange);
    });
    maxInput.addEventListener('pointerdown', (event) => {
        handleModifiedPointerStep(event, () => stressRange.max, handleMaximumChange);
    });

    minSlider.addEventListener('keydown', (event) => {
        handleModifiedArrowStep(event, () => stressRange.min, handleMinimumChange);
    });
    maxSlider.addEventListener('keydown', (event) => {
        handleModifiedArrowStep(event, () => stressRange.max, handleMaximumChange);
    });
    minInput.addEventListener('keydown', (event) => {
        handleModifiedArrowStep(event, () => stressRange.min, handleMinimumChange);
    });
    maxInput.addEventListener('keydown', (event) => {
        handleModifiedArrowStep(event, () => stressRange.max, handleMaximumChange);
    });

    syncStressRangeControls();
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
        
        stressData = data.map((record) => ({
            ...record,
            timestamp: parseWeekOfTimestamp(record.week_of)
        }));
        refreshCategoryFilterOptions();
        updateDateFilterBounds();
        applyFiltersAndRender();
        
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
    initLoginOverlay();
});