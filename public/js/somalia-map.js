// Main script for the Somalia Registration Map (somalia.html).
import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI } from './utils.js';
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';

let map;
let somaliaPolygon;

/**
 * Initializes the Somalia map application.
 * This function is called only after the Google Maps API is confirmed to be loaded.
 */
function initApp() {
    console.log("Google Maps API loaded. Initializing Somalia Map...");
    const mapElement = document.getElementById('map');

    const somaliaMapOptions = {
        center: { lat: 2.0469, lng: 45.3182 }, // Mogadishu
        zoom: 13
    };

    map = MapCore.initializeBaseMap(mapElement, somaliaMapOptions);

    // TODO: Future implementation steps...
}

/**
 * Main entry point for the application.
 * It first loads the Google Maps API and then initializes the app.
 */
async function main() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY);
        initApp();
    } catch (error) {
        console.error("Failed to load Google Maps API. Please check your API key and network connection.", error);
        document.getElementById('map').innerText = 'Error: Could not load the map. Please try again later.';
    }
}

// Start the application
main();