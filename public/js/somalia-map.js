// --- Somalia Map Application V2 ---

// --- Global State & Element References ---
let map;
let geocoder;
let somaliaPolygon;
let lastSelectedLatLng = null;
let drawnObjects = { boxes: [], grid: [] };

// This object holds references to all the DOM elements we'll interact with.
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
    modal: document.getElementById('confirmation-modal'),
    modalConfirmBtn: document.getElementById('modal-confirm-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn')
};

// --- Main Initialization ---
// This function is the entry point, called by the Google Maps script.
function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 2.043, lng: 45.333 },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
        // You can add your custom Map ID here later for styling
        // mapId: 'YOUR_CUSTOM_MAP_ID'
    });
    geocoder = new google.maps.Geocoder();
    
    initializeUI();
    loadSomaliaBoundary();

    // Add map click listener
    map.addListener('click', handleMapClick);
}

function initializeUI() {
    ui.findMyAddressBtn.addEventListener('click', handleGeolocate);
    ui.sidebarToggleBtn.addEventListener('click', () => {
        ui.sidebar.classList.toggle('closed');
    });
    map.addListener('dragstart', () => setInfoPanelState('default'));
    
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
        const response = await fetch('../data/somalia.geojson');
        if (!response.ok) throw new Error('Network response was not ok.');
        const geoJson = await response.json();
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        console.log("Somalia boundary loaded successfully.");
    } catch (error) {
        console.error("Failed to load Somalia boundary:", error);
        alert("Critical Error: Could not load country boundary data. The app may not function correctly.");
    }
}

function handleGeolocate() {
    console.log("Find My Address clicked");
    // TODO: Implement geolocation logic
}

function handleMapClick(event) {
    const clickedLatLng = event.latLng;
    if (somaliaPolygon && google.maps.geometry.poly.containsLocation(clickedLatLng, somaliaPolygon)) {
        lastSelectedLatLng = clickedLatLng;
        processLocation(clickedLatLng);
    } else {
        alert("Please click inside Somalia to generate a 6D Address.");
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
    const { code6D, localitySuffix } = generate6DCode(latLng.lat(), latLng.lng());
    
    // Placeholder for real geocoding
    const address = await new Promise(resolve => {
        setTimeout(() => resolve({ district: 'Hodan', region: 'Banaadir' }), 500);
    });

    return { code6D, localitySuffix, address };
}

// --- Drawing Logic ---
function drawAddressBoxes(latLng) {
    const lat = latLng.lat();
    const lon = latLng.lng();
    const boxStyles = {
        '2d': { color: '#ff0000', zIndex: 1, scale: 100, fillOpacity: 0.0 },
        '4d': { color: '#28a745', zIndex: 2, scale: 1000, fillOpacity: 0.0 },
        '6d': { color: '#007bff', zIndex: 3, scale: 10000, fillOpacity: 0.25 }
    };
    for (const key in boxStyles) {
        const style = boxStyles[key];
        const scale = style.scale;
        const cellSize = 1 / scale;
        const swLat = Math.floor(lat * scale) / scale;
        const swLng = Math.floor(lon * scale) / scale;
        const bounds = { south: swLat, west: swLng, north: swLat + cellSize, east: swLng + cellSize };
        const rect = new google.maps.Rectangle({
            strokeColor: style.color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: style.color,
            fillOpacity: style.fillOpacity,
            map: map,
            bounds: bounds,
            zIndex: style.zIndex,
            clickable: false
        });
        drawnObjects.boxes.push(rect);
    }
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
// This makes the initMap function available to be called by the Google Maps script
window.initMap = initMap;