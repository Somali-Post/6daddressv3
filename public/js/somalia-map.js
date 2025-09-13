import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

// --- Module-level variables ---
let map, geocoder, somaliaPolygon;
let lastSelectedLatLng = null;
let districtFeatures = [];

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
    line1Display.textContent = address.region;
    line2Display.textContent = `${address.district} ${suffix}`.trim();
}

// --- Geocoding Logic ---
function findLocationLocally(latLng) {
    for (const feature of districtFeatures) {
        if (google.maps.geometry.poly.containsLocation(latLng, feature.polygon)) {
            return {
                region: feature.properties.ADM1_EN || 'N/A',
                district: feature.properties.ADM2_EN || 'N/A'
            };
        }
    }
    return null;
}

async function getAddressForLocation(latLng) {
    const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    let address = findLocationLocally(latLng);
    if (!address) {
        console.warn("Local geocode failed. Falling back to Google API.");
        try {
            const response = await geocoder.geocode({ location: latLng });
            if (response.results && response.results[0]) {
                const components = response.results[0].address_components;
                const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name || null;
                address = {
                    region: getComponent('administrative_area_level_1') || 'N/A',
                    district: getComponent('administrative_area_level_2') || getComponent('locality') || 'N/A'
                };
            }
        } catch (error) { console.error("Google Geocoding fallback failed:", error); }
    }
    address = address || { region: 'N/A', district: 'N/A' };
    return { code6D, localitySuffix, address };
}

// --- Event Handlers ---
async function onMapClick(event) {
    if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon)) {
        showFindButton();
        return;
    }
    lastSelectedLatLng = event.latLng;
    recenterBtn.classList.remove('hidden');
    MapCore.drawAddressBoxes(map, event.latLng);
    showAddressDisplay(true);
    const { code6D, localitySuffix, address } = await getAddressForLocation(event.latLng);
    updateInfoPanel(code6D, address, localitySuffix);
}

function handleRecenter() {
    if (lastSelectedLatLng) {
        map.panTo(lastSelectedLatLng);
    }
}

async function handleGeolocate() {
    if (!navigator.geolocation) { alert("Geolocation is not supported by your browser."); return; }
    findMyAddressBtn.disabled = true;
    findMyAddressBtn.innerHTML = '<div class="spinner"></div>';
    const successCallback = async (position) => {
        const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        map.setCenter(userLatLng);
        map.setZoom(18);
        await onMapClick({ latLng: userLatLng });
    };
    const errorCallback = (error) => { /* ... */ };
    const finalCallback = () => {
        findMyAddressBtn.disabled = false;
        findMyAddressBtn.innerHTML = '<img src="/assets/geolocate.svg" alt="Find My Location"><span>Find My 6D Address</span>';
    };
    navigator.geolocation.getCurrentPosition(
        (pos) => { successCallback(pos).finally(finalCallback); },
        (err) => { errorCallback(err); finalCallback(); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// --- Initialization ---
async function loadDistrictData() {
    try {
        const response = await fetch('/data/somalia_districts.geojson');
        const geoJson = await response.json();
        geoJson.features.forEach(feature => {
            if (!feature?.geometry?.coordinates) return;
            const process = (coords) => {
                const paths = coords[0].map(c => ({ lat: c[1], lng: c[0] }));
                const polygon = new google.maps.Polygon({ paths });
                districtFeatures.push({ properties: feature.properties, polygon });
            };
            if (feature.geometry.type === 'Polygon') process([feature.geometry.coordinates]);
            else if (feature.geometry.type === 'MultiPolygon') process(feature.geometry.coordinates);
        });
    } catch (error) { console.error("Failed to load district data:", error); }
}

async function loadSomaliaBoundary() {
    try {
        const response = await fetch('/data/somalia.geojson');
        const geoJson = await response.json();
        const coordinates = geo.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        findMyAddressBtn.disabled = false;
    } catch (error) {
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
    
    map.addListener('click', onMapClick);
    findMyAddressBtn.addEventListener('click', handleGeolocate);
    recenterBtn.addEventListener('click', handleRecenter);
    
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    MapCore.updateDynamicGrid(map);
}

// --- FIX APPLIED: Robust Initialization Sequence ---
async function main() {
    try {
        // Step 1: Wait for the Google Maps API to load
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']);
        
        // Step 2: Now that the API is ready, call initApp to build the application
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
// --- END OF FIX ---