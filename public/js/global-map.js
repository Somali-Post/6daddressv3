import { GOOGLE_MAPS_API_KEY } from './config.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import * as MapCore from './map-core.js';

// --- Module-level variables ---
let map;
let geocoder;
let placesService;

// --- UI & Geocoding Logic (No changes here) ---
function updateInfoPanel(code, address, suffix) {
    const codeDisplay = document.getElementById('code-display');
    const line1Display = document.getElementById('line1-display');
    const line2Display = document.getElementById('line2-display');
    const line3Display = document.getElementById('line3-display');
    
    const parts = code.split('-');
    codeDisplay.innerHTML = `<span class="code-2d">${parts[0]}</span>-<span class="code-4d">${parts[1]}</span>-<span class="code-6d">${parts[2]}</span>`;
    
    line1Display.textContent = address.line1;
    line2Display.textContent = address.line2;
    const finalLine = `${address.line3} ${suffix}`.trim();
    line3Display.textContent = finalLine;
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
    return { line1: foundNames[0] || '', line2: foundNames[1] || '', line3: foundNames[2] || 'Unknown Location' };
}

// --- Event Handlers (No changes here) ---
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
    map = MapCore.initializeBaseMap(document.getElementById("map"), {});
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
        // --- FIX APPLIED ---
        // We now call the loader with the API key and an array of required libraries.
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['places', 'geometry']);
        // --- END OF FIX ---
        initApp();
    } catch (error) {
        console.error(error);
        document.body.innerHTML = '<h1>Error: Could not load Google Maps.</h1>';
    }
}

startApp();