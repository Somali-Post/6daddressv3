import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map;
let geocoder;
let placesService;

// --- UI & Geocoding Logic ---
function updateInfoPanel(code, address, suffix) {
    const codeDisplay = document.getElementById('code-display');
    const line1Display = document.getElementById('line1-display');
    const line2Display = document.getElementById('line2-display');
    const line3Display = document.getElementById('line3-display'); // We will clear this one
    
    const parts = code.split('-');
    codeDisplay.innerHTML = `<span class="code-2d">${parts[0]}</span>-<span class="code-4d">${parts[1]}</span>-<span class="code-6d">${parts[2]}</span>`;
    
    // Set the two lines of the address
    line1Display.textContent = address.line1; // Village or Neighbourhood
    
    // Append the suffix to the Town/City line
    const finalLine2 = `${address.line2} ${suffix}`.trim();
    line2Display.textContent = finalLine2;

    // Ensure the third line is empty
    line3Display.textContent = '';
}

/**
 * Intelligently parses and merges results to construct the specific two-line address
 * format required for the Global Map.
 * Line 1: Most specific Village or Neighbourhood.
 * Line 2: Primary Town or City.
 */
function parseAddressComponents(geocodeComponents, placeResult) {
    let line1 = ''; // Village or Neighbourhood
    let line2 = ''; // Town or City

    const getComponent = (type) => geocodeComponents.find(c => c.types.includes(type))?.long_name || null;

    // Prioritize the named "place" from Places API for the most specific location.
    line1 = placeResult?.name || getComponent('neighborhood') || getComponent('sublocality');

    // Find the primary town or city.
    line2 = getComponent('locality') || getComponent('administrative_area_level_2') || getComponent('administrative_area_level_1');

    // --- Deduplication and Cleanup Logic ---
    // If the specific location is the same as the city (e.g., in a small town),
    // we only want to show the city name.
    if (line1 === line2) {
        line1 = '';
    }

    // If we couldn't find a specific neighborhood (line1 is empty),
    // promote the city to line 1 and find a broader region for line 2.
    if (!line1) {
        line1 = line2;
        line2 = getComponent('administrative_area_level_1') || getComponent('country');
    }
    
    // Final check for duplicates after promotion
    if (line1 === line2) {
        line2 = getComponent('country');
    }

    return { 
        line1: line1 || '', 
        line2: line2 || 'Unknown Location' 
    };
}

// --- FIX APPLIED: Hybrid Geocoding Strategy ---
/**
 * Intelligently parses and merges results from both the Geocoding and Places APIs
 * to construct the most accurate, human-readable address.
 * @param {google.maps.GeocoderAddressComponent[]} geocodeComponents - Results from Reverse Geocoding.
 * @param {google.maps.places.PlaceResult} placeResult - Results from Places API Nearby Search.
 * @returns {{line1: string, line2: string, line3: string}} The structured address.
 */
function parseAddressComponents(geocodeComponents, placeResult) {
    const address = {
        line1: '', // Most specific: Neighbourhood or Village
        line2: '', // Primary Town or City
        line3: ''  // Region or Country
    };

    // Helper to find a component by type
    const getComponent = (type) => geocodeComponents.find(c => c.types.includes(type))?.long_name || null;

    // Line 1: Prioritize the named "place" first, then fall back to geocoded components.
    // This gives us the most human-relevant name for the immediate area.
    address.line1 = placeResult?.name || getComponent('neighborhood') || getComponent('sublocality_level_1') || getComponent('sublocality');

    // Line 2: Find the primary city or town.
    address.line2 = getComponent('locality') || getComponent('administrative_area_level_3');

    // Line 3: Find the broader region or country.
    address.line3 = getComponent('administrative_area_level_1') || getComponent('country');

    // --- Deduplication and Cleanup Logic ---
    // If Line 1 and Line 2 are the same (e.g., in a small town), remove Line 1.
    if (address.line1 === address.line2) {
        address.line1 = '';
    }
    // If Line 2 and Line 3 are the same, remove Line 2.
    if (address.line2 === address.line3) {
        address.line2 = '';
    }
    // If Line 1 is now empty, promote Line 2.
    if (!address.line1 && address.line2) {
        address.line1 = address.line2;
        address.line2 = address.line3;
        address.line3 = '';
    }
    // If Line 2 is now empty, promote Line 3.
    if (!address.line2 && address.line3) {
        address.line2 = address.line3;
        address.line3 = '';
    }
    
    // Final fallback if everything is empty
    if (!address.line1 && !address.line2 && !address.line3) {
        address.line1 = getComponent('country') || 'Unknown Location';
    }

    return address;
}
// --- END OF FIX ---

// --- Event Handlers ---
async function handleMapClick(rawLatLng) {
    MapCore.drawAddressBoxes(map, rawLatLng);
    const snappedLatLng = MapCore.snapToGridCenter(rawLatLng);
    const { code6D, localitySuffix } = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());
    
    updateInfoPanel(code6D, { line1: 'Locating...', line2: '', line3: '' }, '');
    
    const [geocodeResult, placeResult] = await Promise.all([
        getReverseGeocode(snappedLatLng),
        getPlaceDetails(snappedLatLng)
    ]);
    
    const finalAddress = parseAddressComponents(geocodeResult, placeResult);
    updateInfoPanel(code6D, finalAddress, localitySuffix);
}

function handleGeolocate() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                map.setCenter(userLatLng);
                map.setZoom(18);
                handleMapClick(userLatLng);
            },
            () => alert("Error: The Geolocation service failed.")
        );
    } else { alert("Error: Your browser doesn't support geolocation."); }
}

// --- Initialization ---
function initApp() {
    map = MapCore.initializeBaseMap(document.getElementById("map"), { center: { lat: 0, lng: 0 }, zoom: 3 });
    geocoder = new google.maps.Geocoder();
    placesService = new google.maps.places.PlacesService(map);

    map.addListener('click', (event) => handleMapClick(event.latLng));
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    document.getElementById('geolocate-btn').addEventListener('click', handleGeolocate);
    
    MapCore.updateDynamicGrid(map);
}

async function startApp() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['places', 'geometry']);
        initApp();
    } catch (error) {
        console.error(error);
        document.body.innerHTML = '<h1>Error: Could not load Google Maps.</h1>';
    }
}

startApp();