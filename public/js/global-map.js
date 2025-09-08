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

// --- FIX APPLIED: Smooth "Swoop" Animation ---
/**
 * Creates a smooth, multi-step animation to the user's location.
 * @param {google.maps.LatLng} userLatLng The coordinate to animate to.
 */
function animateMapToLocation(userLatLng) {
    // Step 1: Briefly zoom out to an intermediate level for context
    map.setZoom(10);

    // Use a short timeout to allow the zoom-out to render before panning
    setTimeout(() => {
        // Step 2: Smoothly pan to the new location
        map.panTo(userLatLng);

        // Step 3: Wait for the pan animation to finish
        google.maps.event.addListenerOnce(map, 'idle', () => {
            // Step 4: Perform a staged zoom-in for a "swoop" effect
            setTimeout(() => map.setZoom(14), 500); // First zoom step
            setTimeout(() => map.setZoom(18), 1000); // Final zoom step

            // Step 5: Trigger the address generation after the animation is complete
            setTimeout(() => {
                handleMapClick(userLatLng);
                // Restore the button now that everything is finished
                findMyAddressBtn.disabled = false;
                findMyAddressBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location"><span>Find My 6D Address</span>';
            }, 1500);
        });
    }, 200); // 200ms delay
}

function handleGeolocate() {
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
        
        // Call our new animation function instead of the old jump-cut
        animateMapToLocation(userLatLng);
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