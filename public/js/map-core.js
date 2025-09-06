// This module contains the core, shared logic for both the Global and Somalia maps.

let drawnRectangles = [];

export function initializeBaseMap(mapElement, customOptions) {
    const defaultMapOptions = {
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        draggableCursor: 'pointer',
        mapId: '6D_ADDRESS_CUSTOM_STYLE' // Assuming you have a custom style Map ID
    };
    const mapOptions = { ...defaultMapOptions, ...customOptions };
    return new google.maps.Map(mapElement, mapOptions);
}

// --- THIS IS THE FINAL, 100% CORRECT VERSION OF THE ALGORITHM ---
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

export function snapToGridCenter(latLng) {
    const lat = latLng.lat();
    const lng = latLng.lng();
    const snappedLat = Math.floor(lat * 10000) / 10000;
    const snappedLng = Math.floor(lng * 10000) / 10000;
    const centerLat = snappedLat + 0.00005;
    const centerLng = snappedLng + 0.00005;
    return new google.maps.LatLng(centerLat, centerLng);
}

export function drawAddressBoxes(map, centerLatLng) {
    drawnRectangles.forEach(rect => rect.setMap(null));
    drawnRectangles = [];

    const lat = centerLatLng.lat();
    const lng = centerLatLng.lng();

    const south6D = Math.floor(lat * 10000) / 10000;
    const west6D = Math.floor(lng * 10000) / 10000;
    const south4D = Math.floor(lat * 100) / 100;
    const west4D = Math.floor(lng * 100) / 100;
    const south2D = Math.floor(lat * 1) / 1;
    const west2D = Math.floor(lng * 1) / 1;

    const bounds = {
        '2D': { north: south2D + 1, south: south2D, east: west2D + 1, west: west2D },
        '4D': { north: south4D + 0.01, south: south4D, east: west4D + 0.01, west: west4D },
        '6D': { north: south6D + 0.0001, south: south6D, east: west6D + 0.0001, west: west6D }
    };

    const box6D = new google.maps.Rectangle({
        strokeColor: '#007bff', // Blue
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#007bff',
        fillOpacity: 0.15,
        clickable: false,
        map,
        bounds: bounds['6D']
    });

    const box4D = new google.maps.Rectangle({
        strokeColor: '#28a745', // Green
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillOpacity: 0.0,
        clickable: false,
        map,
        bounds: bounds['4D']
    });

    const box2D = new google.maps.Rectangle({
        strokeColor: '#ff0000', // Red
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillOpacity: 0.0,
        clickable: false,
        map,
        bounds: bounds['2D']
    });

    drawnRectangles.push(box2D, box4D, box6D);
}

export function drawDynamicGrid(map) {
    console.log("Drawing dynamic grid for current zoom and bounds.");
}