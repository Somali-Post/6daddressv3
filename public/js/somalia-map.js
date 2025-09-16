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
    let somaliaPolygon;
    let districtPolygons = [];
    let currentAddress = null;

    async function init() {
        try {
            const [_, somaliaData, districtsData] = await Promise.all([
                Utils.loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry']),
                fetch('data/somalia.geojson').then(res => res.json()),
                fetch('data/somalia_districts.geojson').then(res => res.json())
            ]);

            createSomaliaPolygon(somaliaData);
            createDistrictPolygons(districtsData);
            
            map = MapCore.initializeBaseMap(DOM.mapContainer, {
                center: { lat: 2.0469, lng: 45.3182 },
                zoom: 13,
            });

            addEventListeners();
            DOM.sidebar.classList.add('visible'); // Show welcome sidebar on load
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

    function createDistrictPolygons(districtsGeoJson) {
        districtsGeoJson.features.forEach(feature => {
            const geometry = feature.geometry;
            let paths = [];
            if (geometry.type === 'Polygon') {
                paths = geometry.coordinates.map(linearRing => linearRing.map(c => ({ lat: c[1], lng: c[0] })));
            } else if (geometry.type === 'MultiPolygon') {
                paths = geometry.coordinates.flatMap(polygon => polygon.map(linearRing => linearRing.map(c => ({ lat: c[1], lng: c[0] }))));
            }
            if (paths.length > 0) {
                const districtPolygon = new google.maps.Polygon({ paths: paths });
                districtPolygons.push({
                    district: feature.properties.DISTRICT,
                    region: feature.properties.REGION,
                    polygon: districtPolygon
                });
            }
        });
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

    function processLocation(latLng) {
    const locationData = getAuthoritativeLocation(latLng);

    // CRITICAL FIX: This check now stops the function completely if no district is found.
    if (!locationData) {
        console.warn("Could not determine district for the selected point. It may be in a coastal area or outside defined district boundaries.");
        // We do NOT update the info panel, leaving it in its previous state.
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

    updateInfoPanel(currentAddress);
    MapCore.drawAddressBoxes(map, latLng);
    map.panTo(latLng);
}

    function getAuthoritativeLocation(latLng) {
        for (const district of districtPolygons) {
            if (google.maps.geometry.poly.containsLocation(latLng, district.polygon)) {
                return { district: district.district, region: district.region };
            }
        }
        return null;
    }

    function updateInfoPanel(data) {
        DOM.infoPanelInitial.classList.add('hidden');
        DOM.infoPanelAddress.classList.remove('hidden');

        const codeParts = data.sixDCode.split('-');
        DOM.info6dCodeSpans[0].textContent = codeParts[0];
        DOM.info6dCodeSpans[1].textContent = codeParts[1];
        DOM.info6dCodeSpans[2].textContent = codeParts[2];

        DOM.infoDistrict.textContent = data.district;
        DOM.infoRegion.textContent = `${data.region} ${data.localitySuffix}`;
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