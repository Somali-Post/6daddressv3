import { GOOGLE_MAPS_API_KEY, somaliRegions } from './config.js';
import * as Utils from './utils.js';
import * as MapCore from './map-core.js';

(function() {
    'use strict';

    // --- DOM Element Selectors ---
    const DOM = {
        loader: document.getElementById('loader'),
        mapContainer: document.getElementById('map'),
        // NEW: Selectors for the Info Panel
        infoPanelInitial: document.getElementById('info-panel-initial'),
        infoPanelAddress: document.getElementById('info-panel-address'),
        infoPanelCode: document.getElementById('info-panel-code'),
        infoPanelDistrict: document.getElementById('info-panel-district'),
        infoPanelRegion: document.getElementById('info-panel-region'),
        findMyLocationBtn: document.getElementById('find-my-location-btn'),
        copyBtn: document.getElementById('copy-btn'),
        shareBtn: document.getElementById('share-btn'),
    };

    // --- Application State ---
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
        DOM.findMyLocationBtn.addEventListener('click', handleFindMyLocation);
        // NOTE: We will add functionality to Copy and Share buttons in the next step.
    }

    function handleMapClick(e) {
        if (!somaliaPolygon || !google.maps.geometry.poly.containsLocation(e.latLng, somaliaPolygon)) {
            console.log("Clicked outside Somalia boundary.");
            return;
        }
        processLocation(e.latLng);
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
    
    function processLocation(latLng) {
        const locationData = getAuthoritativeLocation(latLng);
        if (!locationData) {
            console.warn("Could not determine district for the selected point.");
            return;
        }

        const { code6D, localitySuffix } = MapCore.generate6DCode(latLng.lat(), latLng.lng());
        currentAddress = {
            sixDCode: code6D,
            localitySuffix,
            lat: latLng.lat(),
            lng: latLng.lng(),
            ...locationData
        };

        // NEW: Update the Info Panel instead of the sidebar
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

    /**
     * NEW: This function controls the state of the Info Panel.
     * @param {object} data The address data to display.
     */
    function updateInfoPanel(data) {
        // Populate the address details
        DOM.infoPanelCode.textContent = data.sixDCode;
        DOM.infoPanelDistrict.textContent = data.district;
        DOM.infoPanelRegion.textContent = `${data.region} ${data.localitySuffix}`;

        // Switch the visible panel
        DOM.infoPanelInitial.classList.remove('active');
        DOM.infoPanelAddress.classList.add('active');
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