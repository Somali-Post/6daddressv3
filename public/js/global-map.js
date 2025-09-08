import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map, geocoder, placesService;

// --- DOM Element References ---
let findMyAddressBtn, addressContent, accuracyWarning, accuracyMessage, accuracyRetryBtn;

// --- UI & Geocoding Logic (No changes here) ---
function showAddressDisplay() {
    findMyAddressBtn.classList.add('hidden');
    addressContent.classList.remove('hidden');
}
function updateInfoPanel(code, address, suffix) {
    showAddressDisplay();
    const codeDisplay = document.getElementById('code-display');
    const line1Display = document.getElementById('line1-display');
    const line2Display = document.getElementById('line2-display');
    const line3Display = document.getElementById('line3-display');
    const parts = code.split('-');
    codeDisplay.innerHTML = `<span class="code-2d">${parts[0]}</span>-<span class="code-4d">${parts[1]}</span>-<span class="code-6d">${parts[2]}</span>`;
    line1Display.textContent = address.line1;
    const finalLine2 = `${address.line2} ${suffix}`.trim();
    line2Display.textContent = finalLine2;
    line3Display.textContent = '';
}
function parseAddressComponents(geocodeComponents, placeResult) {
    let line1 = '', line2 = '';
    const getComponent = (type) => geocodeComponents.find(c => c.types.includes(type))?.long_name || null;
    line1 = placeResult?.name || getComponent('neighborhood') || getComponent('sublocality');
    line2 = getComponent('locality') || getComponent('administrative_area_level_2');
    if (line1 === line2) { line1 = ''; }
    if (!line1) {
        line1 = line2;
        line2 = getComponent('administrative_area_level_1') || getComponent('country');
    }
    if (line1 === line2) { line2 = getComponent('country'); }
    return { line1: line1 || '', line2: line2 || 'Unknown Location' };
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
    showAddressDisplay();
    updateInfoPanel(code6D, { line1: 'Locating...', line2: '' }, '');
    const [geocodeResult, placeResult] = await Promise.all([
        getReverseGeocode(snappedLatLng),
        getPlaceDetails(snappedLatLng)
    ]);
    const finalAddress = parseAddressComponents(geocodeResult, placeResult);
    updateInfoPanel(code6D, finalAddress, localitySuffix);
}

function waitForMapIdle(map) {
    return new Promise(resolve => google.maps.event.addListenerOnce(map, 'idle', resolve));
}

async function animateMapToLocation(userLatLng) {
    map.setZoom(10);
    await waitForMapIdle(map);
    map.panTo(userLatLng);
    await waitForMapIdle(map);
    map.setZoom(14);
    await waitForMapIdle(map);
    map.setZoom(18);
    await waitForMapIdle(map);
    handleMapClick(userLatLng);
}

async function handleGeolocate() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    findMyAddressBtn.disabled = true;
    findMyAddressBtn.innerHTML = '<div class="spinner"></div>';
    accuracyWarning.classList.add('hidden');

    const successCallback = async (position) => {
        const accuracy = position.coords.accuracy;
        if (accuracy > 50) {
            accuracyMessage.textContent = `Poor GPS accuracy: ${Math.round(accuracy)}m`;
            accuracyWarning.classList.remove('hidden');
        }
        const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        
        await animateMapToLocation(userLatLng);

        // --- FIX APPLIED ---
        // The code to restore the button has been REMOVED from here to prevent the race condition.
        // The UI state is now correctly managed by handleMapClick -> showAddressDisplay.
        // --- END OF FIX ---
    };

    const errorCallback = (error) => {
        // Restore the button immediately on error
        findMyAddressBtn.disabled = false;
        findMyAddressBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location"><span>Find My 6D Address</span>';
        switch (error.code) {
            case error.PERMISSION_DENIED: alert("You denied the request for Geolocation."); break;
            case error.POSITION_UNAVAILABLE: alert("Location information is unavailable."); break;
            case error.TIMEOUT: alert("The request to get user location timed out."); break;
            default: alert("An unknown error occurred."); break;
        }
    };

    navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// --- Initialization ---
function initApp() {
    findMyAddressBtn = document.getElementById('find-my-address-btn');
    addressContent = document.getElementById('address-content');
    accuracyWarning = document.getElementById('accuracy-warning');
    accuracyMessage = document.getElementById('accuracy-message');
    accuracyRetryBtn = document.getElementById('accuracy-retry-btn');
    map = MapCore.initializeBaseMap(document.getElementById("map"), { center: { lat: 0, lng: 0 }, zoom: 3 });
    geocoder = new google.maps.Geocoder();
    placesService = new google.maps.places.PlacesService(map);
    map.addListener('click', (event) => handleMapClick(event.latLng));
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    findMyAddressBtn.addEventListener('click', handleGeolocate);
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