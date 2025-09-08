import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map, geocoder, placesService;

// --- FIX APPLIED: Restored 3-Line UI and Geocoding Logic ---
// --- CORRECTED FUNCTIONS TO BE REPLACED ---

function updateInfoPanel(code, address, suffix) {
    const codeDisplay = document.getElementById('code-display');
    const line1Display = document.getElementById('line1-display');
    const line2Display = document.getElementById('line2-display');
    const line3Display = document.getElementById('line3-display'); // This will be cleared
    
    // Line 1 of Display: The 6D Code
    const parts = code.split('-');
    codeDisplay.innerHTML = `<span class="code-2d">${parts[0]}</span>-<span class="code-4d">${parts[1]}</span>-<span class="code-6d">${parts[2]}</span>`;
    
    // Line 2 of Display: Village/Neighbourhood
    line1Display.textContent = address.line1;
    
    // Line 3 of Display: Town/City + Suffix
    const finalLine2 = `${address.line2} ${suffix}`.trim();
    line2Display.textContent = finalLine2;

    // Ensure the fourth line of display is always empty
    line3Display.textContent = '';
}

/**
 * Intelligently parses and merges results to construct the specific two-line TEXT address
 * format required for the Global Map, which results in a 3-line total display.
 * @returns {{line1: string, line2: string}} An object with Village/Neighbourhood and Town/City.
 */
function parseAddressComponents(geocodeComponents, placeResult) {
    let line1 = ''; // This will be Village/Neighbourhood
    let line2 = ''; // This will be Town/City

    const getComponent = (type) => geocodeComponents.find(c => c.types.includes(type))?.long_name || null;

    // --- Step 1: Find the best candidates for each line ---

    // For Line 1, prioritize the human-friendly name from the Places API.
    line1 = placeResult?.name || getComponent('neighborhood') || getComponent('sublocality');

    // For Line 2, find the primary town or city.
    line2 = getComponent('locality') || getComponent('administrative_area_level_2');

    // --- Step 2: Clean up and deduplicate ---

    // If the specific location is the same as the city (e.g., in a small town),
    // we only want to show the city. So we clear line1.
    if (line1 === line2) {
        line1 = '';
    }

    // If we couldn't find a specific neighborhood (line1 is empty),
    // the most important info is the Town/City. Promote it to the first line.
    if (!line1) {
        line1 = line2;
        // Find a broader region (like a state or country) for the second line.
        line2 = getComponent('administrative_area_level_1') || getComponent('country');
    }
    
    // Final check for duplicates after the promotion logic.
    if (line1 === line2) {
        line2 = getComponent('country');
    }

    return { 
        line1: line1 || '', 
        line2: line2 || 'Unknown Location' 
    };
}
// --- END OF FIX ---

function getReverseGeocode(latLng) {
    return new Promise(resolve => {
        geocoder.geocode({ location: latLng }, (results, status) => {
            resolve((status === 'OK' && results[0]) ? results[0].address_components : []);
        });
    });
}

function getPlaceDetails(latLng) {
    return new Promise(resolve => {
        const request = { location: latLng, rankBy: google.maps.places.RankBy.DISTANCE, type: 'neighborhood' };
        placesService.nearbySearch(request, (results, status) => {
            resolve((status === google.maps.places.PlacesServiceStatus.OK && results[0]) ? results[0] : null);
        });
    });
}

async function handleMapClick(rawLatLng) {
    MapCore.drawAddressBoxes(map, rawLatLng);
    const snappedLatLng = MapCore.snapToGridCenter(rawLatLng);
    const { formattedCode, localitySuffix } = getFormatted6DCode(snappedLatLng);
    
    updateInfoPanel(formattedCode, { line1: 'Locating...', line2: '', line3: '' }, '');
    
    const [geocodeResult, placeResult] = await Promise.all([
        getReverseGeocode(snappedLatLng),
        getPlaceDetails(snappedLatLng)
    ]);
    
    const finalAddress = parseAddressComponents(geocodeResult, placeResult);
    updateInfoPanel(formattedCode, finalAddress, localitySuffix);
}

function handleGeolocate() {
    // This function remains correct and unchanged
    const geolocateBtn = document.getElementById('geolocate-btn');
    const accuracyWarning = document.getElementById('accuracy-warning');
    if (!navigator.geolocation) { alert("Geolocation is not supported by your browser."); return; }
    geolocateBtn.disabled = true;
    geolocateBtn.innerHTML = '<div class="spinner"></div>';
    accuracyWarning.classList.add('hidden');
    const successCallback = (position) => {
        const accuracy = position.coords.accuracy;
        if (accuracy > 50) {
            document.getElementById('accuracy-message').textContent = `Poor GPS accuracy: ${Math.round(accuracy)}m`;
            accuracyWarning.classList.remove('hidden');
        }
        const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        map.setCenter(userLatLng);
        map.setZoom(18);
        handleMapClick(userLatLng);
        geolocateBtn.disabled = false;
        geolocateBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location">';
    };
    const errorCallback = (error) => {
        geolocateBtn.disabled = false;
        geolocateBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location">';
        switch (error.code) {
            case error.PERMISSION_DENIED: alert("You denied the request for Geolocation."); break;
            case error.POSITION_UNAVAILABLE: alert("Location information is unavailable."); break;
            case error.TIMEOUT: alert("The request to get user location timed out."); break;
            default: alert("An unknown error occurred."); break;
        }
    };
    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options);
}

function initApp() {
    const geolocateBtn = document.getElementById('geolocate-btn');
    const accuracyRetryBtn = document.getElementById('accuracy-retry-btn');
    map = MapCore.initializeBaseMap(document.getElementById("map"), { center: { lat: 0, lng: 0 }, zoom: 3 });
    geocoder = new google.maps.Geocoder();
    placesService = new google.maps.places.PlacesService(map);
    map.addListener('click', (event) => handleMapClick(event.latLng));
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    geolocateBtn.addEventListener('click', handleGeolocate);
    accuracyRetryBtn.addEventListener('click', handleGeolocate);
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