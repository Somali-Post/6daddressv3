import { GOOGLE_MAPS_API_KEY } from './config.js';
import * as Utils from './utils.js';
import * as MapCore from './map-core.js';

(function() {
    'use strict';

    // The DOM object is now synchronized with the new HTML structure.
    const DOM = {
        loader: document.getElementById('loader'),
        mapContainer: document.getElementById('map'),
        sidebar: document.getElementById('sidebar'),
        sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
        
        // Info Panel Views
        infoPanelInitial: document.getElementById('info-panel-initial'),
        infoPanelLoading: document.getElementById('info-panel-loading'),
        infoPanelAddress: document.getElementById('info-panel-address'),
        
        // Info Panel Buttons & Content
        findMyLocationBtn: document.getElementById('find-my-location-btn'),
        registerThisAddressBtn: document.getElementById('register-this-address-btn'),
        infoCodeDisplay: document.querySelector('#info-panel-address .code-display'),
        infoLocationText: document.querySelector('#info-panel-address .location-text'),
        copyBtn: document.getElementById('copy-btn'),
        shareBtn: document.getElementById('share-btn'),
        recenterBtn: document.getElementById('recenter-btn'),
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

    // Event listeners now only reference elements that exist in the new HTML.
    function addEventListeners() {
        map.addListener('click', handleMapClick);
        map.addListener('dragend', () => {
            if (currentAddress) {
                DOM.recenterBtn.classList.remove('hidden');
            }
        });

        DOM.sidebarToggleBtn.addEventListener('click', () => {
            DOM.sidebar.classList.toggle('is-expanded');
        });
        DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
        DOM.registerThisAddressBtn.addEventListener('click', handleShowRegistrationSidebar);
        DOM.copyBtn.addEventListener('click', handleCopyAddress);
        DOM.recenterBtn.addEventListener('click', handleRecenterMap);
    }

    function handleMapClick(e) {
        if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(e.latLng, somaliaPolygon)) {
            return;
        }
        processLocation(e.latLng);
    }

    function handleFindMyLocation() {
        if (!navigator.geolocation) return alert("Geolocation is not supported.");
        
        switchInfoPanelView('loading');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(latLng, somaliaPolygon)) {
                     alert("Your current location is outside of Somalia.");
                     switchInfoPanelView('initial');
                } else {
                    animateToLocation(map, latLng, () => processLocation(latLng));
                }
            },
            () => {
                alert("Unable to retrieve your location.");
                switchInfoPanelView('initial');
            }
        );
    }

    async function processLocation(latLng) {
        switchInfoPanelView('loading');
        DOM.recenterBtn.classList.add('hidden');
        
        MapCore.drawAddressBoxes(map, latLng);
        map.panTo(latLng);

        const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
        
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

        updateInfoPanel(currentAddress);
        switchInfoPanelView('address');
    }

    function getReverseGeocode(latLng) {
        return new Promise((resolve) => {
            geocoder.geocode({ location: latLng }, (results, status) => {
                resolve((status === 'OK' && results[0]) ? results[0].address_components : []);
            });
        });
    }

    function getPlaceDetails(latLng) {
        return new Promise((resolve) => {
            const request = {
                location: latLng,
                rankBy: google.maps.places.RankBy.DISTANCE,
                type: 'sublocality'
            };
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
        if (placeResult && placeResult.name && !placeResult.types.includes('route')) {
            district = placeResult.name;
        } else {
            district = getComponent('sublocality_level_1') || getComponent('locality') || getComponent('administrative_area_level_2') || '';
        }
        
        const region = getComponent('administrative_area_level_1') || getComponent('country') || '';
        return { district, region };
    }

    function switchInfoPanelView(viewName) {
        ['initial', 'loading', 'address'].forEach(view => {
            const element = DOM[`infoPanel${view.charAt(0).toUpperCase() + view.slice(1)}`];
            element.classList.toggle('active', view === viewName);
        });
    }
    
    function updateInfoPanel(data) {
        DOM.infoCodeDisplay.textContent = data.sixDCode;
        DOM.infoLocationText.textContent = `${data.district}, ${data.region} ${data.localitySuffix}`;
    }

    function handleShowRegistrationSidebar() {
        if (!currentAddress) return;
        DOM.sidebar.classList.add('is-expanded');
        // In the future, this will also switch the sidebar view to the registration form.
        alert(`Triggering registration for: ${currentAddress.sixDCode}`);
    }

    function handleCopyAddress() {
        if (!currentAddress) return;
        const addressString = `${currentAddress.sixDCode}\n${currentAddress.district}, ${currentAddress.region} ${currentAddress.localitySuffix}`;
        navigator.clipboard.writeText(addressString).then(() => {
            alert("Address copied to clipboard!");
        });
    }

    function handleRecenterMap() {
        if (!currentAddress) return;
        map.panTo({ lat: currentAddress.lat, lng: currentAddress.lng });
        DOM.recenterBtn.classList.add('hidden');
    }

    function animateToLocation(map, latLng, onComplete) {
        map.panTo(latLng);
        map.setZoom(18);
        if (onComplete) {
            google.maps.event.addListenerOnce(map, 'idle', onComplete);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

})();