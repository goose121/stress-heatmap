/**
 * MRU Student Stress Heatmap
 * Open Source mapping module using deck.gl and MapTiler
 */

const { DeckGL, HeatmapLayer } = deck;

const MRU_BOUNDS = {
    minLng: -114.1380,
    minLat: 51.0070,
    maxLng: -114.1220,
    maxLat: 51.0160
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
function createHeatmapLayer() {
    return new HeatmapLayer({
        id: 'stress-heatmap',
        data: stressData,
        
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
        colorDomain: [1, 5],
        pickable: false
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
    
    console.log('Updating heatmap with', stressData.length, 'data points');
    deckInstance.setProps({ layers: [createHeatmapLayer()] });
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
        
        stressData = data;
        updateHeatmap();
        document.getElementById('data-count').textContent = stressData.length;
        
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
    initMap();
    startPolling();
});