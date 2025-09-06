// Main script for the Somalia Registration Map (somalia.html).
import * as MapCore from './map-core.js';
import { somaliRegions } from './config.js';

let map; // Variable to hold the map object.
let somaliaPolygon; // To hold the Google Maps Polygon object for Somalia's border.

// This function is the entry point, called by the Google Maps API script tag.
window.initMap = async function() {
    console.log("Somalia Map Initializing...");
    const mapElement = document.getElementById('map');

    // Define the specific options for the Somalia Map view.
    // The map defaults to a view of Mogadishu.
    const somaliaMapOptions = {
        center: { lat: 2.0469, lng: 45.3182 }, // Coordinates for Mogadishu
        zoom: 13
    };

    // 1. Call MapCore.initializeBaseMap to create the map, centered on Mogadishu.
    map = MapCore.initializeBaseMap(mapElement, somaliaMapOptions);

    // TODO:
    // 2. Fetch and process '/data/somalia.geojson' to create a google.maps.Polygon.
    // 3. Add a click listener to the map.
    // 4. On click:
    //    a. Perform a point-in-polygon check against the Somalia border (FR-S2).
    //    b. If inside Somalia, proceed with the registration workflow.
    // 5. Set up the dynamic grid (FR-S4, TR-3).
    // 6. Set up the "Find My Location" button and registration form logic (FR-S3, TR-4).
};