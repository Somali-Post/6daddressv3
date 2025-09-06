// Main script for the Global Map (index.html).
import * as MapCore from './map-core.js';

let map; // Variable to hold the map object for global access.

// This function is the entry point, called by the Google Maps API script tag.
window.initMap = function() {
    console.log("Global Map Initializing...");
    const mapElement = document.getElementById('map');
    
    // Define the specific options for the Global Map view.
    const globalMapOptions = {
        center: { lat: 0, lng: 0 },
        zoom: 3
    };

    // 1. Call MapCore.initializeBaseMap to create the map.
    map = MapCore.initializeBaseMap(mapElement, globalMapOptions);
    
    // TODO:
    // 2. Add a click listener to the map.
    // 3. On click:
    //    a. Snap coordinates (TR-2).
    //    b. Generate 6D code (TR-1).
    //    c. Draw boxes (FR-S3).
    //    d. Perform reverse geocoding (FR-G3).
    //    e. Display the address in the info panel.
    // 4. Set up the dynamic grid with a debounced listener (FR-S4, TR-3).
    // 5. Set up the "Find My Location" button (TR-4).
};