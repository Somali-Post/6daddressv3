// Main script for the Somalia Registration Map (somalia.html).
import * as MapCore from './map-core.js';
import { somaliRegions } from './config.js';

let map;
let somaliaPolygon;

// This is the crucial fix: Attach the function to the global 'window' object.
window.initMap = async function() {
    console.log("Somalia Map Initializing...");
    const mapElement = document.getElementById('map');

    const somaliaMapOptions = {
        center: { lat: 2.0469, lng: 45.3182 }, // Coordinates for Mogadishu
        zoom: 13
    };

    map = MapCore.initializeBaseMap(mapElement, somaliaMapOptions);

    // TODO: Future implementation steps...
};