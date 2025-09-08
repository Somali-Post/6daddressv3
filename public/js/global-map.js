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
    const line3Display = document.getElementById('line3-display');
    
    // Line 1 of Display: The 6D Code (e.g., "44-06-07")
    const parts = code.split('-');
    codeDisplay.innerHTML = `<span class="code-2d">${parts[0]}</span>-<span class="code-4d">${parts[1]}</span>-<span class="code-6d">${parts[2]}</span>`;
    
    // Line 2 of Display: Village/Neighbourhood (e.g., "Old Mogadishu")
    line1Display.textContent = address.line1;
    
    // Line 3 of Display: Town/City + Suffix (e.g., "Muqdisho 03")
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

    // Prioritize the human-friendly name from the Places API for the most specific location.
    line1 = placeResult?.name || getComponent('neighborhood') || getComponent('sublocality');

    // Find the primary town or city.
    line2 = getComponent('locality') || getComponent('administrative_area_level_2');

    // --- Deduplication and Cleanup Logic ---
    if (line1 === line2) {
        line1 = '';
    }

    if (!line1) {
        line1 = line2;
        line2 = getComponent('administrative_area_level_1') || getComponent('country');
    }
    
    if (line1 === line2) {
        line2 = getComponent('country');
    }

    return { 
        line1: line1 || '', 
        line2: line2 || 'Unknown Location' 
    };
}

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

// --- Event Handlers ---
async function handleMapClick(rawLatLng) {
    MapCore.drawAddressBoxes(map, rawLatLng);
    const snappedLatLng = MapCore.snapToGridCenter(rawLatLng);
    
    // --- FIX APPLIED ---
    // Get the code string directly. The old helper function is removed.
    const { code6D, localitySuffix } = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());
    
    // Pass the raw code string to updateInfoPanel.
    updateInfoPanel(code6D, { line1: 'Locating...', line2: '' }, '');
    // --- END OF FIX ---
    
    const [geocodeResult, placeResult] = await Promise.all([
        getReverseGeocode(snappedLatLng),
        getPlaceDetails(snappedLatLng)
    ]);
    
    const finalAddress = parseAddressComponents(geocodeResult, placeResult);
    updateInfoPanel(code6D, finalAddress, localitySuffix);
}

function handleGeolocate() {
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

// --- Initialization ---
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