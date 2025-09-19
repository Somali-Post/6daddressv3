// public/js/somalia-map.js
// ES Module UI glue for the Somalia Registration Map.
//
// - Preserves your core logic (map-core.js)
// - Reverse geocodes Region/District using Google Geocoder (+Places for sublocality name when available)
// - Populates Region/District dropdowns from your local somaliRegions (config.js)
// - Region is auto-selected + disabled; District auto-selected but remains editable.

import {
  generate6DCode,
  snapToGridCenter,
  drawAddressBoxes,
  updateDynamicGrid,
  // If you have helpers like clearAddressBoxes, import and use them:
  // clearAddressBoxes,
} from './map-core.js';

import { somaliRegions } from './config.js';

// ----------------------------
// Module-scope state
// ----------------------------
let map;
let marker;
let lastSnapped = null;
let activeOverlays = null;
let geocoder;
let placesService;

// ----------------------------
// Helpers: DOM shortcuts
// ----------------------------
const $ = (sel, root = document) => root.querySelector(sel);

// ----------------------------
// Name normalization + synonyms (improve matching)
// ----------------------------
const normalize = (s) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const REGION_SYNONYMS = new Map([
  // Common English variants
  ['benadir', 'banaadir'],
  ['banadir', 'banaadir'],
  // Add others if needed
]);

const DISTRICT_SYNONYMS = new Map([
  // Example: sometimes APIs return "Warta Nabadda" vs "Wardhigley"
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

// ----------------------------
// Local list mapping (config.js)
// ----------------------------
function findRegionByName(name) {
  if (!name) return null;
  const canon = canonicalRegionName(name);
  // somaliRegions: [{ name: 'Banaadir', districts: ['Hodan', ...] }, ...]
  return somaliRegions.find((r) => normalize(r.name) === canon) || null;
}

function findDistrictInRegion(regionObj, districtName) {
  if (!regionObj || !districtName) return null;
  const canon = canonicalDistrictName(districtName);
  const hit = (regionObj.districts || []).find((d) => normalize(d) === canon);
  return hit || null;
}

// ----------------------------
// Populate dropdowns from somaliRegions
// ----------------------------
function populateRegionsDropdown() {
  const regionSel = $('#region');
  if (!regionSel) return;
  // Clear & rebuild
  regionSel.innerHTML = `<option value="">Select a region</option>`;
  for (const r of somaliRegions) {
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
    populateDistrictsDropdown(regionObj.name); // refresh districts for this region
  } else {
    // No match → leave editable and unselected
    regionSel.value = '';
    regionSel.disabled = false;
    populateDistrictsDropdown(''); // clear
  }
}

function autoSelectDistrict(regionName, districtName) {
  const districtSel = $('#district');
  if (!districtSel) return;
  const regionObj = findRegionByName(regionName);
  if (!regionObj) {
    districtSel.value = '';
    districtSel.disabled = false; // stays editable
    return;
  }
  districtSel.disabled = false; // editable
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

async function reverseGeocode(lat, lng) {
  // 1) Geocoder: get address components + place_ids
  const geoResults = await geocoderGeocode({ lat, lng });

  // Pull admin_area_level_1 (Region) from the best available result
  let regionName = '';
  for (const res of geoResults) {
    const candidate = getComponentLongName(res.address_components, 'administrative_area_level_1');
    if (candidate) { regionName = candidate; break; }
  }

  // District priority:
  // P1) Places "sublocality" name (if we can resolve a sublocality result to details)
  // F1) administrative_area_level_2
  // F2) locality or sublocality_level_1
  let districtName = '';

  // Try to find a sublocality-type result and request details via Places
  const sublocalityResult = geoResults.find((r) =>
    r.types?.some(t => t.startsWith('sublocality'))
  );
  if (sublocalityResult?.place_id && placesService) {
    try {
      const place = await placesGetDetails(sublocalityResult.place_id);
      // Only trust it if it really is a sublocality
      if (place?.types?.some(t => t.startsWith('sublocality')) && place.name) {
        districtName = place.name;
      }
    } catch {
      // ignore Places error, we'll fallback
    }
  }

  if (!districtName) {
    // Fallback 1: admin_area_level_2 from any good result
    for (const res of geoResults) {
      const a2 = getComponentLongName(res.address_components, 'administrative_area_level_2');
      if (a2) { districtName = a2; break; }
    }
  }

  if (!districtName) {
    // Fallback 2: locality or sublocality_level_1
    for (const res of geoResults) {
      const loc = getComponentLongName(res.address_components, 'locality')
              || getComponentLongName(res.address_components, 'sublocality_level_1');
      if (loc) { districtName = loc; break; }
    }
  }

  return {
    regionName,
    districtName,
  };
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
    placesService.getDetails({ placeId, fields: ['name', 'types', 'address_components'] }, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) resolve(place);
      else reject(new Error('Places getDetails failed: ' + status));
    });
  });
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
  document.querySelectorAll('.sidebar-view').forEach(v => v.classList.remove('is-active'));
  const panel = $(`#view-${viewId}`);
  if (panel) panel.classList.add('is-active');

  document.querySelectorAll('.sidebar__link').forEach(btn => btn.classList.remove('is-active'));
  const currentBtn = $(`.sidebar__link[data-view="${viewId}"]`);
  if (currentBtn) currentBtn.classList.add('is-active');
}

function renderInfoPanel({ sixD, regionName, districtName, snapped }) {
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

  const btn = $('#btnRegister');
  if (btn) {
    btn.addEventListener('click', () => {
      // Open sidebar to registration and pre-fill fields
      setSidebarExpanded(true);
      showSidebarView('register');

      const codeInput = $('#code');
      if (codeInput) codeInput.value = sixD || '';

      // Region (auto-selected + disabled), District (auto-selected but editable)
      if (regionName) {
        autoSelectRegion(regionName);
        populateDistrictsDropdown($('#region')?.value, districtName);
        autoSelectDistrict($('#region')?.value, districtName);
      } else {
        // If no region resolved, keep UI editable
        $('#region')?.removeAttribute('disabled');
      }
    });
  }
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

  // 3) Draw address boxes
  // if (activeOverlays && clearAddressBoxes) clearAddressBoxes(activeOverlays);
  activeOverlays = drawAddressBoxes(map, snapped);

  // 4) Dynamic grid
  updateDynamicGrid(map, snapped);

  // 5) Marker + center
  placeMarkerLatLng(snapped, !marker);
  map.panTo(snapped);

  // 6) Geocode region/district (hybrid per your specs)
  let regionName = '';
  let districtName = '';
  try {
    const rd = await reverseGeocode(snapped.lat, snapped.lng);
    regionName = rd.regionName || '';
    districtName = rd.districtName || '';
  } catch (e) {
    // Geocoding can fail; keep going with code-only UI
    console.warn('Reverse geocoding failed:', e?.message || e);
  }

  // 7) Update info panel (3-line)
  renderInfoPanel({ sixD, regionName, districtName, snapped });
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

  // Region change → repopulate districts list (kept editable)
  $('#region')?.addEventListener('change', (e) => {
    const regionName = e.target.value;
    populateDistrictsDropdown(regionName);
    // Do NOT disable here; only auto-select path disables region
  });
}

async function initMapOnceReady() {
  await waitForGoogleMaps();

  geocoder = new google.maps.Geocoder();
  // PlacesService requires a map or a div; pass the map after we create it.
  // We'll set placesService once map exists.

  const defaultCenter = { lat: 2.0469, lng: 45.3182 }; // Mogadishu default
  map = new google.maps.Map($('#map'), {
    center: defaultCenter,
    zoom: 12,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  });

  placesService = new google.maps.places.PlacesService(map);

  // Keep dynamic grid reactive
  map.addListener('zoom_changed', () => { if (lastSnapped) updateDynamicGrid(map, lastSnapped); });
  map.addListener('dragend', () => { if (lastSnapped) updateDynamicGrid(map, lastSnapped); });

  // Click → full selection flow
  map.addListener('click', (e) => handleSelectLatLng(e.latLng));

  // Sidebar + view defaults
  setSidebarExpanded(false);
  showSidebarView('welcome');
}

// ----------------------------
// Boot
// ----------------------------
document.addEventListener('DOMContentLoaded', async () => {
  // Build dropdowns from local authoritative list
  populateRegionsDropdown();

  bindUI();

  try {
    await initMapOnceReady();
  } catch (err) {
    console.error('[Maps init] ', err);
  }
});
