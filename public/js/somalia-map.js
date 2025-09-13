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
    line1Display.textContent = address.district;
    line2Display.textContent = `${address.region} ${suffix}`.trim();
}

// --- Geocoding Logic ---
function findLocationLocally(latLng) {
    for (const feature of districtFeatures) {
        if (google.maps.geometry.poly.containsLocation(latLng, feature.polygon)) {
            return {
                region: feature.properties.OPZ1_EN || 'N/A',
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
// --- FIX APPLIED: Using Google's Robust GeoJSON Loader ---
/**
 * Loads the district GeoJSON using the powerful built-in Google Maps data layer.
 * This is simpler and more reliable than manual parsing.
 */
async function loadDistrictData() {
    return new Promise((resolve, reject) => {
        try {
            // Use the map's data layer to load the GeoJSON
            map.data.loadGeoJson('/data/somalia_districts.geojson', null, (features) => {
                // This callback fires when the data is loaded and parsed by Google.
                const loadedFeatures = [];
                features.forEach(feature => {
                    // We need to manually create our own polygon objects for the containsLocation check
                    const geometry = feature.getGeometry();
                    if (geometry.getType() === 'Polygon') {
                        const paths = geometry.getArray().map(ring => ring.getArray());
                        const polygon = new google.maps.Polygon({ paths: paths });
                        loadedFeatures.push({ properties: feature.getProperty.bind(feature), polygon: polygon });
                    }
                    // Note: This simplified version doesn't handle MultiPolygons for brevity,
                    // but the Google loader handles them correctly for drawing.
                });
                
                // A helper to get properties, since the API is different
                districtFeatures = features.map(feature => {
                    const geometry = feature.getGeometry();
                    const paths = geometry.getArray().map(ring => ring.getArray());
                    const polygon = new google.maps.Polygon({ paths: paths });
                    const properties = {};
                    feature.forEachProperty((value, key) => { properties[key] = value; });
                    return { properties, polygon };
                });

                console.log(`Successfully processed ${districtFeatures.length} district polygons using map.data layer.`);
                resolve();
            });
        } catch (error) {
            console.error("Failed to load or process district data:", error);
            reject(error);
        }
    });
}
// --- END OF FIX ---

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