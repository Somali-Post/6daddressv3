// Main script for the Global Map (index.html).
import * as MapCore from './map-core.js';

let map; // Variable to hold the map object for global access.

// This is the crucial fix: Attach the function to the global 'window' object.
// This makes it accessible to the Google Maps script's callback.
window.initMap = function() {
    console.log("Global Map Initializing...");
    const mapElement = document.getElementById('map');
    
    const globalMapOptions = {
        center: { lat: 0, lng: 0 },
        zoom: 3
    };

    map = MapCore.initializeBaseMap(mapElement, globalMapOptions);
    
    // TODO: Future implementation steps...
};