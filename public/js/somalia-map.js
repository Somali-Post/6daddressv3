import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';

// --- Module-level variables ---
let map, geocoder, somaliaPolygon;
let lastSelectedLatLng = null;
let districtFeatures = [];

// --- DOM Element References ---
let sidebar, form, regionSelect, districtSelect, codeInput, nameInput, phoneInput,
    step1, step2, sendOtpBtn, verifyBtn, otpInput, otpPhoneDisplay, formMessage,
    findMyAddressBtn, addressContent, recenterBtn;

// --- UI & Form Logic ---
function showAddressDisplay() {
    findMyAddressBtn.classList.add('hidden');
    addressContent.classList.remove('hidden');
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

function populateRegionsDropdown() {
    const regions = Object.keys(somaliRegions);
    regionSelect.innerHTML = '<option value="">Select Region</option>';
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        regionSelect.appendChild(option);
    });
}

function updateDistrictsDropdown() {
    const selectedRegion = regionSelect.value;
    const districts = somaliRegions[selectedRegion] || [];
    districtSelect.innerHTML = '<option value="">Select District</option>';
    districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        districtSelect.appendChild(option);
    });
    districtSelect.disabled = !selectedRegion;
}

function validateForm() {
    const isValid = nameInput.value.trim() !== '' &&
                    phoneInput.value.trim().length > 5 &&
                    codeInput.value.trim() !== '' &&
                    regionSelect.value !== '' &&
                    districtSelect.value !== '';
    sendOtpBtn.disabled = !isValid;
}

function displayFormMessage(message, type = 'error') {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
}

async function updateAndShowSidebar(sixDCode, address) {
    form.reset();
    updateDistrictsDropdown();
    codeInput.value = sixDCode;
    if (address.region && somaliRegions[address.region]) {
        regionSelect.value = address.region;
        updateDistrictsDropdown();
        if (address.district) {
            const districtOption = Array.from(districtSelect.options).find(opt => opt.value === address.district);
            if (districtOption) districtSelect.value = districtOption.value;
        }
    }
    sidebar.classList.remove('hidden');
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    validateForm();
}

// --- API & Geocoding Logic ---
async function handleSendOtp(event) {
    event.preventDefault();
    displayFormMessage('', '');
    sendOtpBtn.disabled = true;
    sendOtpBtn.innerHTML = '<div class="spinner"></div>';
    try {
        const response = await fetch('/api/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: phoneInput.value })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to send OTP.');
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
        otpPhoneDisplay.textContent = phoneInput.value;
        otpInput.focus();
    } catch (error) {
        displayFormMessage(error.message, 'error');
    } finally {
        sendOtpBtn.disabled = false;
        sendOtpBtn.innerHTML = 'Send Verification Code';
    }
}

async function handleVerifyAndRegister(event) {
    event.preventDefault();
    displayFormMessage('', '');
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<div class="spinner"></div>';
    const formData = {
        fullName: nameInput.value, phoneNumber: phoneInput.value, sixDCode: codeInput.value,
        region: regionSelect.value, district: districtSelect.value, otp: otpInput.value
    };
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Registration failed.');
        displayFormMessage('Registration successful! Your address is now verified.', 'success');
        step2.innerHTML = '<p>Thank you for registering.</p>';
    } catch (error) {
        displayFormMessage(error.message, 'error');
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = 'Verify & Complete Registration';
    }
}

// --- FIX APPLIED: More Robust Local Geocoding ---
function findLocationLocally(latLng) {
    for (const feature of districtFeatures) {
        if (google.maps.geometry.poly.containsLocation(latLng, feature.polygon)) {
            const props = feature.properties;
            // Check for common property names to make the function more robust.
            const region = props.ADM1_EN || props.region || props.REGION || 'N/A';
            const district = props.ADM2_EN || props.district || props.DISTRICT || 'N/A';
            return { region, district };
        }
    }
    return null;
}

async function getAddressForLocation(latLng) {
    const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    
    // Step 1: Try to find the address with our fast, local data first.
    let address = findLocationLocally(latLng);

    // Step 2: If, and ONLY IF, the local search fails, then use Google as a fallback.
    if (!address) {
        console.warn("Local geocode failed. Falling back to Google API.");
        try {
            const response = await geocoder.geocode({ location: latLng });
            if (response.results && response.results[0]) {
                const components = response.results[0].address_components;
                const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name || null;
                
                // Construct the address object from Google's data
                address = {
                    region: getComponent('administrative_area_level_1') || 'N/A',
                    district: getComponent('administrative_area_level_2') || getComponent('locality') || 'N/A'
                };
            }
        } catch (error) {
            console.error("Google Geocoding fallback failed:", error);
        }
    }
    
    // Ensure we always have a valid address object to return.
    address = address || { region: 'N/A', district: 'N/A' };
    
    return { code6D, localitySuffix, address };
}
// --- Event Handlers ---
async function handleLocationFound(latLng) {
    lastSelectedLatLng = latLng;
    recenterBtn.classList.remove('hidden');
    MapCore.drawAddressBoxes(map, latLng);
    showAddressDisplay();
    document.getElementById('code-display').textContent = 'Locating...';
    document.getElementById('line1-display').textContent = '';
    document.getElementById('line2-display').textContent = '';
    const { code6D, localitySuffix, address } = await getAddressForLocation(latLng);
    updateInfoPanel(code6D, address, localitySuffix);
    return { code6D, address };
}

async function onMapClick(event) {
    if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon)) {
        sidebar.classList.add('hidden');
        return;
    }
    const { code6D, address } = await handleLocationFound(event.latLng);
    await updateAndShowSidebar(code6D, address);
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
        await animateMapToLocation(userLatLng);
    };
    const errorCallback = (error) => {
        switch (error.code) { /* ... */ }
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

function waitForMapIdle(map) {
    return new Promise(resolve => google.maps.event.addListenerOnce(map, 'idle', resolve));
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
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        findMyAddressBtn.disabled = false;
    } catch (error) {
        alert("Error: Could not load country boundary.");
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
    findMyAddressBtn = document.getElementById('find-my-address-btn');
    addressContent = document.getElementById('address-content');
    recenterBtn = document.getElementById('recenter-btn');
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
    
    const mapElement = document.getElementById('map');
    map = MapCore.initializeBaseMap(mapElement, { center: { lat: 2.0469, lng: 45.3182 }, zoom: 13 });
    geocoder = new google.maps.Geocoder();
    
    populateRegionsDropdown();
    updateDistrictsDropdown();
    
    await Promise.all([loadSomaliaBoundary(), loadDistrictData()]);
    
    setupUIListeners();
    validateForm();
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    MapCore.updateDynamicGrid(map);
}

async function main() {
    try {
        window.initMap = initApp;
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']);
    } catch (error) {
        document.getElementById('map').innerText = 'Error: Could not load the map.';
    }
}

main();