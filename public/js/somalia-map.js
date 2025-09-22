// Hide dashboard by default on page load
document.addEventListener('DOMContentLoaded', () => {
  const dash = document.getElementById('dashboard');
  if (dash) dash.style.display = 'none';
});
// --- Sidebar transformation and session persistence ---
let appState = { isAuthenticated: false, user: null };

function renderSidebarLoggedIn() {
  const sidebarScroll = document.querySelector('.sidebar__scroll');
  if (!sidebarScroll) return;
  sidebarScroll.innerHTML = `
    <nav class="sidebar__nav" aria-label="Main">
      <a class="sidebar__link active" id="sidebar-dashboard" href="#"><span class="sidebar__icon">🏠</span><span class="link-text">Dashboard</span></a>
      <a class="sidebar__link" id="sidebar-history" href="#"><span class="sidebar__icon">🕑</span><span class="link-text">History</span></a>
      <a class="sidebar__link" id="sidebar-settings" href="#"><span class="sidebar__icon">⚙️</span><span class="link-text">Settings</span></a>
      <a class="sidebar__link" id="sidebar-logout" href="#"><span class="sidebar__icon">🚪</span><span class="link-text">Logout</span></a>
    </nav>
    <div class="sidebar__profile" style="margin-top:2.5em;display:flex;flex-direction:column;align-items:center;gap:0.5em;">
      <div class="profile-avatar" style="width:48px;height:48px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:1.7rem;">👤</div>
      <div class="profile-name" style="font-weight:600;">User</div>
      <div class="profile-phone" style="font-size:0.97rem;color:#888;">+252 ••••••••</div>
    </div>
  `;
    // Render dashboard in sidebar
    renderDashboardInSidebar();
    // Hide info panel if open
    const infoPanel = document.getElementById('info-panel');
    if (infoPanel) infoPanel.style.display = 'none';
    // Sidebar nav handlers
    document.getElementById('sidebar-dashboard')?.addEventListener('click', (e) => {
      e.preventDefault();
      renderDashboardInSidebar();
    });
    document.getElementById('sidebar-logout')?.addEventListener('click', () => {
      localStorage.removeItem('sessionToken');
      appState.isAuthenticated = false;
      // Remove dashboard from sidebar
      const dash = document.getElementById('sidebar-dashboard-panel');
      if (dash) dash.remove();
      renderSidebarLoggedOut();
    });
}

function renderSidebarLoggedOut() {
  // Remove dashboard from sidebar if present
  const dash = document.getElementById('sidebar-dashboard-panel');
  if (dash) dash.remove();
  window.location.reload(); // simplest: reload to restore original sidebar
}

function checkSessionOnLoad() {
  const token = localStorage.getItem('sessionToken');
  if (token) {
    appState.isAuthenticated = true;
    renderSidebarLoggedIn();
  }
}

document.addEventListener('DOMContentLoaded', checkSessionOnLoad);
// --- OTP Verification and Session Logic ---
function handleOtpSuccess(token) {
  // Store session token in localStorage
  localStorage.setItem('sessionToken', token);
  closeAuthModal();
  appState.isAuthenticated = true;
  renderSidebarLoggedIn();
}

document.addEventListener('DOMContentLoaded', () => {
  // OTP form submit
  const otpForm = document.getElementById('otp-form');
  if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();
      const otp = document.getElementById('otp-input').value.trim();
      if (!/^\d{6}$/.test(otp)) {
        showAuthError('Please enter the 6-digit code.');
        return;
      }
      // Simulate API call
      otpForm.querySelector('button[type="submit"]').disabled = true;
      otpForm.querySelector('button[type="submit"]').textContent = 'Verifying...';
      await new Promise(r => setTimeout(r, 900)); // mock delay
      // Mock: accept 123456 as valid, else error
      if (otp === '123456') {
        handleOtpSuccess('mock-session-token');
      } else {
        showAuthError('The code you entered is incorrect or has expired. Please try again.');
      }
      otpForm.querySelector('button[type="submit"]').disabled = false;
      otpForm.querySelector('button[type="submit"]').textContent = 'Verify & Login';
    });
  }
});
// --- Auth Modal: Login/OTP Logic ---
let resendTimer = null;
let resendCountdown = 60;
let lastLoginPhone = '';

function showAuthError(msg) {
  const err = document.getElementById('auth-error');
  if (err) {
    err.textContent = msg;
    err.style.display = 'block';
  }
}
function clearAuthError() {
  const err = document.getElementById('auth-error');
  if (err) err.style.display = 'none';
}
function switchToOtpStep(phone) {
  document.getElementById('auth-step-login').style.display = 'none';
  document.getElementById('auth-step-otp').style.display = 'block';
  document.getElementById('otp-phone-display').textContent = '+252 ' + phone;
  document.getElementById('otp-input').value = '';
  clearAuthError();
  startResendTimer();
}
function startResendTimer() {
  const btn = document.getElementById('resend-otp-btn');
  const timer = document.getElementById('resend-timer');
  resendCountdown = 60;
  btn.disabled = true;
  timer.textContent = resendCountdown;
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendCountdown--;
    timer.textContent = resendCountdown;
    if (resendCountdown <= 0) {
      clearInterval(resendTimer);
      btn.disabled = false;
      timer.textContent = '';
    }
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  // Login form submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthError();
      const phone = document.getElementById('login-phone').value.trim();
      if (!/^\d{9}$/.test(phone)) {
        showAuthError('Please enter a valid Somali phone number.');
        return;
      }
      // Simulate API call
      loginForm.querySelector('button[type="submit"]').disabled = true;
      loginForm.querySelector('button[type="submit"]').textContent = 'Sending...';
      await new Promise(r => setTimeout(r, 900)); // mock delay
      // Mock: always success
      lastLoginPhone = phone;
      switchToOtpStep(phone);
      loginForm.querySelector('button[type="submit"]').disabled = false;
      loginForm.querySelector('button[type="submit"]').textContent = 'Send Verification Code';
    });
  }
  // Resend OTP
  const resendBtn = document.getElementById('resend-otp-btn');
  if (resendBtn) {
    resendBtn.addEventListener('click', async () => {
      if (resendBtn.disabled) return;
      clearAuthError();
      resendBtn.disabled = true;
      resendBtn.textContent = 'Resending...';
      await new Promise(r => setTimeout(r, 900)); // mock delay
      resendBtn.textContent = 'Resend Code ';
      document.getElementById('resend-timer').textContent = resendCountdown;
      startResendTimer();
    });
  }
});
// === Auth Modal State & Accessibility ===
let authModalOpen = false;
let lastFocusedElement = null;

function openAuthModal(step = 'login') {
  const overlay = document.getElementById('auth-modal-overlay');
  const modal = document.getElementById('auth-modal');
  if (!modal || !overlay) return;
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');
  authModalOpen = true;
  lastFocusedElement = document.activeElement;
  // Show correct step
  document.getElementById('auth-step-login').style.display = (step === 'login') ? 'block' : 'none';
  document.getElementById('auth-step-otp').style.display = (step === 'otp') ? 'block' : 'none';
  document.getElementById('auth-error').style.display = 'none';
  // Focus first input
  setTimeout(() => {
    const firstInput = modal.querySelector('input:not([type=hidden]):not([disabled])');
    if (firstInput) firstInput.focus();
  }, 10);
  // Trap focus
  document.addEventListener('keydown', trapModalFocus, true);
}

function closeAuthModal() {
  const overlay = document.getElementById('auth-modal-overlay');
  const modal = document.getElementById('auth-modal');
  if (!modal || !overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  authModalOpen = false;
  document.removeEventListener('keydown', trapModalFocus, true);
  if (lastFocusedElement) lastFocusedElement.focus();
}

function trapModalFocus(e) {
  if (!authModalOpen) return;
  const modal = document.getElementById('auth-modal');
  if (!modal) return;
  const focusable = modal.querySelectorAll('a, button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  } else if (e.key === 'Escape') {
    closeAuthModal();
  }
}

// Modal open triggers (sidebar login/register link)

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar Login button (by text content)
  const sidebarLinks = document.querySelectorAll('.sidebar__link');
  for (const link of sidebarLinks) {
    if (link.textContent && link.textContent.trim().toLowerCase() === 'login') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal('login');
      });
      break;
    }
  }
  // Modal close (X)
  document.getElementById('auth-modal-close')?.addEventListener('click', closeAuthModal);
  // Overlay click
  document.getElementById('auth-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAuthModal();
  });
});
// --- GPS Accuracy Panel Logic ---
function showGpsAccuracyPanel(message) {
  const panel = document.getElementById('gps-accuracy-panel');
  const msg = document.getElementById('gps-accuracy-message');
  if (panel && msg) {
    msg.textContent = message || 'GPS accuracy: --';
    panel.style.display = 'flex';
  }
}

function hideGpsAccuracyPanel() {
  // No-op: panel should always be visible
}

function setupGpsAccuracyPanel(retryHandler) {
  const retryBtn = document.getElementById('gps-accuracy-retry');
  if (retryBtn) {
    retryBtn.onclick = retryHandler;
  }
}
// === Floating Info Panel & Button Logic ===
function showFindMyAddressBtn() {
  const btn = document.getElementById('find-my-address-btn');
  if (btn) {
    btn.style.display = 'flex';
    btn.style.opacity = '1';
    btn.classList.remove('fade-out');
  }
  const panel = document.getElementById('info-panel');
  if (panel) {
    panel.classList.remove('visible');
    setTimeout(() => { panel.style.display = 'none'; }, 350);
  }
}

function showInfoPanel({ code6D, regionName, districtName }) {
  const btn = document.getElementById('find-my-address-btn');
  if (btn) {
    btn.classList.add('fade-out');
    btn.style.opacity = '0';
    setTimeout(() => { btn.style.display = 'none'; }, 350);
  }
  const panel = document.getElementById('info-panel');
  if (panel) {
    // Populate code
    const codeStr = typeof code6D === 'string' ? code6D : (code6D?.code6D || '');
    const [c1, c2, c3] = codeStr.split('-');
    document.getElementById('code-part-1').textContent = c1 || '';
    document.getElementById('code-part-2').textContent = c2 || '';
    document.getElementById('code-part-3').textContent = c3 || '';
    // Populate district/region
    const districtDiv = document.getElementById('district-name');
    const regionDiv = document.getElementById('region-name');
    if (districtDiv) {
      if (districtName) { districtDiv.textContent = districtName; districtDiv.style.display = ''; }
      else { districtDiv.style.display = 'none'; }
    }
    if (regionDiv) {
      if (regionName) { regionDiv.textContent = regionName; regionDiv.style.display = ''; }
      else { regionDiv.style.display = 'none'; }
    }
    // Delay showing the info panel until the button fade-out is done
    setTimeout(() => {
      panel.style.display = 'flex';
      setTimeout(() => { panel.classList.add('visible'); }, 10);
    }, 350);
  }
}

function bindFloatingPanelUI(map, getCurrent6D, getCurrentLatLng) {
  // Find button triggers geolocation
  const findBtn = document.getElementById('find-my-address-btn');
  if (findBtn) {
    findBtn.addEventListener('click', () => {
      if (typeof handleFindMyLocation === 'function') handleFindMyLocation();
    });
  }
  // Copy
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = getCurrent6D();
      const district = document.getElementById('district-name')?.textContent || '';
      const region = document.getElementById('region-name')?.textContent || '';
      const full = [code, district, region].filter(Boolean).join(' - ');
      try {
        await navigator.clipboard.writeText(full);
        copyBtn.classList.add('copied');
        setTimeout(() => copyBtn.classList.remove('copied'), 800);
      } catch {}
    });
  }
  // Share
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const code = getCurrent6D();
      const url = window.location.href.split('#')[0] + '?code=' + encodeURIComponent(code);
      if (navigator.share) {
        try { await navigator.share({ title: '6D Address', text: code, url }); } catch {}
      } else {
        await navigator.clipboard.writeText(url);
      }
    });
  }
  // Recenter
  const recenterBtn = document.getElementById('recenter-btn');
  if (recenterBtn) {
    recenterBtn.addEventListener('click', () => {
      if (typeof getCurrentLatLng === 'function') {
        const latlng = getCurrentLatLng();
        if (latlng && map) map.panTo(latlng);
      }
    });
  }
  // Register
  const regBtn = document.getElementById('register-this-address-btn');
  if (regBtn) {
    regBtn.addEventListener('click', () => {
      setSidebarExpanded(true);
      // Hide all sidebar content except registration view
      document.querySelectorAll('.sidebar__section-heading, .sidebar__nav, .sidebar__utility').forEach(el => el.style.display = 'none');
      const regView = document.getElementById('view-register');
      if (regView) regView.classList.add('is-active');
      // Add back button if not present
      let backBtn = document.getElementById('sidebar-back-btn');
        if (!backBtn) {
          const sidebarHeader = document.querySelector('.sidebar__header');
          backBtn = document.createElement('button');
          backBtn.id = 'sidebar-back-btn';
          backBtn.title = 'Back to menu';
          backBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 19l-7-7 7-7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          backBtn.style.background = 'none';
          backBtn.style.border = 'none';
          backBtn.style.marginRight = '8px';
          backBtn.style.cursor = 'pointer';
          sidebarHeader.insertBefore(backBtn, sidebarHeader.firstChild);
          backBtn.addEventListener('click', () => {
            // Restore menu/groups
            document.querySelectorAll('.sidebar__section-heading, .sidebar__nav, .sidebar__utility').forEach(el => el.style.display = '');
            if (regView) regView.classList.remove('is-active');
            backBtn.remove();
          });
        }
  // Set code value and update colored code plaque
  const codeInput = document.getElementById('code');
  const code = getCurrent6D();
  if (codeInput) codeInput.value = code;
  const [rc1, rc2, rc3] = (code || '').split('-');
  const p1 = document.getElementById('register-code-part-1');
  const p2 = document.getElementById('register-code-part-2');
  const p3 = document.getElementById('register-code-part-3');
  if (p1) p1.textContent = rc1 || '';
  if (p2) p2.textContent = rc2 || '';
  if (p3) p3.textContent = rc3 || '';
    });
  }
}

// Theme toggler: live update
function setupThemeToggler() {
  const themeTgl = document.querySelector('#themeToggle');
  if (themeTgl) {
    const setTheme = (light) => {
      document.body.classList.toggle('dark-mode', !light);
      document.body.classList.toggle('light-mode', !!light);
      document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    };
    setTheme(themeTgl.checked);
    themeTgl.addEventListener('change', (e) => setTheme(e.target.checked));
  }
}
// public/js/somalia-map.js
// ES-module UI glue; core logic stays in map-core.js

import {
  generate6DCode,
  snapToGridCenter,
  drawAddressBoxes,
  updateDynamicGrid,
} from './map-core.js';
import * as CONFIG from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const normalize = (s) =>
  (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const REGION_SYNONYMS = new Map([['benadir', 'banaadir'], ['banadir', 'banaadir']]);
const DISTRICT_SYNONYMS = new Map([]);

/* ---------- Config normalization ---------- */
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

/* ---------- State ---------- */
let SOMALI_REGIONS = [];
let map;
// (marker removed)
let lastSnapped = null;      // plain {lat,lng} for UI/form
let geocoder;
let placesService;

/* ---------- Dropdowns ---------- */
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
    regionSel.disabled = true;          // lock Region
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

/* ---------- Geocoding / Places ---------- */
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

/* ---------- Map helpers ---------- */
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

/* Recenter visibility */
function updateRecenterVisibility() {
  const btn = $('#btnRecenter');
  if (!btn || !map || !lastSnapped) return;

  const hasGeom = !!(google.maps.geometry && google.maps.geometry.spherical);
  if (!hasGeom) { btn.style.display = 'none'; return; }

  const dist = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(lastSnapped.lat, lastSnapped.lng),
    map.getCenter()
  );
  btn.style.display = dist > 350 ? 'inline-flex' : 'none';
}

/* ---------- “Swoop” animation (zoom out → pan → zoom in) ---------- */
function animateToLocation(mapObj, latLng, onComplete) {
  if (!mapObj || !latLng) { if (onComplete) onComplete(); return; }

  const targetLL =
    (typeof latLng.lat === 'function' && typeof latLng.lng === 'function')
      ? latLng
      : new google.maps.LatLng(
          typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat,
          typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng
        );

  const startZoom = mapObj.getZoom() || 12;
  const zoomOut  = Math.max(5, startZoom - 4);
  const zoomIn   = 18;

  const originalGesture = mapObj.get('gestureHandling');
  mapObj.set('gestureHandling', 'none');

  const onceIdle = (fn) => google.maps.event.addListenerOnce(mapObj, 'idle', () => setTimeout(fn, 0));

  mapObj.setZoom(zoomOut);
  onceIdle(() => {
    mapObj.panTo(targetLL);
    onceIdle(() => {
      mapObj.setZoom(zoomIn);
      onceIdle(() => {
        mapObj.set('gestureHandling', originalGesture || 'greedy');
        if (typeof onComplete === 'function') onComplete();
      });
    });
  });
}

/* ---------- Info panel renderer ---------- */
function renderInfoPanel({ sixD, regionName, districtName }) {
  const info = $('#infoPanel');
  if (!info) return;

  const codeText = typeof sixD === 'string' ? sixD : (sixD?.code6D || '');
  const line1 = codeText || '';
  const line2 = districtName || '';
  const line3 = regionName || 'Somalia';

  const iconBtnStyle = `
    display:inline-flex;align-items:center;justify-content:center;
    width:32px;height:32px;border:1px solid var(--panel-border);
    border-radius:8px;background: var(--surface-1);cursor:pointer
  `;

  info.innerHTML = `
    <div class="info-panel__row" style="justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="display:flex;flex-direction:column;gap:4px;min-width:220px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div id="codeText" style="font-weight:600;font-size:16px;">${line1}</div>
          <div style="display:flex;gap:6px;">
            <button id="btnCopy" title="Copy address" aria-label="Copy address" style="${iconBtnStyle}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                <rect x="4" y="4" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2" opacity="0.8"/>
              </svg>
            </button>
            <button id="btnShare" title="Share" aria-label="Share" style="${iconBtnStyle}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="18" cy="5" r="3" stroke="currentColor" stroke-width="2"/>
                <circle cx="6" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                <circle cx="18" cy="19" r="3" stroke="currentColor" stroke-width="2"/>
                <path d="M8.9 11l6.2-4.2M8.9 13l6.2 4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
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

  $('#btnCopy')?.addEventListener('click', async () => {
    const fullText = `${line1}${line2 ? ' — ' + line2 : ''}${line3 ? ', ' + line3 : ''}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = fullText; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const el = $('#codeText'); if (el) { el.style.opacity = '0.6'; setTimeout(() => (el.style.opacity = '1'), 180); }
    } catch (e) { console.warn('Copy failed:', e); }
  });

  $('#btnShare')?.addEventListener('click', () => {});
  $('#btnRecenter')?.addEventListener('click', () => {
    if (lastSnapped && map) {
      map.panTo(new google.maps.LatLng(lastSnapped.lat, lastSnapped.lng));
      updateRecenterVisibility();
    }
  });

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

  updateRecenterVisibility();
}

/* ---------- Selection flow (ensure LatLng to core) ---------- */
async function handleSelectLatLng(rawLatLng) {
  if (!rawLatLng) return;

  const lat = typeof rawLatLng.lat === 'function' ? rawLatLng.lat() : rawLatLng.lat;
  const lng = typeof rawLatLng.lng === 'function' ? rawLatLng.lng() : rawLatLng.lng;

  const latLngLike = new google.maps.LatLng(lat, lng);
  const snappedAny = snapToGridCenter(latLngLike);

  const snappedLL = (typeof snappedAny.lat === 'function' && typeof snappedAny.lng === 'function')
    ? snappedAny
    : new google.maps.LatLng(
        typeof snappedAny.lat === 'function' ? snappedAny.lat() : snappedAny.lat,
        typeof snappedAny.lng === 'function' ? snappedAny.lng() : snappedAny.lng
      );

  const snapped = { lat: snappedLL.lat(), lng: snappedLL.lng() };
  lastSnapped = snapped;

  // Visual feedback: 6D boxes only
  drawAddressBoxes(map, snappedLL);
  updateDynamicGrid(map, snappedLL);

  // Center the map (no marker)
  map.panTo(snappedLL);

  let regionName = '', districtName = '';
  try {
    const rd = await reverseGeocode(snapped.lat, snapped.lng);
    regionName = rd.regionName || '';
    districtName = rd.districtName || '';
  } catch (e) {
    console.warn('Reverse geocoding failed:', e?.message || e);
  }

  const sixD = generate6DCode(snapped.lat, snapped.lng);
  showInfoPanel({ code6D: sixD, regionName, districtName });
}

/* ---------- Find My Location uses “swoop” ---------- */
function handleFindMyLocation() {
  if (!navigator.geolocation) return;
  showGpsAccuracyPanel('Getting GPS fix...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const accuracy = pos.coords.accuracy;
      showGpsAccuracyPanel(`GPS accuracy: ±${Math.round(accuracy)}m`);
      const gLL = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      animateToLocation(map, gLL, () => {
        handleSelectLatLng(gLL);
      });
    },
    (err) => {
      showGpsAccuracyPanel('Unable to get location');
    }
  );
// Ensure GPS panel is always visible on load
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('gps-accuracy-panel');
  if (panel) panel.style.display = 'flex';
});
// Setup GPS accuracy panel retry on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  setupGpsAccuracyPanel(handleFindMyLocation);
});
}

/* ---------- Bind + init ---------- */
function bindUI() {
  $('#sidebarToggle')?.addEventListener('click', () => {
    const sb = $('#sidebar');
    const willExpand = sb?.classList.contains('collapsed');
    setSidebarExpanded(!!willExpand);
  });

  $('#ctaFind')?.addEventListener('click', handleFindMyLocation);

  $('#region')?.addEventListener('change', (e) => {
    const regionName = e.target.value;
    populateDistrictsDropdown(regionName);
  });

  // Theme toggle (default dark)
  const themeTgl = document.querySelector('#themeToggle');
  if (themeTgl) {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeTgl.checked = false;
    themeTgl.addEventListener('change', (e) => {
      const light = e.target.checked;
      document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    });
  }
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

    // PRD FR-S2 — match Global Map navigation
    draggableCursor: 'pointer',
    gestureHandling: 'greedy',
  });

  placesService = new google.maps.places.PlacesService(map);

  map.addListener('zoom_changed', () => {
    if (lastSnapped) updateDynamicGrid(map, new google.maps.LatLng(lastSnapped.lat, lastSnapped.lng));
  });
  map.addListener('dragend', () => {
    if (lastSnapped) updateDynamicGrid(map, new google.maps.LatLng(lastSnapped.lat, lastSnapped.lng));
  });
  map.addListener('idle', () => updateRecenterVisibility());

  // Map click gives a Google LatLng
  map.addListener('click', (e) => handleSelectLatLng(e.latLng));

  setSidebarExpanded(false);
}

document.addEventListener('DOMContentLoaded', async () => {
  SOMALI_REGIONS = resolveSomaliRegions();
  populateRegionsDropdown();
  bindUI();
  setupThemeToggler();
  showFindMyAddressBtn();
  bindFloatingPanelUI(
    map,
    () => {
      // Return current 6D code as string
      const c1 = document.getElementById('code-part-1')?.textContent || '';
      const c2 = document.getElementById('code-part-2')?.textContent || '';
      const c3 = document.getElementById('code-part-3')?.textContent || '';
      return [c1, c2, c3].filter(Boolean).join('-');
    },
    () => lastSnapped ? new google.maps.LatLng(lastSnapped.lat, lastSnapped.lng) : null
  );
  try {
    await initMapOnceReady();
  } catch (err) {
    console.error('[Maps init] ', err);
  }
});
