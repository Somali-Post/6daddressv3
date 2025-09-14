// Import the entire module namespace from the CDN.
import * as turf from 'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js';

// Import all necessary functions and variables from local shared modules.
import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';
import * as Utils from './utils.js';
import * as MapCore from './map-core.js';

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

    async function init() {
        try {
            const [_, somaliaData, districtsData] = await Promise.all([
                Utils.loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY),
                fetch('data/somalia.geojson').then(res => res.json()),
                fetch('data/somalia_districts.geojson').then(res => res.json())
            ]);

            somaliaBoundary = somaliaData;
            districtsGeoJson = districtsData;

            map = MapCore.initializeBaseMap(DOM.mapContainer, {
                center: { lat: 2.0469, lng: 45.3182 },
                zoom: 13,
            });

            populateRegionDropdown();
            addEventListeners();

            DOM.findMyLocationBtn.disabled = false;
            DOM.loader.classList.remove('visible');

        } catch (error) {
            console.error("Critical application initialization failed:", error);
            DOM.loader.innerHTML = "<p>Error: Could not load map data. Please refresh.</p>";
        }
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
                animateToLocation(map, { lat: latitude, lng: longitude }, () => {
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

    function processLocation(lat, lng) {
        // CRITICAL FIX: Access Turf functions through the 'default' property of the imported module.
        const point = turf.default.point([lng, lat]);
        if (!turf.default.booleanPointInPolygon(point, somaliaBoundary.features[0].geometry)) {
            console.log("Clicked outside Somalia boundary.");
            return;
        }

        const locationData = getAuthoritativeLocation(point);
        if (!locationData) {
            console.warn("Could not determine district for the selected point.");
            return;
        }

        const { code6D, localitySuffix } = MapCore.generate6DCode(lat, lng);
        currentAddress = { sixDCode: code6D, localitySuffix, lat, lng, ...locationData };

        updateSidebarToRegistration(currentAddress);
        MapCore.drawAddressBoxes(map, new google.maps.LatLng(lat, lng));
        map.panTo({ lat, lng });
    }

    function getAuthoritativeLocation(point) {
        for (const feature of districtsGeoJson.features) {
            // CRITICAL FIX: Access Turf functions through the 'default' property.
            if (turf.default.booleanPointInPolygon(point, feature.geometry)) {
                return {
                    district: feature.properties.DISTRICT,
                    region: feature.properties.REGION,
                };
            }
        }
        return null;
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