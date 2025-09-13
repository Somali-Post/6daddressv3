// --- Somalia Map Application V2 ---

// --- Global State & Element References ---
let map;
let geocoder;
let somaliaPolygon;
let lastSelectedLatLng = null;
let drawnObjects = { boxes: [], grid: [] };

const ui = {
    infoPanel: document.getElementById('info-panel'),
    infoPanelDefault: document.getElementById('info-panel-default'),
    infoPanelClicked: document.getElementById('info-panel-clicked'),
    findMyAddressBtn: document.getElementById('find-my-address-btn'),
    infoCode: document.getElementById('info-code-display'),
    infoDistrict: document.getElementById('info-district-display'),
    infoRegion: document.getElementById('info-region-display'),
    registerBtn: document.getElementById('register-btn'),
    copyBtn: document.getElementById('copy-btn'),
    shareBtn: document.getElementById('share-btn'),
    recenterBtn: document.getElementById('recenter-btn'),
    sidebar: document.getElementById('registration-sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    welcomeView: document.getElementById('sidebar-welcome-view'),
    loginBtn: document.getElementById('login-btn'),
    // Add other sidebar views and form elements here as we build them
};

// --- Main Initialization ---
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 2.043, lng: 45.333 },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        // Add a Map ID here later to use your custom "Silver" style
    });
    geocoder = new google.maps.Geocoder();
    
    initializeUI();
    loadSomaliaBoundary();
}

function initializeUI() {
    // Event Listeners
    ui.findMyAddressBtn.addEventListener('click', handleGeolocate);
    ui.sidebarToggleBtn.addEventListener('click', () => ui.sidebar.classList.toggle('closed'));
    map.addListener('dragstart', () => setInfoPanelState('default')); // Reset panel on map drag
    
    // TODO: Add listeners for other buttons (copy, share, recenter, register, login)
}

// --- State Management ---
function setInfoPanelState(state, data = {}) {
    if (state === 'default') {
        ui.infoPanelDefault.classList.remove('hidden');
        ui.infoPanelClicked.classList.add('hidden');
    } else if (state === 'clicked') {
        const { code, address, suffix } = data;
        const codeParts = code.split('-');
        ui.infoCode.innerHTML = `<span class="code-part-1">${codeParts[0]}</span>-<span class="code-part-2">${codeParts[1]}</span>-<span class="code-part-3">${codeParts[2]}</span>`;
        ui.infoDistrict.textContent = address.district;
        ui.infoRegion.textContent = `${address.region} ${suffix}`;
        
        ui.infoPanelDefault.classList.add('hidden');
        ui.infoPanelClicked.classList.remove('hidden');
    }
}

// --- Map & Geocoding Logic ---
async function loadSomaliaBoundary() {
    try {
        const response = await fetch('../data/somalia.geojson'); // Relative path
        const geoJson = await response.json();
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        console.log("Somalia boundary loaded.");
    } catch (error) {
        console.error("Failed to load Somalia boundary:", error);
    }
}

function handleGeolocate() {
    // TODO: Implement geolocation logic
    // 1. Check if location is inside somaliaPolygon
    // 2. If yes, pan map and call handleMapClick
    // 3. If no, show error in info panel
    console.log("Find My Address clicked");
}

function handleMapClick(event) {
    const clickedLatLng = event.latLng;
    if (somaliaPolygon && google.maps.geometry.poly.containsLocation(clickedLatLng, somaliaPolygon)) {
        lastSelectedLatLng = clickedLatLng;
        processLocation(clickedLatLng);
    } else {
        // TODO: Show "Please click inside Somalia" error in info panel
        console.log("Clicked outside Somalia");
    }
}

async function processLocation(latLng) {
    clearMapObjects('boxes');
    drawAddressBoxes(latLng);
    
    const { code6D, localitySuffix, address } = await getAddressForLocation(latLng);
    
    setInfoPanelState('clicked', {
        code: code6D,
        address: address,
        suffix: localitySuffix
    });
}

async function getAddressForLocation(latLng) {
    // This function will contain the geocoding logic
    // For now, returning placeholder data
    const { code6D, localitySuffix } = generate6DCode(latLng.lat(), latLng.lng());
    return { 
        code6D, 
        localitySuffix, 
        address: { district: 'Hodan', region: 'Banaadir' } 
    };
}

// --- Drawing Logic ---
function drawAddressBoxes(latLng) {
    // ... (This function remains the same as our global map version)
}

function clearMapObjects(type) {
    if (type === 'boxes') {
        drawnObjects.boxes.forEach(box => box.setMap(null));
        drawnObjects.boxes = [];
    }
}

// --- Utility & 6D Code Logic ---
function generate6DCode(lat, lon) {
    const absLat = Math.abs(lat); const absLon = Math.abs(lon);
    const lat_d1 = Math.floor(absLat * 10) % 10; const lat_d2 = Math.floor(absLat * 100) % 10; const lat_d3 = Math.floor(absLat * 1000) % 10; const lat_d4 = Math.floor(absLat * 10000) % 10;
    const lon_d1 = Math.floor(absLon * 10) % 10; const lon_d2 = Math.floor(absLon * 100) % 10; const lon_d3 = Math.floor(absLon * 1000) % 10; const lon_d4 = Math.floor(absLon * 10000) % 10;
    const code6D = `${lat_d2}${lon_d2}-${lat_d3}${lon_d3}-${lat_d4}${lon_d4}`; const localitySuffix = `${lat_d1}${lon_d1}`;
    return { code6D, localitySuffix };
}

// --- Global Initialization ---
window.initMap = initMap;