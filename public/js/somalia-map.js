(function() {
    'use strict';

    // --- DOM Element Selectors ---
    const DOM = {
        loader: document.getElementById('loader'),
        mapContainer: document.getElementById('map'),
        sidebar: document.getElementById('sidebar'),
        welcomeView: document.getElementById('welcome-view'),
        registrationView: document.getElementById('registration-view'),
        findMyLocationBtn: document.getElementById('find-my-location-btn'),
        registrationForm: document.getElementById('registration-form'),
        reg6dCodeInput: document.getElementById('reg-6d-code'),
        regRegionSelect: document.getElementById('reg-region'),
        regDistrictSelect: document.getElementById('reg-district'),
        regPhoneInput: document.getElementById('reg-phone'),
        regNameInput: document.getElementById('reg-name'),
        registerBtn: document.getElementById('register-btn'),
        modal: document.getElementById('confirmation-modal'),
        confirm6dCode: document.getElementById('confirm-6d-code'),
        confirmLocation: document.getElementById('confirm-location'),
        confirmName: document.getElementById('confirm-name'),
        confirmPhone: document.getElementById('confirm-phone'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
        modalConfirmBtn: document.getElementById('modal-confirm-btn'),
    };

    // --- Application State ---
    let map;
    let somaliaBoundary;
    let districtsGeoJson;
    let currentAddress = null;

    /**
     * Main application initialization function.
     * Follows TR-2 & TR-3: Synchronous async/await chain to prevent race conditions.
     */
    async function init() {
        try {
            // 1. Load Google Maps API and GeoJSON data concurrently
            const [_, somaliaData, districtsData] = await Promise.all([
                Utils.loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY),
                fetch('data/somalia.geojson').then(res => res.json()),
                fetch('data/somalia_districts.geojson').then(res => res.json())
            ]);

            somaliaBoundary = somaliaData;
            districtsGeoJson = districtsData;

            // 2. Initialize the map using the core module
            map = MapCore.initializeMap(DOM.mapContainer, {
                center: { lat: 2.0469, lng: 45.3182 }, // Mogadishu
                zoom: 13,
                disableDefaultUI: true,
                zoomControl: true,
            });

            // 3. Populate UI elements and attach event listeners
            populateRegionDropdown();
            addEventListeners();

            // 4. Enable UI now that all data is loaded (TR-2)
            DOM.findMyLocationBtn.disabled = false;
            DOM.loader.classList.remove('visible');

        } catch (error) {
            console.error("Critical application initialization failed:", error);
            DOM.loader.innerHTML = "<p>Error: Could not load map data. Please refresh.</p>";
        }
    }

    /**
     * Attaches all necessary event listeners for the application.
     */
    function addEventListeners() {
        map.addListener('click', handleMapClick);
        DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
        DOM.regRegionSelect.addEventListener('change', handleRegionChange);
        [DOM.regPhoneInput, DOM.regNameInput, DOM.regDistrictSelect].forEach(el => {
            el.addEventListener('input', validateForm);
        });
        DOM.registrationForm.addEventListener('submit', handleFormSubmit);
        DOM.modalCancelBtn.addEventListener('click', () => toggleModal(false));
        DOM.modalConfirmBtn.addEventListener('click', handleRegistrationConfirm);
    }

    // --- Event Handlers ---

    function handleMapClick(e) {
        processLocation(e.latLng.lat(), e.latLng.lng());
    }

    function handleFindMyLocation() {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        DOM.findMyLocationBtn.disabled = true;
        DOM.findMyLocationBtn.textContent = "Locating...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                MapCore.animateToLocation(map, { lat: latitude, lng: longitude }, () => {
                    processLocation(latitude, longitude);
                });
                DOM.findMyLocationBtn.disabled = false;
                DOM.findMyLocationBtn.innerHTML = `<span class="icon-location"></span> Find My 6D Address`;
            },
            () => {
                alert("Unable to retrieve your location. Please click on the map manually.");
                DOM.findMyLocationBtn.disabled = false;
                DOM.findMyLocationBtn.innerHTML = `<span class="icon-location"></span> Find My 6D Address`;
            }
        );
    }

    function handleRegionChange() {
        const selectedRegion = DOM.regRegionSelect.value;
        populateDistrictDropdown(selectedRegion);
        validateForm();
    }

    function handleFormSubmit(event) {
        event.preventDefault();
        if (!DOM.registerBtn.disabled) {
            populateConfirmationModal();
            toggleModal(true);
        }
    }

    function handleRegistrationConfirm() {
        console.log("Registration confirmed. Sending data to backend...", currentAddress);
        // In a real application, this is where you would call the backend API.
        // For now, we'll just log and close the modal.
        toggleModal(false);
        alert("Registration Successful! (Mocked)");
    }

    // --- Core Logic ---

    /**
     * Processes a latitude/longitude coordinate.
     * Follows TR-5: Authoritative data first.
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     */
    function processLocation(lat, lng) {
        const point = turf.point([lng, lat]);

        // 1. Boundary Check (FR-1, No Map Masking)
        if (!turf.booleanPointInPolygon(point, somaliaBoundary.features[0].geometry)) {
            console.log("Clicked outside Somalia boundary.");
            return;
        }

        // 2. Authoritative Geocoding (TR-5)
        const locationData = getAuthoritativeLocation(point);
        if (!locationData) {
            console.warn("Could not determine district for the selected point.");
            return;
        }

        // 3. Generate 6D Code
        const sixDCode = MapCore.generate6DCode(lat, lng);

        currentAddress = {
            sixDCode,
            lat,
            lng,
            ...locationData
        };

        // 4. Update UI
        updateSidebarToRegistration(currentAddress);
        MapCore.drawAddressBox(map, lat, lng);
    }

    /**
     * Finds the district and region for a point using local GeoJSON data.
     * @param {Object} point - A Turf.js point object.
     * @returns {Object|null} An object with district and region, or null if not found.
     */
    function getAuthoritativeLocation(point) {
        for (const feature of districtsGeoJson.features) {
            if (turf.booleanPointInPolygon(point, feature.geometry)) {
                return {
                    district: feature.properties.DISTRICT,
                    region: feature.properties.REGION,
                };
            }
        }
        return null; // Fallback if not found
    }

    // --- UI Update Functions ---

    function updateSidebarToRegistration(data) {
        DOM.reg6dCodeInput.value = data.sixDCode;
        
        // Set region and trigger district population
        DOM.regRegionSelect.value = data.region;
        populateDistrictDropdown(data.region);
        
        // Set district
        DOM.regDistrictSelect.value = data.district;

        DOM.welcomeView.classList.remove('active');
        DOM.registrationView.classList.add('active');
        validateForm();
    }
    
    function populateRegionDropdown() {
        DOM.regRegionSelect.innerHTML = '<option value="" disabled selected>Select a Region</option>';
        SOMALIA_CONFIG.regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.name;
            option.textContent = region.name;
            DOM.regRegionSelect.appendChild(option);
        });
    }

    function populateDistrictDropdown(regionName) {
        const region = SOMALIA_CONFIG.regions.find(r => r.name === regionName);
        DOM.regDistrictSelect.innerHTML = '<option value="" disabled selected>Select a District</option>';
        if (region) {
            region.districts.forEach(district => {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                DOM.regDistrictSelect.appendChild(option);
            });
        }
    }

    function validateForm() {
        const isPhoneValid = DOM.regPhoneInput.checkValidity();
        const isNameValid = DOM.regNameInput.checkValidity();
        const isDistrictSelected = !!DOM.regDistrictSelect.value;
        
        DOM.registerBtn.disabled = !(isPhoneValid && isNameValid && isDistrictSelected);
    }

    function populateConfirmationModal() {
        DOM.confirm6dCode.textContent = currentAddress.sixDCode;
        DOM.confirmLocation.textContent = `${currentAddress.district}, ${currentAddress.region}`;
        DOM.confirmName.textContent = DOM.regNameInput.value;
        DOM.confirmPhone.textContent = `+252 ${DOM.regPhoneInput.value}`;

        // Also update the currentAddress object with form data
        currentAddress.fullName = DOM.regNameInput.value;
        currentAddress.phoneNumber = DOM.regPhoneInput.value;
    }

    function toggleModal(show) {
        if (show) {
            DOM.modal.classList.add('visible');
        } else {
            DOM.modal.classList.remove('visible');
        }
    }

    // --- Application Entry Point ---
    document.addEventListener('DOMContentLoaded', init);

})();