// This module contains the core, shared, and proven logic for all maps.

let drawnObjects = [];
let gridLines = [];

/**
 * Initializes a base Google Map with default styling and options.
 * @param {HTMLElement} mapElement The div element to render the map in.
 * @param {object} customOptions Custom Google Maps options to merge with defaults.
 * @returns {google.maps.Map} The initialized map object.
 */
export function initializeBaseMap(mapElement, customOptions) {
    const defaultMapOptions = {
        center: { lat: 2.0469, lng: 45.3182 }, // Default to Mogadishu
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

/**
 * Generates the 6D code and locality suffix from a latitude and longitude.
 * @param {number} lat Latitude.
 * @param {number} lon Longitude.
 * @returns {{code6D: string, localitySuffix: string}}
 */
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

/**
 * Draws the 2D, 4D, and 6D bounding boxes on the map for a given location.
 * @param {google.maps.Map} map The map object.
 * @param {google.maps.LatLng} latLng The location to draw boxes around.
 */
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

/**
 * Draws a dynamic grid on the map that adapts to the zoom level.
 * @param {google.maps.Map} map The map object.
 */
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
    const gridStyle = { strokeColor: '#FFFFFF', strokeOpacity: 0.2, strokeWeight: 1, clickable: false, zIndex: 0 };
    for (let lat = Math.floor(sw.lat() / spacing) * spacing; lat < ne.lat(); lat += spacing) {
        gridLines.push(new google.maps.Polyline({ ...gridStyle, path: [{ lat: lat, lng: sw.lng() }, { lat: lat, lng: ne.lng() }], map: map }));
    }
    for (let lng = Math.floor(sw.lng() / spacing) * spacing; lng < ne.lng(); lng += spacing) {
        gridLines.push(new google.maps.Polyline({ ...gridStyle, path: [{ lat: sw.lat(), lng: lng }, { lat: ne.lat(), lng: lng }], map: map }));
    }
}

// --- START OF THE FIX ---

/**
 * Helper function to find the first matching component based on a priority list.
 * @param {google.maps.GeocoderAddressComponent[]} components - The address components from the API.
 * @param {string[]} hierarchy - An array of types to search for, in order of priority.
 * @returns {string} The long_name of the found component, or an empty string.
 */
function findComponentInHierarchy(components, hierarchy) {
    for (const type of hierarchy) {
        const component = components.find(c => c.types.includes(type));
        if (component) {
            return component.long_name;
        }
    }
    return ''; // Graceful fallback: return empty string if no match is found.
}

/**
 * NEW ROBUST VERSION: Parses Google Geocoding results with a fallback hierarchy.
 * @param {google.maps.GeocoderAddressComponent[]} addressComponents - The components array from a geocoding result.
 * @returns {{district: string, region: string}}
 */
export function parseAddressComponents(addressComponents) {
    // Define the search priority for District and Region.
    const districtHierarchy = ['sublocality', 'locality', 'administrative_area_level_2'];
    const regionHierarchy = ['administrative_area_level_1', 'country'];

    const district = findComponentInHierarchy(addressComponents, districtHierarchy);
    const region = findComponentInHierarchy(addressComponents, regionHierarchy);

    return { district, region };
}

/**
 * Performs a reverse geocode lookup for a given LatLng and returns a structured address.
 * @param {google.maps.LatLng} latLng The location to geocode.
 * @returns {Promise<{code6D: string, localitySuffix: string, district: string, region: string}>}
 */
export async function getAddressForLocation(latLng) {
    const geocoder = new google.maps.Geocoder();
    const { code6D, localitySuffix } = generate6DCode(latLng.lat(), latLng.lng());

    try {
        const response = await geocoder.geocode({ location: latLng });
        if (response.results && response.results.length > 0) {
            const parsed = parseAddressComponents(response.results[0].address_components);
            return {
                code6D,
                localitySuffix,
                district: parsed.district,
                region: parsed.region
            };
        }
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
    }

    // Fallback in case of API error or no results
    return {
        code6D,
        localitySuffix,
        district: '',
        region: 'Unknown Location'
    };
}

// --- END OF THE FIX ---