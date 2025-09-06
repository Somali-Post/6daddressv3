// Main script for the Somalia Registration Map (somalia.html).
import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';

// --- Module-level variables ---
let map;
let geocoder;
let somaliaPolygon;

// --- DOM Element References ---
const sidebar = document.getElementById('registration-sidebar');
const form = document.getElementById('registration-form');
const findMyLocationBtn = document.getElementById('find-my-location-btn');
const regionSelect = document.getElementById('region');
const districtSelect = document.getElementById('district');
const codeInput = document.getElementById('six_d_code');
const nameInput = document.getElementById('full_name');
const phoneInput = document.getElementById('phone_number');
const registerBtn = document.getElementById('register-btn');

// --- UI & Form Logic ---

/**
 * Populates the Region dropdown with all regions from the config.
 */
function populateRegionsDropdown() {
    const regions = Object.keys(somaliRegions);
    regionSelect.innerHTML = '<option value="">Select Region</option>'; // Clear and add placeholder
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
    });
}

/**
 * Updates the District dropdown based on the selected Region.
 */
function updateDistrictsDropdown() {
    const selectedRegion = regionSelect.value;
    const districts = somaliRegions[selectedRegion] || [];
    districtSelect.innerHTML = '<option value="">Select District</option>'; // Clear and add placeholder
    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
    });
    districtSelect.disabled = !selectedRegion;
}

/**
 * Validates the form and enables/disables the register button.
 */
function validateForm() {
    const isValid = nameInput.value.trim() !== '' &&
                    phoneInput.value.trim().length > 5 && // Simple phone validation
                    codeInput.value.trim() !== '' &&
                    regionSelect.value !== '' &&
                    districtSelect.value !== '';
    registerBtn.disabled = !isValid;
}

/**
 * Shows the sidebar, populates it with data, and performs reverse geocoding.
 * @param {string} sixDCode The generated 6D code.
 * @param {google.maps.LatLng} latLng The snapped coordinate.
 */
async function updateAndShowSidebar(sixDCode, latLng) {
    // Reset form fields
    form.reset();
    updateDistrictsDropdown(); // Reset districts
    
    // Pre-populate the 6D code
    codeInput.value = sixDCode;
    
    // Show the sidebar
    sidebar.classList.remove('hidden');

    // Perform reverse geocoding to pre-populate Region and District
    try {
        const response = await geocoder.geocode({ location: latLng });
        if (response.results && response.results[0]) {
            const components = response.results[0].address_components;
            const regionComp = components.find(c => c.types.includes('administrative_area_level_1'));
            const districtComp = components.find(c => c.types.includes('administrative_area_level_2')) || components.find(c => c.types.includes('locality'));

            if (regionComp && somaliRegions[regionComp.long_name]) {
                regionSelect.value = regionComp.long_name;
                updateDistrictsDropdown(); // Update districts for the found region
                if (districtComp) {
                    // Try to select the geocoded district if it exists in our list
                    const districtOption = Array.from(districtSelect.options).find(opt => opt.value === districtComp.long_name);
                    if (districtOption) {
                        districtSelect.value = districtComp.long_name;
                    }
                }
            }
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
    
    validateForm(); // Validate form after populating
}

// --- Event Handlers ---

/**
 * Handles the main map click event.
 * @param {google.maps.MapMouseEvent} event The map click event.
 */
async function onMapClick(event) {
    if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon)) {
        console.log("Clicked outside Somalia.");
        sidebar.classList.add('hidden');
        return;
    }

    const snappedLatLng = MapCore.snapToGridCenter(event.latLng);
    const { code6D } = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());
    
    MapCore.drawAddressBoxes(map, snappedLatLng);
    await updateAndShowSidebar(code6D, snappedLatLng);
}

/**
 * Implements the "Location First" workflow. (FR-S3)
 */
function handleFindMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                map.setCenter(userLatLng);
                map.setZoom(18);
                // Simulate a map click at the user's location to trigger the workflow
                onMapClick({ latLng: userLatLng });
            },
            () => alert("Error: Could not get your location. Please click on the map manually.")
        );
    } else {
        alert("Error: Your browser doesn't support geolocation.");
    }
}

// --- Initialization ---

/**
 * Fetches the Somalia GeoJSON and creates the boundary polygon.
 */
async function loadSomaliaBoundary() {
    try {
        const response = await fetch('/data/somalia.geojson');
        const geoJson = await response.json();
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        console.log("Somalia boundary loaded.");
    } catch (error) {
        console.error("Failed to load Somalia boundary:", error);
        alert("Error: Could not load country boundary. Registration is disabled.");
    }
}

/**
 * Sets up all necessary event listeners for the UI.
 */
function setupUIListeners() {
    map.addListener('click', onMapClick);
    findMyLocationBtn.addEventListener('click', handleFindMyLocation);
    regionSelect.addEventListener('change', updateDistrictsDropdown);
    form.addEventListener('input', validateForm); // Validate on any form input
    
    // TODO: Add form submission handler for OTP workflow
    // form.addEventListener('submit', handleRegistration);
}

/**
 * Initializes the Somalia map application.
 */
function initApp() {
    const mapElement = document.getElementById('map');
    map = MapCore.initializeBaseMap(mapElement, { center: { lat: 2.0469, lng: 45.3182 }, zoom: 13 });
    geocoder = new google.maps.Geocoder();

    populateRegionsDropdown();
    updateDistrictsDropdown();
    loadSomaliaBoundary();
    setupUIListeners();
    validateForm(); // Initial validation check

    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    MapCore.updateDynamicGrid(map);
}

/**
 * Main entry point.
 */
async function main() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY);
        initApp();
    } catch (error) {
        console.error("Failed to load Google Maps API.", error);
        document.getElementById('map').innerText = 'Error: Could not load the map.';
    }
}

main();