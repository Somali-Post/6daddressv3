// public/js/somalia-map.js

import {
  generate6DCode,
  snapToGridCenter,
  drawAddressBoxes,
  updateDynamicGrid,
} from './map-core.js';
import * as CONFIG from './config.js';

// ------------ Config normalization (unchanged from earlier robust version)
const normalize = (s) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const REGION_SYNONYMS = new Map([['benadir', 'banaadir'], ['banadir', 'banaadir']]);
const DISTRICT_SYNONYMS = new Map([]);

const $ = (sel, root = document) => root.querySelector(sel);

function coerceRegionsShape(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    if (input.every((x) => typeof x === 'string')) {
      return input.map((name) => ({ name, districts: [] }));
    }
    return input.map((item) => ({
      name: item?.name ?? '',
      districts: Array.isArray(item?.districts) ? item.districts : [],
    }));
  }
  if (typeof input === 'object') {
    return Object.keys(input).map((key) => ({
      name: key,
      districts: Array.isArray(input[key]) ? input[key] : [],
    }));
  }
  return [];
}

function resolveSomaliRegions() {
  const candidates = [
    CONFIG.somaliRegions,
    CONFIG.default?.somaliRegions,
    CONFIG.regions,
    CONFIG.default?.regions,
    typeof window !== 'undefined' && window.somaliRegions,
    typeof window !== 'undefined' && window.config?.somaliRegions,
  ].filter(Boolean);

  for (const c of candidates) {
    const normalized = coerceRegionsShape(c);
    if (normalized.length) return normalized;
  }
  console.warn('[config] No usable somaliRegions found in config.js.');
  return [];
}

function canonicalRegionName(name) {
  const n = normalize(name);
  return REGION_SYNONYMS.get(n) || n;
}
function canonicalDistrictName(name) {
  const n = normalize(name);
  return DISTRICT_SYNONYMS.get(n) || n;
}

let SOMALI_REGIONS = [];

// ------------ State
let map;
let marker;
let lastSnapped = null;
let activeOverlays = null;
let geocoder;
let placesService;

// ------------ Dropdown population
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
function populateRegionsDropdown() {
  const regionSel = $('#region');
  if (!regionSel) return;
  regionSel.innerHTML = `<option value="">Select a region</option>`;
  for (const r of SOMALI_REGIONS) {
    const opt = document.createElement('option');
    opt.value = r.name; opt.textContent = r.name;
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
    opt.value = d; opt.textContent = d;
    districtSel.appendChild(opt);
  }
  if (preselectValue) {
    const match = findDistrictInRegion(regionObj, preselectValue);
    if (match) districtSel.value = match;
  }
}
function autoSelectRegion(regionName) {
  const regionSel = $('#region');
  if (!regionSel) return;
  const regionObj = findRegionByName(regionName);
  if (regionObj) {
    regionSel.value = regionObj.name;
    regionSel.disabled = true;
    populateDistrictsDropdown(regionObj.name);
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

// ------------ Geocoding
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
async function reverseGeocode(lat, lng) {
  const geoResults = await geocoderGeocode({ lat, lng });

  let regionName = '';
  for (const res of geoResults) {
    const a1 = getComponentLongName(res.address_components, 'administrative_area_level_1');
    if (a1) { regionName = a1; break; }
  }

  let districtName = '';
  const sublocalityResult = geoResults.find((r) => r.types?.some((t) => t.startsWith('sublocality')));
  if (sublocalityResult?.place_id && placesService) {
    try {
      const place = await placesGetDetails(sublocalityResult.place_id);
      if (place?.types?.some((t) => t.startsWith('sublocality')) && place.name) {
        districtName = place.name;
      }
    } catch {}
  }
  if (!districtName) {
    for (const res of geoResults) {
      const a2 = getComponentLongName(res.address_components, 'administrative_area_level_2');
      if (a2) { districtName = a2; break; }
    }
  }
  if (!districtName) {
    for (const res of geoResults) {
      const loc = getComponentLongName(res.address_components, 'locality')
               || getComponentLongName(res.address_components, 'sublocality_level_1');
      if (loc) { districtName = loc; break; }
    }
  }
  return { regionName, districtName };
}

// ------------ Map utilities
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
      position: latLng, map,
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

// ------------ NEW: recenter visibility controller
function updateRecenterVisibility() {
  const btn = $('#btnRecenter');
  if (!btn || !map || !lastSnapped) return;

  // Require geometry library; guard just in case
  const hasGeom = !!(google.maps.geometry && google.maps.geometry.spherical);
  if (!hasGeom) { btn.style.display = 'none'; return; }

  const dist = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(lastSnapped.lat, lastSnapped.lng),
    map.getCenter()
  );
  const thresholdMeters = 350; // show recenter if user pans ~>350m away
  btn.style.display = dist > thresholdMeters ? 'inline-flex' : 'none';
}

// ------------ Info panel renderer (UPDATED)
function renderInfoPanel({ sixD, regionName, districtName }) {
  const info = $('#infoPanel');
  if (!info) return;

  const codeText = typeof sixD === 'string' ? sixD : (sixD?.code6D || '');
  const line1 = codeText || '';
  const line2 = districtName || '';
  const line3 = regionName || 'Somalia';

  // Small icon button styles (inline to avoid CSS file changes)
  const iconBtnStyle = `
    display:inline-flex;align-items:center;justify-content:center;
    width:32px;height:32px;border:1px solid rgba(255,255,255,0.15);
    border-radius:8px;background:rgba(255,255,255,0.04);cursor:pointer
  `;

  info.innerHTML = `
    <div class="info-panel__row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="display:flex;flex-direction:column;gap:4px;min-width:220px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div id="codeText" style="font-weight:600;font-size:16px;">${line1}</div>
          <div style="display:flex;gap:6px;">
            <!-- Copy -->
            <button id="btnCopy" title="Copy address" aria-label="Copy address" style="${iconBtnStyle}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2" opacity="0.8"/>
              </svg>
            </button>
            <!-- Share (placeholder) -->
            <button id="btnShare" title="Share" aria-label="Share" style="${iconBtnStyle}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="2"/>
                <circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                <circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="2"/>
                <path d="M8.9 11l6.2-4.2M8.9 13l6.2 4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <!-- Recenter (hidden by default) -->
            <button id="btnRecenter" title="Recenter" aria-label="Recenter" style="${iconBtnStyle};display:none;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                <path d="M12 2v4M22 12h-4M12 22v-4M2 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div style="opacity:.9;">${line2}</div>
        <div style="opacity:.7;">${line3}</div>
      </div>

      <button class="btn btn--primary" id="btnRegister">Register This Address</button>
    </div>
  `;

  // Copy handler
  $('#btnCopy')?.addEventListener('click', async () => {
    const fullText = `${line1}${line2 ? ' — ' + line2 : ''}${line3 ? ', ' + line3 : ''}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = fullText;
        document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      }
      // tiny UX hint: flash the code text
      const el = $('#codeText');
      if (el) {
        el.style.opacity = '0.6';
        setTimeout(() => (el.style.opacity = '1'), 180);
      }
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  });

  // Share (placeholder)
  $('#btnShare')?.addEventListener('click', () => {
    // Intentionally no-op for now
  });

  // Recenter
  $('#btnRecenter')?.addEventListener('click', () => {
    if (lastSnapped && map) {
      map.panTo(lastSnapped);
      // Hide button after recenter
      updateRecenterVisibility();
    }
  });

  // Register
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

  // Ensure proper initial visibility for recenter
  updateRecenterVisibility();
}

// ------------ Selection flow (unchanged except final render call)
async function handleSelectLatLng(rawLatLng) {
  if (!rawLatLng) return;
  const lat = typeof rawLatLng.lat === 'function' ? rawLatLng.lat() : rawLatLng.lat;
  const lng = typeof rawLatLng.lng === 'function' ? rawLatLng.lng() : rawLatLng.lng;

  const snapped = snapToGridCenter({ lat, lng });
  lastSnapped = snapped;

  const sixD = generate6DCode(snapped.lat, snapped.lng);
  activeOverlays = drawAddressBoxes(map, snapped);
  updateDynamicGrid(map, snapped);

  placeMarkerLatLng(snapped, !marker);
  map.panTo(snapped);

  let regionName = '', districtName = '';
  try {
    const rd = await reverseGeocode(snapped.lat, snapped.lng);
    regionName = rd.regionName || '';
    districtName = rd.districtName || '';
  } catch (e) {
    console.warn('Reverse geocoding failed:', e?.message || e);
  }

  renderInfoPanel({ sixD, regionName, districtName });
}

// ------------ Bind + init
function bindUI() {
  $('#sidebarToggle')?.addEventListener('click', () => {
    const sb = $('#sidebar');
    const willExpand = sb?.classList.contains('collapsed');
    setSidebarExpanded(!!willExpand);
  });

  $('#ctaFind')?.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => handleSelectLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => console.warn('Geolocation unavailable')
    );
  });

  $('#region')?.addEventListener('change', (e) => {
    const regionName = e.target.value;
    populateDistrictsDropdown(regionName);
  });
}

async function initMapOnceReady() {
  await waitForGoogleMaps();

  geocoder = new google.maps.Geocoder();

  const defaultCenter = { lat: 2.0469, lng: 45.3182 };
  map = new google.maps.Map($('#map'), {
    center: defaultCenter, zoom: 12,
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
  });

  placesService = new google.maps.places.PlacesService(map);

  // Keep grid reactive
  map.addListener('zoom_changed', () => {
    if (lastSnapped) updateDynamicGrid(map, lastSnapped);
  });
  map.addListener('dragend', () => {
    if (lastSnapped) updateDynamicGrid(map, lastSnapped);
  });

  // NEW: update recenter visibility whenever the map settles
  map.addListener('idle', () => updateRecenterVisibility());

  // Click → select
  map.addListener('click', (e) => handleSelectLatLng(e.latLng));

  setSidebarExpanded(false);
  // No welcome panel; sidebar content per logged-out spec
}

document.addEventListener('DOMContentLoaded', async () => {
  SOMALI_REGIONS = resolveSomaliRegions();
  populateRegionsDropdown();
  bindUI();
  try {
    await initMapOnceReady();
  } catch (err) {
    console.error('[Maps init] ', err);
  }
});
