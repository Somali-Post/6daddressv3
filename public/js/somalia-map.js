import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';
import * as Utils from './utils.js';
import * as MapCore from './map-core.js';

(function() {
    'use strict';

    const DOM = {
        loader: document.getElementById('loader'),
        mapContainer: document.getElementById('map'),
        sidebar: document.getElementById('sidebar'),
        welcomeView: document.getElementById('welcome-view'),
        registrationView: document.getElementById('registration-view'),
        infoPanelInitial: document.getElementById('info-panel-initial'),
        infoPanelAddress: document.getElementById('info-panel-address'),
        findMyLocationBtn: document.getElementById('find-my-location-btn'),
        info6dCodeSpans: document.querySelectorAll('#info-6d-code span'),
        infoDistrict: document.getElementById('info-district'),
        infoRegion: document.getElementById('info-region'),
        registerThisAddressBtn: document.getElementById('register-this-address-btn'),
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

    let map;
    let geocoder;
    let placesService;
    let somaliaPolygon;
    let currentAddress = null;

    async function init() {
        try {
            // MODIFIED: Load 'places' library for advanced geocoding
            const [_, somaliaData] = await Promise.all([
                Utils.loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry', 'places']),
                fetch('data/somalia.geojson').then(res => res.json())
            ]);

            createSomaliaPolygon(somaliaData);
            
            map = MapCore.initializeBaseMap(DOM.mapContainer, {
                center: { lat: 2.0469, lng: 45.3182 },
                zoom: 13,
            });

            // Initialize the services we need
            geocoder = new google.maps.Geocoder();
            placesService = new google.maps.places.PlacesService(map);

            addEventListeners();
            DOM.sidebar.classList.add('visible');
            DOM.findMyLocationBtn.disabled = false;
            DOM.loader.classList.remove('visible');

        } catch (error) {
            console.error("Critical application initialization failed:", error);
            DOM.loader.innerHTML = "<p>Error: Could not load map data. Please refresh.</p>";
        }
    }

    function createSomaliaPolygon(geoJson) {
        const coordinates = geoJson.features[0].geometry.coordinates[0].map(c => ({ lat: c[1], lng: c[0] }));
        somaliaPolygon = new google.maps.Polygon({ paths: coordinates });
    }

    function addEventListeners() {
        map.addListener('click', handleMapClick);
        map.addListener('zoom_changed', () => MapCore.updateDynamicGrid(map));
        map.addListener('idle', () => MapCore.updateDynamicGrid(map));
        DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
        DOM.registerThisAddressBtn.addEventListener('click', handleShowRegistrationSidebar);
        DOM.registrationForm.addEventListener('submit', handleFormSubmit);
        [DOM.regPhoneInput, DOM.regNameInput, DOM.regDistrictSelect].forEach(el => {
            el.addEventListener('input', validateForm);
        });
        DOM.modalCancelBtn.addEventListener('click', () => toggleModal(false));
        DOM.modalConfirmBtn.addEventListener('click', handleRegistrationConfirm);
    }

    function handleMapClick(e) {
        if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(e.latLng, somaliaPolygon)) {
            return;
        }
        processLocation(e.latLng);
    }

    function handleFindMyLocation() {
        if (!navigator.geolocation) return alert("Geolocation is not supported.");
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
                alert("Unable to retrieve your location.");
                DOM.findMyLocationBtn.disabled = false;
                DOM.findMyLocationBtn.innerHTML = `<span class="icon-location"></span> Find My 6D Address`;
            }
        );
    }

    // --- MODIFIED: processLocation now uses the multi-layered geocoding ---
    async function processLocation(latLng) {
        const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
        
        updateInfoPanel({ sixDCode: code6D, district: 'Locating...', region: '...' }, localitySuffix);
        MapCore.drawAddressBoxes(map, latLng);
        map.panTo(latLng);

        const [geocodeComponents, placeResult] = await Promise.all([
            getReverseGeocode(latLng),
            getPlaceDetails(latLng)
        ]);

        const finalAddress = parseAddressComponents(geocodeComponents, placeResult);

        currentAddress = {
            sixDCode: code6D,
            localitySuffix,
            lat: latLng.lat(),
            lng: latLng.lng(),
            ...finalAddress
        };

        updateInfoPanel(currentAddress, localitySuffix);
    }

    // --- NEW AND REPLACED GEOCODING FUNCTIONS ---

    function getReverseGeocode(latLng) {
        return new Promise((resolve) => {
            geocoder.geocode({ location: latLng }, (results, status) => {
                resolve((status === 'OK' && results[0]) ? results[0].address_components : []);
            });
        });
    }

    function getPlaceDetails(latLng) {
        return new Promise((resolve) => {
            const request = { location: latLng, rankBy: google.maps.places.RankBy.DISTANCE };
            placesService.nearbySearch(request, (results, status) => {
                resolve((status === google.maps.places.PlacesServiceStatus.OK && results[0]) ? results[0] : null);
            });
        });
    }

    function parseAddressComponents(geocodeComponents, placeResult) {
        const getComponent = (type) => {
            const component = geocodeComponents.find(c => c.types.includes(type));
            return component ? component.long_name : null;
        };
        
        let district = '';
        // Prioritize the hyper-local name from the Places API if it exists and is not a generic road name.
        if (placeResult && placeResult.name && !placeResult.types.includes('route')) {
            district = placeResult.name;
        } else {
            // Fallback to the Geocoding API's hierarchy
            district = getComponent('sublocality_level_1') || 
                       getComponent('locality') || 
                       getComponent('administrative_area_level_2') || 
                       '';
        }
        
        const region = getComponent('administrative_area_level_1') || 
                       getComponent('country') || 
                       '';

        return { district, region };
    }
    
    // --- END OF NEW GEOCODING FUNCTIONS ---

    function updateInfoPanel(data, suffix) {
        DOM.infoPanelInitial.classList.add('hidden');
        DOM.infoPanelAddress.classList.remove('hidden');

        const codeParts = data.sixDCode.split('-');
        if (DOM.info6dCodeSpans && DOM.info6dCodeSpans.length === 3) {
            DOM.info6dCodeSpans[0].textContent = codeParts[0];
            DOM.info6dCodeSpans[1].textContent = codeParts[1];
            DOM.info6dCodeSpans[2].textContent = codeParts[2];
        }

        if (DOM.infoDistrict) {
            DOM.infoDistrict.textContent = data.district || '';
        }
        if (DOM.infoRegion) {
            const regionText = data.region || '';
            DOM.infoRegion.textContent = `${regionText} ${suffix}`.trim();
        }
    }

    function handleShowRegistrationSidebar() {
        if (!currentAddress) return;
        populateRegistrationForm(currentAddress);
        DOM.welcomeView.classList.remove('active');
        DOM.registrationView.classList.add('active');
    }

    function populateRegistrationForm(data) {
        populateRegionDropdown();
        DOM.reg6dCodeInput.value = data.sixDCode;
        DOM.regRegionSelect.value = data.region;
        populateDistrictDropdown(data.region);
        DOM.regDistrictSelect.value = data.district;
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

    function handleFormSubmit(event) {
        event.preventDefault();
        if (!DOM.registerBtn.disabled) {
            populateConfirmationModal();
            toggleModal(true);
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
        currentAddress.fullName = DOM.regNameInput.value;
        currentAddress.phoneNumber = DOM.regPhoneInput.value;
    }

    function toggleModal(show) {
        DOM.modal.classList.toggle('visible', show);
    }

    function handleRegistrationConfirm() {
        console.log("Registration confirmed. Sending data to backend...", currentAddress);
        toggleModal(false);
        alert("Registration Successful! (Mocked)");
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