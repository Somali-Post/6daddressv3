// --- Global Variables ---
let map, geocoder, somaliaPolygon;
let lastSelectedLatLng = null;
let districtFeatures = []; // Will hold our high-quality district data
let drawnObjects = []; // For the colored 6D boxes
let gridLines = [];    // For the dynamic grid

// --- DOM Element References ---
// We will get these inside initMap once the DOM is ready
let sidebar, form, regionSelect, districtSelect, codeInput, nameInput, phoneInput,
    step1, step2, sendOtpBtn, verifyBtn, otpInput, otpPhoneDisplay, formMessage,
    findMyAddressBtn, addressContent, recenterBtn, codeDisplay, line1Display, line2Display;

// --- Data (Can be moved to a config file later) ---
const somaliRegions = { "Awdal": ["Baki", "Borama", "Lughaya", "Zeila"], "Bakool": ["El Barde", "Hudur", "Rabdhure", "Tiyeglow", "Wajid"], "Banaadir": ["Abdiaziz", "Bondhere", "Daynile", "Hamar-Jajab", "Hamar-Weyne", "Hawle Wadag", "Hodan", "Kaaraan", "Shibis", "Waberi", "Wadajir", "Wardhigley", "Yaqshid"], "Bari": ["Alula", "Bandarbeyla", "Bosaso", "Iskushuban", "Qandala", "Ufeyn"], "Bay": ["Baidoa", "Burhakaba", "Dinsor", "Qasahdhere"], "Galguduud": ["Abudwak", "Adado", "Dhusa Mareb", "El Buur", "El Dher"], "Gedo": ["Baardheere", "Beled Hawo", "Doolow", "El Wak", "Garbahaarey", "Luuq"], "Hiiraan": ["Beledweyne", "Buloburde", "Jalalaqsi", "Mataban"], "Lower Juba": ["Afmadow", "Badhadhe", "Jamame", "Kismayo"], "Lower Shabelle": ["Afgooye", "Barawa", "Kurtunwarey", "Merca", "Qoryoley", "Wanlaweyn"], "Middle Juba": ["Bu'ale", "Jilib", "Sakow"], "Middle Shabelle": ["Adan Yabal", "Balad", "Jowhar", "Mahaday"], "Mudug": ["Galkayo", "Galdogob", "Harardhere", "Hobyo", "Jariban"], "Nugal": ["Burtinle", "Eyl", "Garowe"], "Sanaag": ["Badhan", "El Afweyn", "Erigavo", "Dhahar"], "Sool": ["Aynabo", "Las Anod", "Taleh", "Hudun"], "Togdheer": ["Buhoodle", "Burao", "Oodweyne", "Sheikh"], "Woqooyi Galbeed": ["Berbera", "Gabiley", "Hargeisa"] };

// --- THE SINGLE ENTRY POINT, CALLED BY GOOGLE MAPS API ---
async function initMap() {
    // 1. Get all DOM element references
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
    codeDisplay = document.getElementById('code-display');
    line1Display = document.getElementById('line1-display');
    line2Display = document.getElementById('line2-display');

    // 2. Initialize the map
    const mapElement = document.getElementById('map');
    map = new google.maps.Map(mapElement, {
        center: { lat: 2.0469, lng: 45.3182 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        // Add other map styles and options here
    });

    // 3. Initialize the geocoder
    geocoder = new google.maps.Geocoder();

    // 4. Load data and set up UI in parallel for speed
    await Promise.all([
        loadSomaliaBoundary(),
        loadDistrictData()
    ]);
    
    // 5. Set up all event listeners now that the map and data are ready
    setupUIListeners();

    // 6. Initialize the form state
    populateRegionsDropdown();
    updateDistrictsDropdown();
    validateForm();
    
    // 7. Draw the initial grid
    updateDynamicGrid();
}

// Make initMap globally available for the Google Maps callback
window.initMap = initMap;


// --- Data Loading and Initialization ---

async function loadDistrictData() {
    try {
        const response = await fetch('/data/somalia_districts.geojson');
        const geoJson = await response.json();
        geoJson.features.forEach(feature => {
            if (!feature?.geometry?.coordinates) return;
            const process = (polygons) => {
                polygons.forEach(polyCoords => {
                    if (polyCoords && polyCoords.length > 0) {
                        const paths = polyCoords[0].map(c => ({ lat: c[1], lng: c[0] }));
                        districtFeatures.push({
                            properties: feature.properties,
                            polygon: new google.maps.Polygon({ paths })
                        });
                    }
                });
            };
            if (feature.geometry.type === 'Polygon') process([feature.geometry.coordinates]);
            if (feature.geometry.type === 'MultiPolygon') process(feature.geometry.coordinates);
        });
        console.log(`${districtFeatures.length} district features loaded successfully.`);
    } catch (error) {
        console.error("Failed to load Somalia district data:", error);
    }
}

async function loadSomaliaBoundary() {
    try {
        const response = await fetch('/data/somalia.geojson');
        const geoJson = await response.json();
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
        findMyAddressBtn.disabled = false;
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
    const debouncedUpdateGrid = debounce(updateDynamicGrid, 250);
    map.addListener('idle', debouncedUpdateGrid);
}

// --- Geocoding Logic (Local First, Google Fallback) ---

function findLocationLocally(latLng) {
    for (const feature of districtFeatures) {
        if (google.maps.geometry.poly.containsLocation(latLng, feature.polygon)) {
            // NOTE: Adjust property names to match your new GeoJSON file
            return {
                region: feature.properties.ADM1_EN || 'N/A',
                district: feature.properties.ADM2_EN || 'N/A'
            };
        }
    }
    return null; // Return null if no match is found
}

async function getAddressForLocation(latLng) {
    const { code6D, localitySuffix } = generate6DCode(latLng.lat(), latLng.lng());
    let address = findLocationLocally(latLng);

    if (!address) {
        console.warn("Local geocode failed. Falling back to Google API.");
        try {
            const response = await geocoder.geocode({ location: latLng });
            if (response.results && response.results[0]) {
                const components = response.results[0].address_components;
                const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name;
                address = {
                    region: getComponent('administrative_area_level_1') || 'N/A',
                    district: getComponent('administrative_area_level_2') || getComponent('locality') || 'N/A'
                };
            }
        } catch (error) {
            console.error("Google Geocoding fallback failed:", error);
        }
    }
    
    return { code6D, localitySuffix, address: address || { region: 'N/A', district: 'N/A' } };
}

// --- Event Handlers ---

async function onMapClick(event) {
    if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(event.latLng, somaliaPolygon)) {
        sidebar.classList.add('hidden');
        return;
    }
    const { code6D, address } = await handleLocationFound(event.latLng);
    await updateAndShowSidebar(code6D, address);
}

async function handleLocationFound(latLng) {
    lastSelectedLatLng = latLng;
    recenterBtn.classList.remove('hidden');
    drawAddressBoxes(map, latLng);
    
    codeDisplay.textContent = 'Locating...';
    line1Display.textContent = '';
    line2Display.textContent = '';
    showAddressDisplay();

    const { code6D, localitySuffix, address } = await getAddressForLocation(latLng);
    updateInfoPanel(code6D, address, localitySuffix);
    return { code6D, address };
}

// ... (handleGeolocate, animateMapToLocation, and other handlers remain the same) ...


// --- All other functions (generate6DCode, drawAddressBoxes, UI logic, etc.) ---
// These are assumed to be present and correct from the previous versions.
// For completeness, I will include the key ones that were missing or scattered.

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function generate6DCode(lat, lon) {
    const absLat = Math.abs(lat);
    const absLon = Math.abs(lon);
    const lat_d1 = Math.floor(absLat * 10) % 10;
    const lat_d2 = Math.floor(absLat * 100) % 10;
    const lat_d3 = Math.floor(absLat * 1000) % 10;
    const lat_d4 = Math.floor(absLat * 10000) % 10;
    const lon_d1 = Math.floor(absLon * 10) % 10;
    const lon_d2 = Math.floor(absLon * 100) % 10;
    const lon_d3 = Math.floor(absLon * 1000) % 10;
    const lon_d4 = Math.floor(absLon * 10000) % 10;
    const code6D = `${lat_d2}${lon_d2}-${lat_d3}${lon_d3}-${lat_d4}${lon_d4}`;
    const localitySuffix = `${lat_d1}${lon_d1}`;
    return { code6D, localitySuffix };
}

function drawAddressBoxes(map, latLng) {
    clearMapObjects();
    const lat = latLng.lat();
    const lon = latLng.lng();
    const boxStyles = {
        '2d': { color: '#D32F2F', zIndex: 4, scale: 100,  fillOpacity: 0.0 },
        '4d': { color: '#388E3C', zIndex: 5, scale: 1000, fillOpacity: 0.0 },
        '6d': { color: '#1976D2', zIndex: 6, scale: 10000,fillOpacity: 0.15 }
    };
    for (const key in boxStyles) {
        const style = boxStyles[key];
        const scale = style.scale;
        const cellSize = 1 / scale;
        const swLat = Math.floor(lat * scale) / scale;
        const swLng = Math.floor(lon * scale) / scale;
        const bounds = { south: swLat, west: swLng, north: swLat + cellSize, east: swLng + cellSize };
        drawnObjects.push(new google.maps.Rectangle({
            strokeColor: style.color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: style.color,
            fillOpacity: style.fillOpacity,
            map: map,
            bounds: bounds,
            zIndex: style.zIndex,
            clickable: false
        }));
    }
}

function clearMapObjects() {
    drawnObjects.forEach(obj => obj.setMap(null));
    drawnObjects = [];
}

function updateDynamicGrid() {
    clearGridLines();
    const zoom = map.getZoom();
    const bounds = map.getBounds();
    if (!bounds) return;
    const spacing = getGridSpacingForZoom(zoom);
    if (spacing === null) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const gridStyle = { strokeColor: '#333333', strokeOpacity: 0.3, strokeWeight: 1, clickable: false, zIndex: 2 };
    for (let lat = Math.floor(sw.lat() / spacing) * spacing; lat < ne.lat(); lat += spacing) {
        gridLines.push(new google.maps.Polyline({ ...gridStyle, path: [{ lat: lat, lng: sw.lng() }, { lat: lat, lng: ne.lng() }], map: map }));
    }
    for (let lng = Math.floor(sw.lng() / spacing) * spacing; lng < ne.lng(); lng += spacing) {
        gridLines.push(new google.maps.Polyline({ ...gridStyle, path: [{ lat: sw.lat(), lng: lng }, { lat: ne.lat(), lng: lng }], map: map }));
    }
}

function getGridSpacingForZoom(zoom) {
    if (zoom >= 17) return 0.0001;
    else if (zoom >= 13) return 0.01;
    else return null;
}

function clearGridLines() {
    gridLines.forEach(line => line.setMap(null));
    gridLines = [];
}