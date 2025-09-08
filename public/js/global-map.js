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
    const { code6D, localitySuffix } = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());
    
    updateInfoPanel(code6D, { line1: 'Locating...', line2: '' }, '');
    
    const [geocodeResult, placeResult] = await Promise.all([
        getReverseGeocode(snappedLatLng),
        getPlaceDetails(snappedLatLng)
    ]);
    
    const finalAddress = parseAddressComponents(geocodeResult, placeResult);
    updateInfoPanel(code6D, finalAddress, localitySuffix);
}

function handleGeolocate() {
    // ... (This function remains the same as the last correct version)
    const geolocateBtn = document.getElementById('geolocate-btn');
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    geolocateBtn.disabled = true;
    geolocateBtn.innerHTML = '<div class="spinner"></div>';
    const accuracyWarning = document.getElementById('accuracy-warning');
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