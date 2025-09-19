// public/js/somalia-map.js
// ES Module UI glue for the Somalia Registration Map.
// - Preserves your core logic (map-core.js)
// - Robustly reads somaliRegions from config.js in any of these shapes:
//   * [{ name: 'Banaadir', districts: ['Hodan', ...] }, ...]
//   * ['Banaadir', 'Gedo', ...]
//   * { Banaadir: ['Hodan', ...], Gedo: [...] }
//   * default export or named export
//   If none found, falls back to an empty list (logs a warning).

import {
  generate6DCode,
  snapToGridCenter,
  drawAddressBoxes,
  updateDynamicGrid,
  // clearAddressBoxes, // if you have it, import & use before drawAddressBoxes
} from './map-core.js';

import * as CONFIG from './config.js';

// ----------------------------
// Module-scope state
// ----------------------------
let map;
let marker;
let lastSnapped = null;
let activeOverlays = null;
let geocoder;
let placesService;

// Normalized authoritative regions list used everywhere below
let SOMALI_REGIONS = []; // [{ name, districts[] }]

// ----------------------------
// Helpers: DOM shortcuts
// ----------------------------
const $ = (sel, root = document) => root.querySelector(sel);

// ----------------------------
// Config normalization
// ----------------------------
const normalize = (s) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const REGION_SYNONYMS = new Map([
  ['benadir', 'banaadir'],
  ['banadir', 'banaadir'],
]);
const DISTRICT_SYNONYMS = new Map([
  // ['warta nabadda', 'wardhigley'],
]);

function canonicalRegionName(name) {
  const n = normalize(name);
  return REGION_SYNONYMS.get(n) || n;
}
function canonicalDistrictName(name) {
  const n = normalize(name);
  return DISTRICT_SYNONYMS.get(n) || n;
}

/** Convert any supported config shape into [{ name, districts[] }, ...] */
function coerceRegionsShape(input) {
  if (!input) return [];

  // Array?
  if (Array.isArray(input)) {
    // Array of strings -> names only
    if (input.every((x) => typeof x === 'string')) {
      return input.map((name) => ({ name, districts: [] }));
    }
    // Array of objects that already have name/districts
    return input.map((item) => ({
      name: item?.name ?? '',
      districts: Array.isArray(item?.districts) ? item.districts : [],
    }));
  }

  // Object map { RegionName: ['District1', ...], ... }
  if (typeof input === 'object') {
    return Object.keys(input).map((key) => ({
      name: key,
      districts: Array.isArray(input[key]) ? input[key] : [],
    }));
  }

  return [];
}

/** Find the candidate list inside CONFIG and normalize it. */
function resolveSomaliRegions() {
  const candidates = [
    CONFIG.somaliRegions,
    CONFIG.default?.somaliRegions,
    CONFIG.regions,
    CONFIG.default?.regions,
    // If someone attached it globally (not ideal), we still won't crash:
    typeof window !== 'undefined' && window.somaliRegions,
    typeof window !== 'undefined' && window.config?.somaliRegions,
  ].filter(Boolean);

  for (const c of candidates) {
    const normalized = coerceRegionsShape(c);
    if (normalized.length) return normalized;
  }

  console.warn(
    '[config] No usable somaliRegions found in config.js. ' +
      'Dropdowns will be empty until you export a supported shape.'
  );
  return [];
}

// ----------------------------
// Local list mapping
// ----------------------------
function findRegionByName(name) {
  if (!name) return null;
  const canon = canonicalRegionName(name);
  return SOMALI_REGIONS.find((r) => normalize(r.name) === canon) || null;
}

function findDistrictInRegion(regionObj, districtName) {
  if (!regionObj || !districtName) return null;
  const canon = canonicalDistrictName(districtName);
  const hit = (regionObj.districts || []).find((d) => normalize(d) === canon);
  return hit || null;
}

// ----------------------------
// Populate dropdowns from SOMALI_REGIONS
// ----------------------------
function populateRegionsDropdown() {
  const regionSel = $('#region');
  if (!regionSel) return;

  regionSel.innerHTML = `<option value="">Select a region</option>`;
  for (const r of SOMALI_REGIONS) {
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;
    regionSel.appendChild(opt);
  }
}

function populateDistrictsDropdown(regionName, preselectValue) {
  const districtSel = $('#district');
  const regionObj = findRegionByName(regionName);
  if (!districtSel) return;

  districtSel.innerHTML = `<option value="">Select a district</option>`;
  if (!regionObj) return;

  for (const d of regionObj.districts || []) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    districtSel.appendChild(opt);
  }

  if (preselectValue) {
    const match = findDistrictInRegion(regionObj, preselectValue);
    if (match) districtSel.value = match;
  }
}

// ----------------------------
// Region/District selection behavior
// ----------------------------
function autoSelectRegion(regionName) {
  const regionSel = $('#region');
  if (!regionSel) return;
  const regionObj = findRegionByName(regionName);
  if (regionObj) {
    regionSel.value = regionObj.name;
    regionSel.disabled = true; // Region is reliable → read-only
    populateDistrictsDropdown(regionObj.name); // refresh districts
  } else {
    regionSel.value = '';
    regionSel.disabled = false;
    populateDistrictsDropdown('');
  }
}

function autoSelectDistrict(regionName, districtName) {
  const districtSel = $('#district');
  if (!districtSel) return;
  const regionObj = findRegionByName(regionName);
  if (!regionObj) {
    districtSel.value = '';
    districtSel.disabled = false;
    return;
  }
  districtSel.disabled = false;
  const match = findDistrictInRegion(regionObj, districtName);
  districtSel.value = match || '';
}

// ----------------------------
// Reverse Geocoding + Places
// ----------------------------
function getComponentLongName(components, type) {
  const c = (components || []).find((comp) => comp.types?.includes(type));
  return c ? c.long_name : '';
}

function geocoderGeocode({ lat, lng }) {
  return new Promise((resolve, reject) => {
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results && results.length) resolve(results);
      else reject(new Error('Geocoder failed: ' + status));
    });
  });
}

function placesGetDetails(placeId) {
  return new Promise((resolve, reject) => {
    placesService.getDetails(
      { placeId, fields: ['name', 'types', 'address_components'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) resolve(place);
        else reject(new Error('Places getDetails failed: ' + status));
      }
    );
  });
}

/** Your confirmed mapping/fallbacks for Region & District. */
async function reverseGeocode(lat, lng) {
  const geoResults = await geocoderGeocode({ lat, lng });

  // Region: administrative_area_level_1
  let regionName = '';
  for (const res of geoResults) {
    const candidate = getComponentLongName(res.address_components, 'administrative_area_level_1');
    if (candidate) { regionName = candidate; break; }
  }

  // District priority
  let districtName = '';

  // Priority 1: Places sublocality name
  const sublocalityResult = geoResults.find((r) =>
    r.types?.some((t) => t.startsWith('sublocality'))
  );
  if (sublocalityResult?.place_id && placesService) {
    try {
      const place = await placesGetDetails(sublocalityResult.place_id);
      if (place?.types?.some((t) => t.startsWith('sublocality')) && place.name) {
        districtName = place.name;
      }
    } catch { /* ignore, fallback below */ }
  }

  // Fallback 1: administrative_area_level_2
  if (!districtName) {
    for (const res of geoResults) {
      const a2 = getComponentLongName(res.address_components, 'administrative_area_level_2');
      if (a2) { districtName = a2; break; }
    }
  }

  // Fallback 2: locality or sublocality_level_1
  if (!districtName) {
    for (const res of geoResults) {
      const loc =
        getComponentLongName(res.address_components, 'locality') ||
        getComponentLongName(res.address_components, 'sublocality_level_1');
      if (loc) { districtName = loc; break; }
    }
  }

  return { regionName, districtName };
}

// ----------------------------
// Map + UI logic
// ----------------------------
function waitForGoogleMaps(timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    (function tick() {
      const ready =
        typeof window !== 'undefined' &&
        window.google &&
        window.google.maps &&
        typeof window.google.maps.Map === 'function';
      if (ready) return resolve();
      if (Date.now() - startedAt > timeoutMs) return reject(new Error('Google Maps API not available in time'));
      setTimeout(tick, 50);
    })();
  });
}

function placeMarkerLatLng(latLng, withDrop = false) {
  if (!marker) {
    marker = new google.maps.Marker({
      position: latLng,
      map,
      animation: withDrop ? google.maps.Animation.DROP : null,
    });
  } else {
    marker.setPosition(latLng);
  }
}

function setSidebarExpanded(expanded) {
  const sidebar = $('#sidebar');
  if (!sidebar) return;
  if (expanded) {
    sidebar.classList.remove('collapsed');
    sidebar.setAttribute('aria-expanded', 'true');
  } else {
    sidebar.classList.add('collapsed');
    sidebar.setAttribute('aria-expanded', 'false');
  }
}

function showSidebarView(viewId) {
  document.querySelectorAll('.sidebar-view').forEach((v) => v.classList.remove('is-active'));
  const panel = $(`#view-${viewId}`);
  if (panel) panel.classList.add('is-active');

  document.querySelectorAll('.sidebar__link').forEach((btn) => btn.classList.remove('is-active'));
  const currentBtn = $(`.sidebar__link[data-view="${viewId}"]`);
  if (currentBtn) currentBtn.classList.add('is-active');
}

function renderInfoPanel({ sixD, regionName, districtName }) {
  const info = $('#infoPanel');
  if (!info) return;

  const line1 = sixD || '';
  const line2 = districtName || '';
  const line3 = regionName || 'Somalia';

  info.innerHTML = `
    <div class="info-panel__row" style="flex-direction:column;align-items:center;text-align:center;gap:6px;">
      <div style="font-weight:600;font-size:16px;">${line1}</div>
      <div style="opacity:.9;">${line2}</div>
      <div style="opacity:.7;">${line3}</div>
      <div style="height:8px;"></div>
      <button class="btn btn--primary" id="btnRegister">Register This Address</button>
    </div>
  `;

  $('#btnRegister')?.addEventListener('click', () => {
    setSidebarExpanded(true);
    showSidebarView('register');

    const codeInput = $('#code');
    if (codeInput) codeInput.value = line1;

    if (regionName) {
      autoSelectRegion(regionName);
      populateDistrictsDropdown($('#region')?.value, districtName);
      autoSelectDistrict($('#region')?.value, districtName);
    } else {
      $('#region')?.removeAttribute('disabled');
    }
  });
}

async function handleSelectLatLng(rawLatLng) {
  if (!rawLatLng) return;
  const lat = typeof rawLatLng.lat === 'function' ? rawLatLng.lat() : rawLatLng.lat;
  const lng = typeof rawLatLng.lng === 'function' ? rawLatLng.lng() : rawLatLng.lng;

  // 1) Snap to grid center
  const snapped = snapToGridCenter({ lat, lng });
  lastSnapped = snapped;

  // 2) 6D code
  const sixD = generate6DCode(snapped.lat, snapped.lng);

  // 3) Draw address boxes (clear old overlays first if you have a helper)
  // if (activeOverlays && clearAddressBoxes) clearAddressBoxes(activeOverlays);
  activeOverlays = drawAddressBoxes(map, snapped);

  // 4) Dynamic grid
  updateDynamicGrid(map, snapped);

  // 5) Marker + center
  placeMarkerLatLng(snapped, !marker);
  map.panTo(snapped);

  // 6) Resolve Region/District
  let regionName = '';
  let districtName = '';
  try {
    const rd = await reverseGeocode(snapped.lat, snapped.lng);
    regionName = rd.regionName || '';
    districtName = rd.districtName || '';
  } catch (e) {
    console.warn('Reverse geocoding failed:', e?.message || e);
  }

  // 7) Info panel (3-line)
  renderInfoPanel({ sixD, regionName, districtName });
}

function bindUI() {
  // Sidebar toggle (no persistence)
  $('#sidebarToggle')?.addEventListener('click', () => {
    const sb = $('#sidebar');
    const willExpand = sb?.classList.contains('collapsed');
    setSidebarExpanded(!!willExpand);
  });

  // Nav buttons
  document.querySelectorAll('.sidebar__link[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = btn.getAttribute('data-view');
      if (v) showSidebarView(v);
    });
  });

  // Info-panel CTA (Find My 6D Address)
  $('#ctaFind')?.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => handleSelectLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.warn('Geolocation unavailable')
    );
  });

  // Region change → repopulate districts list
  $('#region')?.addEventListener('change', (e) => {
    const regionName = e.target.value;
    populateDistrictsDropdown(regionName);
  });
}

async function initMapOnceReady() {
  await waitForGoogleMaps();

  geocoder = new google.maps.Geocoder();

  const defaultCenter = { lat: 2.0469, lng: 45.3182 }; // Mogadishu
  map = new google.maps.Map($('#map'), {
    center: defaultCenter,
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  placesService = new google.maps.places.PlacesService(map);

  // Grid responsiveness
  map.addListener('zoom_changed', () => { if (lastSnapped) updateDynamicGrid(map, lastSnapped); });
  map.addListener('dragend', () => { if (lastSnapped) updateDynamicGrid(map, lastSnapped); });

  // Click selection
  map.addListener('click', (e) => handleSelectLatLng(e.latLng));

  // UI defaults
  setSidebarExpanded(false);
  showSidebarView('welcome');
}

// ----------------------------
// Boot
// ----------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Normalize regions from config before building UI
  SOMALI_REGIONS = resolveSomaliRegions();

  // Populate dropdowns now that we have a consistent shape
  populateRegionsDropdown();

  bindUI();

  try {
    await initMapOnceReady();
  } catch (err) {
    console.error('[Maps init] ', err);
  }
});
