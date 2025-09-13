import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

// --- Module-level variables ---
let map, geocoder, somaliaPolygon;
let lastSelectedLatLng = null;

// --- DOM Element References ---
let findMyAddressBtn, addressContent, recenterBtn;

// --- UI State Management ---
function showAddressDisplay(isLoading = false) {
    findMyAddressBtn.classList.add('hidden');
    addressContent.classList.remove('hidden');
    if (isLoading) {
        document.getElementById('code-display').textContent = 'Locating...';
        document.getElementById('line1-display').textContent = '';
        document.getElementById('line2-display').textContent = '';
    }
}

function showFindButton() {
    findMyAddressBtn.classList.remove('hidden');
    addressContent.classList.add('hidden');
}

function updateInfoPanel(code, address, suffix) {
    showAddressDisplay();
    const codeDisplay = document.getElementById('code-display');
    const line1Display = document.getElementById('line1-display');
    const line2Display = document.getElementById('line2-display');
    codeDisplay.textContent = code;
    line1Display.textContent = address.district;
    line2Display.textContent = `${address.region} ${suffix}`.trim();
}

// --- Geocoding Logic ---
async function getAddressForLocation(latLng) {
    const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    // This function now ONLY uses Google as a fallback. The primary logic is in the data layer click handler.
    try {
        const response = await geocoder.geocode({ location: latLng });
        if (response.results && response.results[0]) {
            const components = response.results[0].address_components;
            const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name || null;
            const address = {
                region: getComponent('administrative_area_level_1') || 'N/A',
                district: getComponent('administrative_area_level_2') || getComponent('locality') || 'N/A'
            };
            return { code6D, localitySuffix, address };
        }
    } catch (error) { console.error("Google Geocoding fallback failed:", error); }
    return { code6D, localitySuffix, address: { region: 'N/A', district: 'N/A' } };
}

// --- Event Handlers ---
async function processLocation(latLng) {
    lastSelectedLatLng = latLng;
    recenterBtn.classList.remove('hidden');
    MapCore.drawAddressBoxes(map, latLng);
    showAddressDisplay(true);
    // The actual geocoding will be triggered by the click handlers below
}

// --- FIX APPLIED: New Event Handler for the Data Layer ---
async function handleDataLayerClick(event) {
    await processLocation(event.latLng);
    const { code6D, localitySuffix } = MapCore.generate6DCode(event.latLng.lat(), event.latLng.lng());
    const address = {
        region: event.feature.getProperty('OPZ1_EN') || 'N/A',
        district: event.feature.getProperty('ADM2_EN') || 'N/A'
    };
    console.log("Local geocode successful:", address);
    updateInfoPanel(code6D, address, localitySuffix);
}

async function onMapClick(event) {
    if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon)) {
        showFindButton();
        return;
    }
    // This function now acts as the FALLBACK if the data layer click doesn't fire.
    console.warn("Data layer click did not fire. Falling back to Google API.");
    await processLocation(event.latLng);
    const { code6D, localitySuffix, address } = await getAddressForLocation(event.latLng);
    updateInfoPanel(code6D, address, localitySuffix);
}

function handleRecenter() {
    if (lastSelectedLatLng) { map.panTo(lastSelectedLatLng); }
}

async function handleGeolocate() {
    if (!navigator.geolocation) { alert("Geolocation is not supported by your browser."); return; }
    findMyAddressBtn.disabled = true;
    findMyAddressBtn.innerHTML = '<div class="spinner"></div>';
    const successCallback = async (position) => {
        const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        map.setCenter(userLatLng);
        map.setZoom(18);
        // We simulate a map click to trigger the correct handler (data layer or fallback)
        google.maps.event.trigger(map, 'click', { latLng: userLatLng });
    };
    const errorCallback = (error) => { /* ... */ };
    const finalCallback = () => {
        findMyAddressBtn.disabled = false;
        findMyAddressBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location"><span>Find My 6D Address</span>';
    };
    navigator.geolocation.getCurrentPosition(
        (pos) => { successCallback(pos); finalCallback(); },
        (err) => { errorCallback(err); finalCallback(); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// --- Initialization ---
async function loadDistrictData() {
    return new Promise((resolve) => {
        // Use the map's data layer to robustly load and parse the GeoJSON
        map.data.loadGeoJson('/data/somalia_districts.geojson', null, () => {
            console.log("Successfully loaded and parsed somalia_districts.geojson via map.data layer.");
            resolve();
        });
        // Style the district boundaries so they are visible
        map.data.setStyle({
            strokeColor: '#4A90E2',
            strokeOpacity: 0.6,
            strokeWeight: 1.5,
            fillOpacity: 0.0,
            clickable: true // Make the features clickable
        });
    });
}

async function loadSomaliaBoundary() {
    try {
        const response = await fetch('/data/somalia.geojson');
        const geoJson = await response.json();
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        findMyAddressBtn.disabled = false;
    } catch (error) {
        console.error("Failed to load Somalia boundary:", error);
        alert("Error: Could not load country boundary.");
    }
}

async function initApp() {
    findMyAddressBtn = document.getElementById('find-my-address-btn');
    addressContent = document.getElementById('address-content');
    recenterBtn = document.getElementById('recenter-btn');
    
    const mapElement = document.getElementById('map');
    map = MapCore.initializeBaseMap(mapElement, { center: { lat: 2.0469, lng: 45.3182 }, zoom: 13 });
    geocoder = new google.maps.Geocoder();
    
    await Promise.all([loadSomaliaBoundary(), loadDistrictData()]);
    
    // The data layer click is the PRIMARY handler
    map.data.addListener('click', handleDataLayerClick);
    // The map click is the FALLBACK handler
    map.addListener('click', onMapClick);

    findMyAddressBtn.addEventListener('click', handleGeolocate);
    recenterBtn.addEventListener('click', handleRecenter);
    
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    MapCore.updateDynamicGrid(map);
}

async function main() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']);
        await initApp();
    } catch (error) {
        console.error("Failed to initialize map:", error);
        const mapDiv = document.getElementById('map');
        if (mapDiv) {
            mapDiv.innerText = 'Error: Could not load the map. Please check the console for details.';
        }
    }
}

main();