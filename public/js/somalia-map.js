import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';

// --- Module-level variables ---
let map, geocoder, somaliaPolygon;
let lastSelectedLatLng = null;

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
    line1Display.textContent = address.region;
    line2Display.textContent = `${address.district} ${suffix}`.trim();
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
function parseSomaliaAddress(components) {
    const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name || null;
    return {
        region: getComponent('administrative_area_level_1') || 'N/A',
        district: getComponent('administrative_area_level_2') || getComponent('locality') || 'N/A'
    };
}

async function getAddressForLocation(latLng) {
    const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
    try {
        const response = await geocoder.geocode({ location: latLng });
        if (response.results && response.results[0]) {
            const address = parseSomaliaAddress(response.results[0].address_components);
            return { code6D, localitySuffix, address };
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
    return { code6D, localitySuffix, address: { region: 'N/A', district: 'N/A' } };
}

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
    addressContent = document.getElementById('address-content');
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
        document.getElementById('map').innerText = 'Error: Could not load the map.';
    }
}

main();