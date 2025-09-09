import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map, geocoder;

// --- DOM Element References ---
let findMyAddressBtn, addressContent, accuracyWarning, accuracyMessage, accuracyRetryBtn;

// --- UI & Geocoding Logic ---
function showAddressDisplay() {
    findMyAddressBtn.classList.add('hidden');
    addressContent.classList.remove('hidden');
}

// --- FIX APPLIED: Restored Correct Info Panel Logic ---
function updateInfoPanel(code, address, suffix) {
    showAddressDisplay();
    const codeDisplay = document.getElementById('code-display');
    const line1Display = document.getElementById('line1-display');
    const line2Display = document.getElementById('line2-display');
    const line3Display = document.getElementById('line3-display');
    
    // Line 1 of Display: The 6D Code
    const parts = code.split('-');
    codeDisplay.innerHTML = `<span class="code-2d">${parts[0]}</span>-<span class="code-4d">${parts[1]}</span>-<span class="code-6d">${parts[2]}</span>`;
    
    // Line 2 of Display: Town/City + Suffix
    const finalTextLine = `${address.mainAddressLine} ${suffix}`.trim();
    line1Display.textContent = finalTextLine;

    // Ensure the other text lines are empty
    line2Display.textContent = '';
    line3Display.textContent = '';
}

function parseAddressComponents(geocodeComponents) {
    const getComponent = (type) => geocodeComponents.find(c => c.types.includes(type))?.long_name || null;

    const country = geocodeComponents.find(c => c.types.includes('country'));
    if (country && country.short_name === 'GB') {
        const postTown = getComponent('postal_town');
        if (postTown) {
            return { mainAddressLine: postTown };
        }
    }

    const mainAddressLine = getComponent('locality') || 
                          getComponent('administrative_area_level_2') || 
                          getComponent('administrative_area_level_1') || 
                          getComponent('country') || 
                          'Unknown Location';

    return { mainAddressLine };
}
// --- END OF FIX ---

function getReverseGeocode(latLng) {
    return new Promise(resolve => {
        geocoder.geocode({ location: latLng }, (results, status) => {
            resolve((status === 'OK' && results[0]) ? results[0].address_components : []);
        });
    });
}

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

function animateMapToLocation(userLatLng) {
    const startZoom = map.getZoom();
    const endZoom = 18;
    const duration = 4000;
    const intervalTime = 50;
    const zoomStep = (endZoom - startZoom) / (duration / intervalTime);

    map.panTo(userLatLng);

    google.maps.event.addListenerOnce(map, 'idle', () => {
        let currentZoom = map.getZoom();
        const zoomInterval = setInterval(() => {
            currentZoom += zoomStep;
            if (currentZoom >= endZoom) {
                clearInterval(zoomInterval);
                map.setZoom(endZoom);
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
        animateMapToLocation(userLatLng);
    };

    const errorCallback = (error) => {
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

    // --- FIX APPLIED: Restored Default World View ---
    map = MapCore.initializeBaseMap(document.getElementById("map"), { center: { lat: 0, lng: 0 }, zoom: 3 });
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