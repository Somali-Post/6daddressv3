import * as MapCore from './map-core.js';
import { loadGoogleMapsAPI, debounce } from './utils.js';
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';

// --- Module-level variables ---
let map, geocoder, somaliaPolygon;

// --- DOM Element References (will be assigned in initApp) ---
let sidebar, form, findMyLocationBtn, regionSelect, districtSelect, codeInput, nameInput, phoneInput,
    step1, step2, sendOtpBtn, verifyBtn, otpInput, otpPhoneDisplay, formMessage;

// --- UI & Form Logic ---
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
    // This line is now corrected to use the right variable
    sendOtpBtn.disabled = !isValid;
}

function displayFormMessage(message, type = 'error') {
    formMessage.textContent = message;
    formMessage.className = `form-message ${type}`;
}

async function updateAndShowSidebar(sixDCode, latLng) {
    form.reset();
    updateDistrictsDropdown();
    codeInput.value = sixDCode;
    sidebar.classList.remove('hidden');
    step1.classList.remove('hidden');
    step2.classList.add('hidden');

    try {
        const response = await geocoder.geocode({ location: latLng });
        if (response.results && response.results[0]) {
            const components = response.results[0].address_components;
            const regionComp = components.find(c => c.types.includes('administrative_area_level_1'));
            const districtComp = components.find(c => c.types.includes('administrative_area_level_2')) || components.find(c => c.types.includes('locality'));

            if (regionComp && somaliRegions[regionComp.long_name]) {
                regionSelect.value = regionComp.long_name;
                updateDistrictsDropdown();
                if (districtComp) {
                    const districtOption = Array.from(districtSelect.options).find(opt => opt.value === districtComp.long_name);
                    if (districtOption) districtSelect.value = districtComp.long_name;
                }
            }
        }
    } catch (error) { console.error("Geocoding failed:", error); }
    
    validateForm();
}

// --- API Communication ---
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
        fullName: nameInput.value,
        phoneNumber: phoneInput.value,
        sixDCode: codeInput.value,
        region: regionSelect.value,
        district: districtSelect.value,
        otp: otpInput.value
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
async function onMapClick(event) {
    if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon)) {
        sidebar.classList.add('hidden');
        return;
    }
    const snappedLatLng = MapCore.snapToGridCenter(event.latLng);
    const { code6D } = MapCore.generate6DCode(snappedLatLng.lat(), snappedLatLng.lng());
    MapCore.drawAddressBoxes(map, snappedLatLng);
    await updateAndShowSidebar(code6D, snappedLatLng);
}

function handleFindMyLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                map.setCenter(userLatLng);
                map.setZoom(18);
                onMapClick({ latLng: userLatLng });
            },
            () => alert("Error: Could not get your location.")
        );
    } else { alert("Error: Your browser doesn't support geolocation."); }
}

// --- Initialization ---
async function loadSomaliaBoundary() {
    try {
        const response = await fetch('/data/somalia.geojson');
        const geoJson = await response.json();
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
    } catch (error) {
        console.error("Failed to load Somalia boundary:", error);
        alert("Error: Could not load country boundary. Registration is disabled.");
    }
}

function setupUIListeners() {
    map.addListener('click', onMapClick);
    findMyLocationBtn.addEventListener('click', handleFindMyLocation);
    regionSelect.addEventListener('change', updateDistrictsDropdown);
    form.addEventListener('input', validateForm);
    sendOtpBtn.addEventListener('click', handleSendOtp);
    verifyBtn.addEventListener('click', handleVerifyAndRegister);
}

function initApp() {
    sidebar = document.getElementById('registration-sidebar');
    form = document.getElementById('registration-form');
    findMyLocationBtn = document.getElementById('find-my-location-btn');
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
    loadSomaliaBoundary();
    setupUIListeners();
    validateForm();
    const debouncedUpdateGrid = debounce(() => MapCore.updateDynamicGrid(map), 250);
    map.addListener('idle', debouncedUpdateGrid);
    MapCore.updateDynamicGrid(map);
}

async function main() {
    try {
        await loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']);
        initApp();
    } catch (error) {
        console.error("Failed to load Google Maps API.", error);
        document.getElementById('map').innerText = 'Error: Could not load the map.';
    }
}

main();