import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map, geocoder;

// --- DOM Element References ---
let findMyAddressBtn, addressContent, accuracyWarning, accuracyMessage, accuracyRetryBtn;

// --- UI & Geocoding Logic (No changes here) ---
function showAddressDisplay() { /* ... same as before ... */ }
function updateInfoPanel(code, address, suffix) { /* ... same as before ... */ }
function parseAddressComponents(geocodeComponents) { /* ... same as before ... */ }
function getReverseGeocode(latLng) { /* ... same as before ... */ }

// --- Event Handlers ---
async function handleMapClick(rawLatLng) {
    MapCore.drawAddressBoxes(map, rawLatLng);
    const snappedLatLng = MapCore.snapToGridCenter(rawLatLng);
    const { code6D, localitySuffix } = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());
    showAddressDisplay();
    updateInfoPanel(code6D, { mainAddressLine: 'Locating...' }, '');
    const geocodeResult = await getReverseGeocode(snappedLatLng);
    const finalAddress = parseAddressComponents(geocodeResult);
    updateInfoPanel(code6D, finalAddress, localitySuffix);
}

// --- FIX APPLIED: New Continuous Zoom Animation ---
/**
 * Creates a smooth, continuous pan-and-zoom animation to the user's location.
 * @param {google.maps.LatLng} userLatLng The coordinate to animate to.
 */
function animateMapToLocation(userLatLng) {
    const startZoom = map.getZoom();
    const endZoom = 18;
    const duration = 2000; // 2 seconds for the zoom animation
    const intervalTime = 50; // Update every 50ms
    const zoomStep = (endZoom - startZoom) / (duration / intervalTime);

    // First, smoothly pan to the user's location.
    map.panTo(userLatLng);

    // Once the pan is complete, start the custom zoom animation.
    google.maps.event.addListenerOnce(map, 'idle', () => {
        let currentZoom = map.getZoom();
        const zoomInterval = setInterval(() => {
            currentZoom += zoomStep;
            if (currentZoom >= endZoom) {
                clearInterval(zoomInterval);
                map.setZoom(endZoom);
                // Trigger the final actions after the animation is fully complete.
                handleMapClick(userLatLng);
                findMyAddressBtn.disabled = false;
                findMyAddressBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location"><span>Find My 6D Address</span>';
            } else {
                map.setZoom(currentZoom);
            }
        }, intervalTime);
    });
}

async function handleGeolocate() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    findMyAddressBtn.disabled = true;
    findMyAddressBtn.innerHTML = '<div class="spinner"></div>';
    accuracyWarning.classList.add('hidden');

    const successCallback = (position) => {
        const accuracy = position.coords.accuracy;
        if (accuracy > 50) {
            accuracyMessage.textContent = `Poor GPS accuracy: ${Math.round(accuracy)}m`;
            accuracyWarning.classList.remove('hidden');
        }
        const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        
        // Call our new animation function.
        animateMapToLocation(userLatLng);
    };

    const errorCallback = (error) => {
        // Restore the button immediately on error.
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
// --- END OF FIX ---

// --- Initialization ---
function initApp() {
    findMyAddressBtn = document.getElementById('find-my-address-btn');
    addressContent = document.getElementById('address-content');
    accuracyWarning = document.getElementById('accuracy-warning');
    accuracyMessage = document.getElementById('accuracy-message');
    accuracyRetryBtn = document.getElementById('accuracy-retry-btn');

    // --- FIX APPLIED: Set a more reasonable default zoom level ---
    map = MapCore.initializeBaseMap(document.getElementById("map"), { center: { lat: 51.5072, lng: -0.1276 }, zoom: 6 });
    // --- END OF FIX ---
    
    geocoder = new google.maps.Geocoder();
    map.addListener('click', (event) => handleMapClick(event.latLng));
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    findMyAddressBtn.addEventListener('click', handleGeolocate);
    accuracyRetryBtn.addEventListener('click', handleGeolocate);
    MapCore.updateDynamicGrid(map);
}

async function startApp() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']);
        initApp();
    } catch (error) {
        console.error(error);
        document.body.innerHTML = '<h1>Error: Could not load Google Maps.</h1>';
    }
}

startApp();