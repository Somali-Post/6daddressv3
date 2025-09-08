import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map, geocoder, placesService;

// --- DOM Element References ---
let findMyAddressBtn, addressContent, accuracyWarning, accuracyMessage, accuracyRetryBtn;

// --- UI & Geocoding Logic (No changes here) ---
function showAddressDisplay() { /* ... same as before ... */ }
function updateInfoPanel(code, address, suffix) { /* ... same as before ... */ }
function parseAddressComponents(geocodeComponents, placeResult) { /* ... same as before ... */ }
function getReverseGeocode(latLng) { /* ... same as before ... */ }
function getPlaceDetails(latLng) { /* ... same as before ... */ }

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

// --- FIX APPLIED: Event-Driven "Swoop" Animation ---

/**
 * A helper function that returns a Promise that resolves when the map's 'idle' event fires.
 * @param {google.maps.Map} map The map instance to listen to.
 * @returns {Promise<void>}
 */
function waitForMapIdle(map) {
    return new Promise(resolve => google.maps.event.addListenerOnce(map, 'idle', resolve));
}

/**
 * Creates a smooth, multi-step animation that waits for the map to be ready at each stage.
 * @param {google.maps.LatLng} userLatLng The coordinate to animate to.
 */
async function animateMapToLocation(userLatLng) {
    // Stage 1: Zoom out for context
    map.setZoom(10);
    await waitForMapIdle(map);

    // Stage 2: Smoothly pan to the new location
    map.panTo(userLatLng);
    await waitForMapIdle(map);

    // Stage 3: First step of the zoom-in
    map.setZoom(14);
    await waitForMapIdle(map);

    // Stage 4: Final zoom-in
    map.setZoom(18);
    await waitForMapIdle(map);

    // Stage 5: Now that the animation is fully complete, generate the address
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
        
        // Await the entire animation sequence to complete
        await animateMapToLocation(userLatLng);

        // Restore the button only after the animation and geocoding are done
        findMyAddressBtn.disabled = false;
        findMyAddressBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location"><span>Find My 6D Address</span>';
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
        successCallback, // This is now an async function
        errorCallback,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}
// --- END OF FIX ---

// --- Initialization ---
function initApp() {
    // Assign DOM elements
    findMyAddressBtn = document.getElementById('find-my-address-btn');
    addressContent = document.getElementById('address-content');
    accuracyWarning = document.getElementById('accuracy-warning');
    accuracyMessage = document.getElementById('accuracy-message');
    accuracyRetryBtn = document.getElementById('accuracy-retry-btn');

    map = MapCore.initializeBaseMap(document.getElementById("map"), { center: { lat: 0, lng: 0 }, zoom: 3 });
    geocoder = new google.maps.Geocoder();
    placesService = new google.maps.places.PlacesService(map);

    // Attach listeners
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