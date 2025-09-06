// This module contains the core, shared logic for both the Global and Somalia maps.

// Module-level variable to keep track of drawn map objects for easy clearing.
let drawnRectangles = [];

/**
 * Initializes the base Google Map with shared custom settings.
 * @param {HTMLElement} mapElement The div element where the map will be rendered.
 * @param {object} customOptions Map options specific to the instance (e.g., center, zoom).
 * @returns {google.maps.Map} The initialized Google Map object.
 */
export function initializeBaseMap(mapElement, customOptions) {
    // FR-S2: Define the required custom map navigation and UI settings.
    const defaultMapOptions = {
        // --- FIX APPLIED (FR-S2) ---
        // Disables the default Google UI (Street View, Map/Satellite toggle, etc.).
        disableDefaultUI: true,
        // Ensures only the zoom controls are visible.
        zoomControl: true,
        // Sets a direct and responsive panning motion.
        gestureHandling: 'greedy',
        // Changes the mouse cursor from the default "grab hand" to a standard pointer.
        draggableCursor: 'pointer',
        // --- END OF FIX ---
        mapId: '6D_ADDRESS_CUSTOM_STYLE'
    };
    const mapOptions = { ...defaultMapOptions, ...customOptions };
    return new google.maps.Map(mapElement, mapOptions);
}

/**
 * Generates the 6D code from a lat/lng coordinate, using mathematical truncation.
 * (TR-1: Code Generation Integrity)
 * @param {number} lat The latitude.
 * @param {number} lng The longitude.
 * @returns {object} An object containing the code parts for coloring and the full string.
 */
export function generate6DCode(lat, lng) {
    const latInt = Math.floor(lat * 10000);
    const lngInt = Math.floor(lng * 10000);
    const c2_lat = Math.floor(latInt / 10000);
    const c2_lng = Math.floor(lngInt / 10000);
    const c4_lat = Math.abs(Math.floor(latInt / 100) % 100);
    const c4_lng = Math.abs(Math.floor(lngInt / 100) % 100);
    const c6_lat = Math.abs(latInt % 100);
    const c6_lng = Math.abs(lngInt % 100);
    const pad = (num) => String(num).padStart(2, '0');
    const code2D = `${c2_lat}.${c2_lng}`;
    const code4D = `${pad(c4_lat)}.${pad(c4_lng)}`;
    const code6D = `${pad(c6_lat)}.${pad(c6_lng)}`;
    return {
        code2D,
        code4D,
        code6D,
        fullCode: `${code2D}-${code4D}-${code6D}`
    };
}

/**
 * Snaps a raw click coordinate to the calculated center of its 11m grid cell.
 * (TR-2: Click Handling Consistency)
 * @param {google.maps.LatLng} latLng The raw click coordinate from the map event.
 * @returns {google.maps.LatLng} The snapped coordinate, centered in the grid cell.
 */
export function snapToGridCenter(latLng) {
    const lat = latLng.lat();
    const lng = latLng.lng();
    const snappedLat = Math.floor(lat * 10000) / 10000;
    const snappedLng = Math.floor(lng * 10000) / 10000;
    const centerLat = snappedLat + 0.00005;
    const centerLng = snappedLng + 0.00005;
    return new google.maps.LatLng(centerLat, centerLng);
}

/**
 * Draws the three nested 2D, 4D, and 6D boxes on the map.
 * (FR-S3: Visuals on Click)
 * @param {google.maps.Map} map The map instance to draw on.
 * @param {google.maps.LatLng} centerLatLng The SNAPPED center coordinate.
 */
export function drawAddressBoxes(map, centerLatLng) {
    drawnRectangles.forEach(rect => rect.setMap(null));
    drawnRectangles = [];

    const lat = centerLatLng.lat();
    const lng = centerLatLng.lng();

    // --- FIX APPLIED (Box Sizing Logic) ---
    // The previous logic for 2D and 4D was incorrect. This new logic uses the
    // correct scale for each box to calculate its bottom-left corner ("south" and "west")
    // and then adds the correct grid size to find the top-right corner.

    // 6D Box: 0.0001 degree grid (scale = 10000)
    const south6D = Math.floor(lat * 10000) / 10000;
    const west6D = Math.floor(lng * 10000) / 10000;

    // 4D Box: 0.01 degree grid (scale = 100)
    const south4D = Math.floor(lat * 100) / 100;
    const west4D = Math.floor(lng * 100) / 100;

    // 2D Box: 1 degree grid (scale = 1)
    const south2D = Math.floor(lat);
    const west2D = Math.floor(lng);

    const bounds = {
        '2D': { north: south2D + 1, south: south2D, east: west2D + 1, west: west2D },
        '4D': { north: south4D + 0.01, south: south4D, east: west4D + 0.01, west: west4D },
        '6D': { north: south6D + 0.0001, south: south6D, east: west6D + 0.0001, west: west6D }
    };
    // --- END OF FIX ---

    const box6D = new google.maps.Rectangle({
        strokeColor: '#0000FF', // Blue
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: '#0000FF', // Blue
        fillOpacity: 0.15,
        map,
        bounds: bounds['6D']
    });

    const box4D = new google.maps.Rectangle({
        strokeColor: '#00FF00', // Green
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillOpacity: 0,
        map,
        bounds: bounds['4D']
    });

    const box2D = new google.maps.Rectangle({
        strokeColor: '#FF0000', // Red
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillOpacity: 0,
        map,
        bounds: bounds['2D']
    });

    drawnRectangles.push(box2D, box4D, box6D);
}

/**
 * Draws the dynamic grid on the map based on zoom level.
 * (FR-S4: Dynamic Grid) - To be implemented
 */
export function drawDynamicGrid(map) {
    console.log("Drawing dynamic grid for current zoom and bounds.");
}