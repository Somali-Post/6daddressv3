import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map, geocoder, placesService;

// --- FIX APPLIED: Restored 3-Line UI and Geocoding Logic ---
function updateInfoPanel(code, address, suffix) {
    const codeDisplay = document.getElementById('code-display');
    const line1Display = document.getElementById('line1-display');
    const line2Display = document.getElementById('line2-display');
    const line3Display = document.getElementById('line3-display');
    
    // The 'code' object now has c2d, c4d, c6d properties
    codeDisplay.innerHTML = `<span class="code-2d">${code.c2d}</span>-<span class="code-4d">${code.c4d}</span>-<span class="code-6d">${code.c6d}</span>`;
    
    line1Display.textContent = address.line1;
    line2Display.textContent = address.line2;
    const finalLine = `${address.line3} ${suffix}`.trim();
    line3Display.textContent = finalLine;
}

function getFormatted6DCode(latLng) {
    const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    const parts = code6D.split('-');
    const formattedCode = { c2d: parts[0], c4d: parts[1], c6d: parts[2] };
    return { formattedCode, localitySuffix };
}

function parseAddressComponents(geocodeComponents, placeResult) {
    const foundNames = [];
    const getComponent = type => geocodeComponents.find(c => c.types.includes(type))?.long_name || null;

    if (placeResult?.name) foundNames.push(placeResult.name);
    
    const priorityList = ['locality', 'administrative_area_level_2', 'administrative_area_level_1', 'country'];
    for (const type of priorityList) {
        if (foundNames.length >= 3) break;
        const foundName = getComponent(type);
        if (foundName && !foundNames.includes(foundName)) foundNames.push(foundName);
    }
    
    return { 
        line1: foundNames[0] || 'Unknown Location', 
        line2: foundNames[1] || '', 
        line3: foundNames[2] || '' 
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