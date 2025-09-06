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
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        draggableCursor: 'pointer',
        mapId: '6D_ADDRESS_CUSTOM_STYLE'
    };
    const mapOptions = { ...defaultMapOptions, ...customOptions };
    return new google.maps.Map(mapElement, mapOptions);
}

/**
 * Generates the 6D code from a lat/lng coordinate, using mathematical truncation.
 * (TR-1: Code Generation Integrity)
 * The code is structured as C2-C4-C6, representing 1-degree, 1.1km, and 11m grids.
 * @param {number} lat The latitude.
 * @param {number} lng The longitude.
 * @returns {object} An object containing the code parts for coloring and the full string.
 */
export function generate6DCode(lat, lng) {
    // Use a 10,000 multiplier to work with integers, avoiding float precision issues.
    const latInt = Math.floor(lat * 10000);
    const lngInt = Math.floor(lng * 10000);

    // 2D Component (1 degree grid, e.g., 51, -1)
    const c2_lat = Math.floor(latInt / 10000);
    const c2_lng = Math.floor(lngInt / 10000);

    // 4D Component (0.01 degree grid, e.g., 45, 99)
    const c4_lat = Math.abs(Math.floor(latInt / 100) % 100);
    const c4_lng = Math.abs(Math.floor(lngInt / 100) % 100);

    // 6D Component (0.0001 degree grid, e.g., 23, 01)
    const c6_lat = Math.abs(latInt % 100);
    const c6_lng = Math.abs(lngInt % 100);

    // Format components with leading zeros for consistency.
    const pad = (num) => String(num).padStart(2, '0');

    const code2D = `${c2_lat}.${c2_lng}`;
    const code4D = `${pad(c4_lat)}.${pad(c4_lng)}`;
    const code6D = `${pad(c6_lat)}.${pad(c6_lng)}`;

    return {
        code2D, // Red
        code4D, // Green
        code6D, // Blue
        fullCode: `${code2D}-${code4D}-${code6D}`
    };
}

/**
 * Snaps a raw click coordinate to the calculated center of its 11m grid cell.
 * (TR-2: Click Handling Consistency)
 * This ensures perfect alignment between the generated code and the visual boxes.
 * @param {google.maps.LatLng} latLng The raw click coordinate from the map event.
 * @returns {google.maps.LatLng} The snapped coordinate, centered in the grid cell.
 */
export function snapToGridCenter(latLng) {
    const lat = latLng.lat();
    const lng = latLng.lng();

    // 1. Find the bottom-left corner of the 0.0001 degree cell.
    const snappedLat = Math.floor(lat * 10000) / 10000;
    const snappedLng = Math.floor(lng * 10000) / 10000;

    // 2. Add half the cell size (0.00005) to get the exact center.
    const centerLat = snappedLat + 0.00005;
    const centerLng = snappedLng + 0.00005;

    return new google.maps.LatLng(centerLat, centerLng);
}

/**
 * Draws the three nested 2D, 4D, and 6D boxes on the map.
 * (FR-S3: Visuals on Click)
 * It also clears any previously drawn boxes.
 * @param {google.maps.Map} map The map instance to draw on.
 * @param {google.maps.LatLng} centerLatLng The SNAPPED center coordinate.
 */
export function drawAddressBoxes(map, centerLatLng) {
    // Clear any rectangles from the previous click
    drawnRectangles.forEach(rect => rect.setMap(null));
    drawnRectangles = [];

    const lat = centerLatLng.lat();
    const lng = centerLatLng.lng();

    // Define the bounds for each box based on its grid size
    const bounds = {
        '2D': {
            north: Math.floor(lat) + 1,
            south: Math.floor(lat),
            east: Math.floor(lng) + 1,
            west: Math.floor(lng)
        },
        '4D': {
            north: Math.floor(lat * 100) / 100 + 0.01,
            south: Math.floor(lat * 100) / 100,
            east: Math.floor(lng * 100) / 100 + 0.01,
            west: Math.floor(lng * 100) / 100
        },
        '6D': {
            north: Math.floor(lat * 10000) / 10000 + 0.0001,
            south: Math.floor(lat * 10000) / 10000,
            east: Math.floor(lng * 10000) / 10000 + 0.0001,
            west: Math.floor(lng * 10000) / 10000
        }
    };

    // Create and style the rectangles as per FR-S3
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
        fillOpacity: 0, // No fill
        map,
        bounds: bounds['4D']
    });

    const box2D = new google.maps.Rectangle({
        strokeColor: '#FF0000', // Red
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillOpacity: 0, // No fill
        map,
        bounds: bounds['2D']
    });

    // Store the new rectangles so they can be cleared on the next click
    drawnRectangles.push(box2D, box4D, box6D);
}

/**
 * Draws the dynamic grid on the map based on zoom level.
 * (FR-S4: Dynamic Grid) - To be implemented
 */
export function drawDynamicGrid(map) {
    console.log("Drawing dynamic grid for current zoom and bounds.");
}