// This module contains the core, shared, and proven logic for all maps.

let drawnObjects = [];
let gridLines = [];

export function initializeBaseMap(mapElement, customOptions) {
    const defaultMapOptions = {
        center: { lat: 13.7563, lng: 100.5018 },
        zoom: 12,
        styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
        draggableCursor: 'pointer',
        gestureHandling: 'greedy'
    };
    const mapOptions = { ...defaultMapOptions, ...customOptions };
    return new google.maps.Map(mapElement, mapOptions);
}

export function snapToGridCenter(latLng) {
    const scale = 10000;
    const halfCell = 0.00005;
    const snappedLat = (Math.floor(latLng.lat() * scale) / scale) + halfCell;
    const snappedLng = (Math.floor(latLng.lng() * scale) / scale) + halfCell;
    return new google.maps.LatLng(snappedLat, snappedLng);
}

export function generate6DCode(lat, lon) {
    const absLat = Math.abs(lat);
    const absLon = Math.abs(lon);
    const lat_d1 = Math.floor(absLat * 10) % 10;
    const lat_d2 = Math.floor(absLat * 100) % 10;
    const lat_d3 = Math.floor(absLat * 1000) % 10;
    const lat_d4 = Math.floor(absLat * 10000) % 10;
    const lon_d1 = Math.floor(absLon * 10) % 10;
    const lon_d2 = Math.floor(absLon * 100) % 10;
    const lon_d3 = Math.floor(absLon * 1000) % 10;
    const lon_d4 = Math.floor(absLon * 10000) % 10;
    const code6D = `${lat_d2}${lon_d2}-${lat_d3}${lon_d3}-${lat_d4}${lon_d4}`;
    const localitySuffix = `${lat_d1}${lon_d1}`;
    return { code6D, localitySuffix };
}

export function drawAddressBoxes(map, latLng) {
    drawnObjects.forEach(obj => obj.setMap(null));
    drawnObjects = [];

    const lat = latLng.lat();
    const lon = latLng.lng();
    const boxStyles = {
        '2d': { color: '#D32F2F', zIndex: 1, scale: 100,  fillOpacity: 0.0 },
        '4d': { color: '#388E3C', zIndex: 2, scale: 1000, fillOpacity: 0.0 },
        '6d': { color: '#1976D2', zIndex: 3, scale: 10000,fillOpacity: 0.15 }
    };
    for (const key in boxStyles) {
        const style = boxStyles[key];
        const scale = style.scale;
        const cellSize = 1 / scale;
        const swLat = Math.floor(lat * scale) / scale;
        const swLng = Math.floor(lon * scale) / scale;
        const bounds = { south: swLat, west: swLng, north: swLat + cellSize, east: swLng + cellSize };
        const rect = new google.maps.Rectangle({
            strokeColor: style.color, strokeWeight: 2, strokeOpacity: 0.8,
            fillColor: style.color, fillOpacity: style.fillOpacity,
            map: map, bounds: bounds, zIndex: style.zIndex, clickable: false
        });
        drawnObjects.push(rect);
    }
}

export function updateDynamicGrid(map) {
    gridLines.forEach(line => line.setMap(null));
    gridLines = [];
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    if (!bounds) return;
    const getGridSpacingForZoom = (z) => {
        if (z >= 17) return 0.0001;
        else if (z >= 13) return 0.01;
        else return null;
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