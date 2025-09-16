import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';
import * as Utils from './utils.js';
import * as MapCore from './map-core.js';

(function() {
    'use strict';

    const DOM = {
        loader: document.getElementById('loader'),
        mapContainer: document.getElementById('map'),
        sidebar: document.getElementById('sidebar'),
        infoPanelInitial: document.getElementById('info-panel-initial'),
        infoPanelAddress: document.getElementById('info-panel-address'),
        findMyLocationBtn: document.getElementById('find-my-location-btn'),
        info6dCodeSpans: document.querySelectorAll('#info-6d-code span'),
        infoDistrict: document.getElementById('info-district'),
        infoRegion: document.getElementById('info-region'),
        registerThisAddressBtn: document.getElementById('register-this-address-btn'),
        registrationForm: document.getElementById('registration-form'),
        modal: document.getElementById('confirmation-modal'),
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
            const [_, somaliaData] = await Promise.all([
                Utils.loadGoogleMapsAPI(GOOGLE_MAPS_API_KEY, ['geometry', 'places']),
                fetch('data/somalia.geojson').then(res => res.json())
            ]);

            createSomaliaPolygon(somaliaData);
            
            map = MapCore.initializeBaseMap(DOM.mapContainer, {
                center: { lat: 2.0469, lng: 45.3182 },
                zoom: 13,
            });

            geocoder = new google.maps.Geocoder();
            placesService = new google.maps.places.PlacesService(map);

            addEventListeners();
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
        DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
        // This is where the error was happening. These elements now exist.
        DOM.registerThisAddressBtn.addEventListener('click', handleShowRegistrationSidebar);
        DOM.registrationForm.addEventListener('submit', handleFormSubmit);
        DOM.modalCancelBtn.addEventListener('click', () => toggleModal(false));
        DOM.modalConfirmBtn.addEventListener('click', handleRegistrationConfirm);
    }

    function handleMapClick(e) {
        if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(e.latLng, somaliaPolygon)) {
            return;
        }
        processLocation(e.latLng);
    }

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
            sixDCode: code6D, localitySuffix, lat: latLng.lat(), lng: latLng.lng(), ...finalAddress
        };
        updateInfoPanel(currentAddress, localitySuffix);
    }
    
    // All other functions (getReverseGeocode, updateInfoPanel, etc.) remain the same.
    // ...

    document.addEventListener('DOMContentLoaded', init);

})();