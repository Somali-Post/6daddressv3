// Main script for the Global Map (index.html).
import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI } from './utils.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

let map;

/**
 * Initializes the global map application.
 * This function is called only after the Google Maps API is confirmed to be loaded.
 */
function initApp() {
    console.log("Google Maps API loaded. Initializing Global Map...");
    const mapElement = document.getElementById('map');
    
    const globalMapOptions = {
        center: { lat: 0, lng: 0 },
        zoom: 3
    };

    map = MapCore.initializeBaseMap(mapElement, globalMapOptions);
    
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
        // Optionally, display a user-friendly error message on the page.
        document.getElementById('map').innerText = 'Error: Could not load the map. Please try again later.';
    }
}

// Start the application
main();