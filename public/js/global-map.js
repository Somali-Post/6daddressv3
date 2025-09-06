// Main script for the Global Map (index.html).
import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI } from './utils.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

let map;

/**
 * Handles the map click event to generate and display a 6D Address.
 * @param {google.maps.MapMouseEvent} event The map click event.
 */
function onMapClick(event) {
    // 1. Snap the raw click to the grid center (TR-2)
    const snappedLatLng = MapCore.snapToGridCenter(event.latLng);

    // 2. Generate the 6D code from the snapped coordinate (TR-1)
    const addressCode = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());

    // 3. Draw the visual boxes on the map (FR-S3)
    MapCore.drawAddressBoxes(map, snappedLatLng);

    // 4. Log the result for verification
    console.log('Generated 6D Address:', addressCode.fullCode);
    console.log('Code Parts:', addressCode);

    // TODO: Display the address code in the UI info panel (FR-G2)
    // TODO: Perform reverse geocoding for address lines 2 & 3 (FR-G3)
}

/**
 * Initializes the global map application.
 */
function initApp() {
    console.log("Google Maps API loaded. Initializing Global Map...");
    const mapElement = document.getElementById('map');
    
    const globalMapOptions = {
        center: { lat: 0, lng: 0 },
        zoom: 3
    };

    map = MapCore.initializeBaseMap(mapElement, globalMapOptions);
    
    // Add the main click listener to the map
    map.addListener('click', onMapClick);
    
    // TODO: Set up the dynamic grid with a debounced listener (FR-S4, TR-3).
    // TODO: Set up the "Find My Location" button (TR-4).
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