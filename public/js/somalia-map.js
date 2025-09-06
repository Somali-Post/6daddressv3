// Main script for the Somalia Registration Map (somalia.html).
import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI } from './utils.js';
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';

// --- Module-level variables ---
let map;
let geocoder;
let somaliaPolygon; // To hold the Google Maps Polygon for Somalia's border.

// --- DOM Element References ---
// We cache these for performance to avoid repeated DOM queries.
const sidebar = document.getElementById('registration-sidebar');
// NOTE: We will need to add these IDs to the sidebar HTML in a future step.
// For now, this script is ready for them.
const sidebar6dCodeElement = document.getElementById('sidebar-6d-code');
const sidebarNeighbourhoodElement = document.getElementById('sidebar-neighbourhood');
const sidebarDistrictElement = document.getElementById('sidebar-district');


/**
 * Fetches the Somalia GeoJSON data and creates an invisible polygon for boundary checks.
 */
async function loadSomaliaBoundary() {
    try {
        const response = await fetch('/data/somalia.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const geoJson = await response.json();

        // GeoJSON coordinates are [lng, lat]. Google Maps needs {lat, lng}.
        // We only care about the first feature's polygon coordinates.
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(coord => ({
            lat: coord[1],
            lng: coord[0]
        }));

        // Create the polygon but don't display it on the map.
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates, visible: false });
        console.log("Somalia boundary loaded successfully.");

    } catch (error) {
        console.error("Failed to load or process Somalia boundary GeoJSON:", error);
        // Inform the user that a critical feature is unavailable.
        alert("Error: Could not load country boundary. Address registration is disabled.");
    }
}

/**
 * Parses the address components from a geocoding result to find the best
 * names for Neighbourhood and District, as required for the Somalia format.
 * @param {google.maps.GeocoderAddressComponent[]} addressComponents
 * @returns {{neighbourhood: string, district: string}}
 */
function parseSomaliaAddress(addressComponents) {
    let neighbourhood = 'N/A';
    let district = 'N/A';

    // Find Neighbourhood (most specific first)
    const neighbourhoodComponent = addressComponents.find(c => c.types.includes('neighborhood')) 
                             || addressComponents.find(c => c.types.includes('sublocality')) 
                             || addressComponents.find(c => c.types.includes('locality'));
    if (neighbourhoodComponent) {
        neighbourhood = neighbourhoodComponent.long_name;
    }

    // Find District
    const districtComponent = addressComponents.find(c => c.types.includes('administrative_area_level_2'))
                           || addressComponents.find(c => c.types.includes('locality'));
    if (districtComponent) {
        district = districtComponent.long_name;
    }
    
    return { neighbourhood, district };
}


/**
 * Handles the map click event. It performs the boundary check before processing.
 * @param {google.maps.MapMouseEvent} event The map click event.
 */
async function onMapClick(event) {
    // Do nothing if the boundary polygon hasn't loaded yet.
    if (!somaliaPolygon) {
        console.warn("Somalia boundary not yet loaded. Ignoring click.");
        return;
    }

    // FR-S2: Interaction Constraint - Point-in-polygon check.
    const isInsideSomalia = google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon);

    if (!isInsideSomalia) {
        console.log("Clicked outside Somalia. Registration is disabled for this area.");
        // Optionally, hide the sidebar if it was open.
        sidebar.classList.add('hidden');
        return;
    }

    console.log("Valid click inside Somalia. Proceeding with registration workflow.");

    // --- Start Registration Workflow (FR-S3) ---
    // 1. Snap the click to the grid center.
    const snappedLatLng = MapCore.snapToGridCenter(event.latLng);

    // 2. Generate the 6D code.
    const addressCode = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());

    // 3. Draw the visual boxes.
    MapCore.drawAddressBoxes(map, snappedLatLng);

    // 4. Show the sidebar and populate the 6D code.
    sidebar.classList.remove('hidden');
    if (sidebar6dCodeElement) {
        sidebar6dCodeElement.value = addressCode.fullCode;
    }

    // 5. Perform reverse geocoding and populate address fields.
    try {
        const response = await geocoder.geocode({ location: snappedLatLng });
        if (response.results && response.results.length > 0) {
            const { neighbourhood, district } = parseSomaliaAddress(response.results[0].address_components);
            console.log(`Geocoded Address: Neighbourhood: ${neighbourhood}, District: ${district}`);
            if (sidebarNeighbourhoodElement) sidebarNeighbourhoodElement.value = neighbourhood;
            if (sidebarDistrictElement) sidebarDistrictElement.value = district;
        } else {
            console.warn("Geocoding returned no results for this location.");
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
}

/**
 * Initializes the Somalia map application.
 */
function initApp() {
    console.log("Google Maps API loaded. Initializing Somalia Map...");
    const mapElement = document.getElementById('map');
    
    // Initialize the Geocoder service.
    geocoder = new google.maps.Geocoder();

    const somaliaMapOptions = {
        center: { lat: 2.0469, lng: 45.3182 }, // Mogadishu
        zoom: 13
    };

    map = MapCore.initializeBaseMap(mapElement, somaliaMapOptions);
    
    // Asynchronously load the boundary data.
    loadSomaliaBoundary();

    // Add the main click listener to the map.
    map.addListener('click', onMapClick);

    // TODO: Set up the dynamic grid (FR-S4, TR-3).
    // TODO: Set up the "Find My Location" button and full registration form logic (FR-S3, TR-4).
}

/**
 * Main entry point for the application.
 */
async function main() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY);
        initApp();
    } catch (error) {
        console.error("Failed to load Google Maps API.", error);
        document.getElementById('map').innerText = 'Error: Could not load the map.';
    }
}

// Start the application
main();