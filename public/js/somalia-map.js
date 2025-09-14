// NOTE: All 'import' statements for Turf.js have been removed.

import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';
import * as Utils from './utils.js';
import * as MapCore from './map-core.js';

(function() {
    'use a strict';

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
    let somaliaPolygon; // The google.maps.Polygon object for the country boundary
    let districtPolygons = []; // Array to hold { district, region, polygon } objects
    let currentAddress = null;

    /**
     * Main application initialization function.
     */
    async function init() {
        try {
            // Step 1: Load Google Maps API, requesting the 'geometry' library.
            const [_, somaliaData, districtsData] = await Promise.all([
                Utils.loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']),
                fetch('data/somalia.geojson').then(res => res.json()),
                fetch('data/somalia_districts.geojson').then(res => res.json())
            ]);

            // Step 2: Create the polygon objects from the fetched GeoJSON data.
            createSomaliaPolygon(somaliaData);
            createDistrictPolygons(districtsData);
            
            map = MapCore.initializeBaseMap(DOM.mapContainer, {
                center: { lat: 2.0469, lng: 45.3182 }, // Mogadishu
                zoom: 13,
            });

            populateRegionDropdown();
            addEventListeners();

            // Enable UI only after all critical data and polygons are ready (TR-2)
            DOM.findMyLocationBtn.disabled = false;
            DOM.loader.classList.remove('visible');

        } catch (error) {
            console.error("Critical application initialization failed:", error);
            DOM.loader.innerHTML = "<p>Error: Could not load map data. Please refresh.</p>";
        }
    }

    /**
     * Converts GeoJSON coordinates to Google Maps LatLng objects and creates the main country polygon.
     */
    function createSomaliaPolygon(geoJson) {
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
    }

    /**
     * Converts the districts GeoJSON into an array of Google Maps Polygons for efficient lookups.
     */
    function createDistrictPolygons(districtsGeoJson) {
        districtsGeoJson.features.forEach(feature => {
            // This handles both Polygon and MultiPolygon shapes in the GeoJSON
            const paths = feature.geometry.coordinates.map(polygonPath => 
                polygonPath[0].map(c => ({ lat: c[1], lng: c[0] }))
            );
            const districtPolygon = new google.maps.Polygon({ paths: paths });
            districtPolygons.push({
                district: feature.properties.DISTRICT,
                region: feature.properties.REGION,
                polygon: districtPolygon
            });
        });
    }

    function addEventListeners() {
        map.addListener('click', handleMapClick);
        map.addListener('zoom_changed', () => MapCore.updateDynamicGrid(map));
        map.addListener('idle', () => MapCore.updateDynamicGrid(map));
        DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
        DOM.regRegionSelect.addEventListener('change', handleRegionChange);
        [DOM.regPhoneInput, DOM.regNameInput, DOM.regDistrictSelect].forEach(el => {
            el.addEventListener('input', validateForm);
        });
        DOM.registrationForm.addEventListener('submit', handleFormSubmit);
        DOM.modalCancelBtn.addEventListener('click', () => toggleModal(false));
        DOM.modalConfirmBtn.addEventListener('click', handleRegistrationConfirm);
    }

    /**
     * Handles a click on the map, performing the boundary check first.
     */
    function handleMapClick(e) {
        // Step 3: Perform the point-in-polygon check using the Google Maps Geometry library.
        if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(e.latLng, somaliaPolygon)) {
            console.log("Clicked outside Somalia boundary.");
            return; // Ignore click
        }
        processLocation(e.latLng);
    }

    function handleFindMyLocation() {
        // ... (This function remains the same, it will eventually call processLocation)
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        DOM.findMyLocationBtn.disabled = true;
        DOM.findMyLocationBtn.textContent = "Locating...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(latLng, somaliaPolygon)) {
                     alert("Your current location is outside of Somalia.");
                } else {
                    animateToLocation(map, latLng, () => processLocation(latLng));
                }
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
    
    /**
     * Processes a valid location after it has passed the boundary check.
     * @param {google.maps.LatLng} latLng The location to process.
     */
    function processLocation(latLng) {
        const locationData = getAuthoritativeLocation(latLng);
        if (!locationData) {
            console.warn("Could not determine district for the selected point.");
            return;
        }

        const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
        currentAddress = {
            sixDCode: code6D,
            localitySuffix: localitySuffix,
            lat: latLng.lat(),
            lng: latLng.lng(),
            ...locationData
        };

        updateSidebarToRegistration(currentAddress);
        MapCore.drawAddressBoxes(map, latLng);
        map.panTo(latLng);
    }

    /**
     * Finds the district and region for a point using the pre-compiled district polygons.
     * @param {google.maps.LatLng} latLng The location to check.
     * @returns {Object|null} An object with district and region, or null if not found.
     */
    function getAuthoritativeLocation(latLng) {
        for (const district of districtPolygons) {
            if (google.maps.geometry.poly.containsLocation(latLng, district.polygon)) {
                return {
                    district: district.district,
                    region: district.region,
                };
            }
        }
        return null; // Fallback if not found
    }

    // --- All other UI and form handling functions remain the same ---
    
    function handleRegionChange() {
        populateDistrictDropdown(DOM.regRegionSelect.value);
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
        toggleModal(false);
        alert("Registration Successful! (Mocked)");
    }

    function updateSidebarToRegistration(data) {
        DOM.reg6dCodeInput.value = data.sixDCode;
        DOM.regRegionSelect.value = data.region;
        populateDistrictDropdown(data.region);
        DOM.regDistrictSelect.value = data.district;
        DOM.welcomeView.classList.remove('active');
        DOM.registrationView.classList.add('active');
        validateForm();
    }

    function populateRegionDropdown() {
        DOM.regRegionSelect.innerHTML = '<option value="" disabled selected>Select a Region</option>';
        for (const regionName of Object.keys(somaliRegions)) {
            const option = document.createElement('option');
            option.value = regionName;
            option.textContent = regionName;
            DOM.regRegionSelect.appendChild(option);
        }
    }

    function populateDistrictDropdown(regionName) {
        const districts = somaliRegions[regionName] || [];
        DOM.regDistrictSelect.innerHTML = '<option value="" disabled selected>Select a District</option>';
        districts.forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            DOM.regDistrictSelect.appendChild(option);
        });
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
        currentAddress.fullName = DOM.regNameInput.value;
        currentAddress.phoneNumber = DOM.regPhoneInput.value;
    }

    function toggleModal(show) {
        DOM.modal.classList.toggle('visible', show);
    }

    function animateToLocation(map, latLng, onComplete) {
        map.panTo(latLng);
        map.setZoom(15);
        google.maps.event.addListenerOnce(map, 'idle', () => {
            map.setZoom(18);
            if (onComplete) {
                 google.maps.event.addListenerOnce(map, 'idle', onComplete);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);

})();