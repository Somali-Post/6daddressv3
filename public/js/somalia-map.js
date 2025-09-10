import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';

// --- Module-level variables ---
let map, geocoder, somaliaPolygon;
let lastSelectedLatLng = null;

// --- DOM Element References ---
let sidebar, form, regionSelect, districtSelect, codeInput, nameInput, phoneInput,
    step1, step2, sendOtpBtn, verifyBtn, otpInput, otpPhoneDisplay, formMessage,
    findMyAddressBtn, recenterBtn;

// --- UI & Form Logic (No changes here) ---
function populateRegionsDropdown() { /* ... */ }
function updateDistrictsDropdown() { /* ... */ }
function validateForm() { /* ... */ }
function displayFormMessage(message, type = 'error') { /* ... */ }
async function updateAndShowSidebar(sixDCode, address) { /* ... */ }

// --- API & Geocoding Logic (No changes here) ---
async function handleSendOtp(event) { /* ... */ }
async function handleVerifyAndRegister(event) { /* ... */ }
async function getAddressForLocation(latLng) { /* ... */ }

// --- FIX APPLIED: Restored Geolocation and Animation Logic ---
async function onMapClick(event) {
    if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon)) {
        sidebar.classList.add('hidden');
        return;
    }
    lastSelectedLatLng = event.latLng;
    recenterBtn.classList.remove('hidden');
    MapCore.drawAddressBoxes(map, event.latLng);
    const { code6D, address } = await getAddressForLocation(event.latLng);
    await updateAndShowSidebar(code6D, address);
}

function handleRecenter() {
    if (lastSelectedLatLng) {
        map.panTo(lastSelectedLatLng);
    }
}

function waitForMapIdle(map) {
    return new Promise(resolve => google.maps.event.addListenerOnce(map, 'idle', resolve));
}

async function animateMapToLocation(userLatLng) {
    map.setZoom(10);
    await waitForMapIdle(map);
    map.panTo(userLatLng);
    await waitForMapIdle(map);
    map.setZoom(14);
    await waitForMapIdle(map);
    map.setZoom(18);
    await waitForMapIdle(map);
    await onMapClick({ latLng: userLatLng });
}

async function handleGeolocate() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }
    findMyAddressBtn.disabled = true;
    findMyAddressBtn.innerHTML = '<div class="spinner"></div>';

    const successCallback = async (position) => {
        const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
        await animateMapToLocation(userLatLng);
    };
    const errorCallback = (error) => {
        switch (error.code) {
            case error.PERMISSION_DENIED: alert("You denied the request for Geolocation."); break;
            case error.POSITION_UNAVAILABLE: alert("Location information is unavailable."); break;
            case error.TIMEOUT: alert("The request to get user location timed out."); break;
            default: alert("An unknown error occurred."); break;
        }
    };
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
// --- END OF FIX ---

// --- Initialization ---
async function loadSomaliaBoundary() {
    try {
        const response = await fetch('/data/somalia.geojson');
        const geoJson = await response.json();
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        findMyAddressBtn.disabled = false;
        findMyAddressBtn.title = 'Find My 6D Address';
        console.log("Somalia boundary loaded. UI is now active.");
    } catch (error) {
        console.error("Failed to load Somalia boundary:", error);
        alert("Error: Could not load country boundary. Registration is disabled.");
    }
}

function setupUIListeners() {
    map.addListener('click', onMapClick);
    findMyAddressBtn.addEventListener('click', handleGeolocate);
    recenterBtn.addEventListener('click', handleRecenter);
    regionSelect.addEventListener('change', updateDistrictsDropdown);
    form.addEventListener('input', validateForm);
    sendOtpBtn.addEventListener('click', handleSendOtp);
    verifyBtn.addEventListener('click', handleVerifyAndRegister);
}

async function initApp() {
    // Assign DOM elements
    sidebar = document.getElementById('registration-sidebar');
    form = document.getElementById('registration-form');
    regionSelect = document.getElementById('region');
    districtSelect = document.getElementById('district');
    codeInput = document.getElementById('six_d_code');
    nameInput = document.getElementById('full_name');
    phoneInput = document.getElementById('phone_number');
    step1 = document.getElementById('step1');
    step2 = document.getElementById('step2');
    sendOtpBtn = document.getElementById('send-otp-btn');
    verifyBtn = document.getElementById('verify-btn');
    otpInput = document.getElementById('otp');
    otpPhoneDisplay = document.getElementById('otp-phone-display');
    formMessage = document.getElementById('form-message');
    findMyAddressBtn = document.getElementById('find-my-address-btn');
    recenterBtn = document.getElementById('recenter-btn');

    const mapElement = document.getElementById('map');
    map = MapCore.initializeBaseMap(mapElement, { center: { lat: 2.0469, lng: 45.3182 }, zoom: 13 });
    geocoder = new google.maps.Geocoder();
    populateRegionsDropdown();
    updateDistrictsDropdown();
    await loadSomaliaBoundary();
    setupUIListeners();
    validateForm();
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    MapCore.updateDynamicGrid(map);
}

async function main() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']);
        await initApp();
    } catch (error) {
        console.error("Failed to load Google Maps API.", error);
        document.body.innerHTML = 'Error: Could not load the map.';
    }
}

main();