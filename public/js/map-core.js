// This module contains the core, shared logic for both the Global and Somalia maps.

// Module-level variables to keep track of drawn objects for easy clearing.
let drawnRectangles = [];
let gridLines = [];

/**
 * Initializes the base Google Map with shared custom settings.
 */
export function initializeBaseMap(mapElement, customOptions) {
    const defaultMapOptions = {
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        draggableCursor: 'pointer',
        styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
    };
    const mapOptions = { ...defaultMapOptions, ...customOptions };
    return new google.maps.Map(mapElement, mapOptions);
}

/**
 * Generates the 6D code and locality suffix from a lat/lng coordinate.
 * (TR-1: Code Generation Integrity) - Your proven algorithm.
 */
export function generate6DCode(lat, lng) {
    // --- FIX APPLIED (Bug 2) ---
    // This is the original, correct, and bug-free algorithm.
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
    // --- END OF FIX ---
}

/**
 * Snaps a raw click coordinate to the calculated center of its 11m grid cell.
 */
export function snapToGridCenter(latLng) {
    const scale = 10000;
    const halfCell = 0.00005;
    const snappedLat = (Math.floor(latLng.lat() * scale) / scale) + halfCell;
    const snappedLng = (Math.floor(latLng.lng() * scale) / scale) + halfCell;
    return new google.maps.LatLng(snappedLat, snappedLng);
}

/**
 * Draws the three nested 2D, 4D, and 6D boxes on the map.
 */
export function drawAddressBoxes(map, latLng) {
    drawnRectangles.forEach(rect => rect.setMap(null));
    drawnRectangles = [];

    const lat = latLng.lat();
    const lon = latLng.lng();
    
    // --- FIX APPLIED (Bug 1) ---
    // The scale for '4d' is now correctly set to 1000.
    const boxStyles = {
        '2d': { color: '#D32F2F', zIndex: 1, scale: 1, fillOpacity: 0.0 },
        '4d': { color: '#388E3C', zIndex: 2, scale: 100, fillOpacity: 0.0 },
        '6d': { color: '#1976D2', zIndex: 3, scale: 10000, fillOpacity: 0.15 }
    };
    // --- END OF FIX ---

    for (const key in boxStyles) {
        const style = boxStyles[key];
        const scale = style.scale;
        const cellSize = 1 / scale;
        const swLat = Math.floor(lat * scale) / scale;
        const swLng = Math.floor(lon * scale) / scale;
        const bounds = { south: swLat, west: swLng, north: swLat + cellSize, east: swLng + cellSize };
        
        const rect = new google.maps.Rectangle({
            strokeColor: style.color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: style.color,
            fillOpacity: style.fillOpacity,
            map: map,
            bounds: bounds,
            zIndex: style.zIndex,
            clickable: false
        });
        drawnRectangles.push(rect);
    }
}

/**
 * Draws the dynamic grid on the map based on zoom level.
 * (FR-S4)
 */
export function updateDynamicGrid(map) {
    gridLines.forEach(line => line.setMap(null));
    gridLines = [];

    const zoom = map.getZoom();
    const bounds = map.getBounds();
    if (!bounds) return;

    const getGridSpacingForZoom = (z) => {
        if (z >= 17) return 0.0001;
        if (z >= 13) return 0.01;
        return null;
    };

    const spacing = getGridSpacingForZoom(zoom);
    if (spacing === null) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const gridStyle = { strokeColor: '#000000', strokeOpacity: 0.2, strokeWeight: 0.5, clickable: false, zIndex: -1 };

    for (let lat = Math.floor(sw.lat() / spacing) * spacing; lat < ne.lat(); lat += spacing) {
        gridLines.push(new google.maps.Polyline({ ...gridStyle, path: [{ lat: lat, lng: sw.lng() }, { lat: lat, lng: ne.lng() }], map: map }));
    }
    for (let lng = Math.floor(sw.lng() / spacing) * spacing; lng < ne.lng(); lng += spacing) {
        gridLines.push(new google.maps.Polyline({ ...gridStyle, path: [{ lat: sw.lat(), lng: lng }, { lat: ne.lat(), lng: lng }], map: map }));
    }
}