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
 * Generates the 6D code and locality suffix from a lat/lng coordinate.
 * (TR-1: Code Generation Integrity)
 * @param {number} lat The latitude.
 * @param {number} lng The longitude.
 * @returns {object} An object containing the code6D string and the localitySuffix.
 */
export function generate6DCode(lat, lng) {
    const absLat = Math.abs(lat);
    const absLng = Math.abs(lng);

    const lat_d1 = Math.floor(absLat * 10) % 10;
    const lat_d2 = Math.floor(absLat * 100) % 10;
    const lat_d3 = Math.floor(absLat * 1000) % 10;
    const lat_d4 = Math.floor(absLat * 10000) % 10;

    const lon_d1 = Math.floor(absLng * 10) % 10;
    const lon_d2 = Math.floor(absLng * 100) % 10;
    const lon_d3 = Math.floor(absLng * 1000) % 10;
    const lon_d4 = Math.floor(absLng * 10000) % 10;

    const code6D = `${lat_d2}${lon_d2}-${lat_d3}${lon_d3}-${lat_d4}${lon_d4}`;
    const localitySuffix = `${lat_d1}${lon_d1}`;
    
    return { code6D, localitySuffix };
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

    // DEFINE SCALES
    const scale6D = 10000;
    const scale4D = 100;
    const scale2D = 1;

    // CALCULATE BOUNDS USING THE CORRECT FORMULA FOR ALL BOXES
    const south6D = Math.floor(lat * scale6D) / scale6D;
    const west6D = Math.floor(lng * scale6D) / scale6D;

    const south4D = Math.floor(lat * scale4D) / scale4D;
    const west4D = Math.floor(lng * scale4D) / scale4D;

    const south2D = Math.floor(lat * scale2D) / scale2D;
    const west2D = Math.floor(lng * scale2D) / scale2D;

    const bounds = {
        '2D': { north: south2D + (1/scale2D), south: south2D, east: west2D + (1/scale2D), west: west2D },
        '4D': { north: south4D + (1/scale4D), south: south4D, east: west4D + (1/scale4D), west: west4D },
        '6D': { north: south6D + (1/scale6D), south: south6D, east: west6D + (1/scale6D), west: westD }
    };

    // DRAW RECTANGLES
    const box2D = new google.maps.Rectangle({
        strokeColor: '#FF0000', strokeWeight: 2, strokeOpacity: 0.8, fillOpacity: 0.0, clickable: false, map, bounds: bounds['2D']
    });

    const box4D = new google.maps.Rectangle({
        strokeColor: '#28a745', strokeWeight: 2, strokeOpacity: 0.8, fillOpacity: 0.0, clickable: false, map, bounds: bounds['4D']
    });

    const box6D = new google.maps.Rectangle({
        strokeColor: '#007bff', strokeWeight: 2, strokeOpacity: 0.8, fillColor: '#007bff', fillOpacity: 0.15, clickable: false, map, bounds: bounds['6D']
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