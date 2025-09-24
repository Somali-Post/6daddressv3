// Render dashboard content inside sidebar
function renderDashboardInSidebar() {
  let dash = document.getElementById('sidebar-dashboard-panel');
  if (!dash) {
    dash = document.createElement('div');
    dash.id = 'sidebar-dashboard-panel';
    const contentArea = document.getElementById('sidebar-content-area');
    if (contentArea) {
        contentArea.appendChild(dash);
    } else {
        // Fallback for old structure
        const sidebarScroll = document.querySelector('.sidebar__scroll');
        sidebarScroll.appendChild(dash);
    }
  }

  // New dashboard design
  dash.innerHTML = `
    <div style="padding: 2em 1.5em; display: flex; flex-direction: column; gap: 2.5em;">
      <div style="text-align: center;">
        <div style="font-size: 1rem; color: var(--text-secondary); margin-bottom: 0.5em; text-transform: uppercase; letter-spacing: 0.8px;">Your 6D Address</div>
        <div style="font-size: 2.2rem; font-weight: 700; letter-spacing: 2px; margin-bottom: 0.5rem;">
          <span class="code-part code-red">45</span><span class="code-dash">-</span><span class="code-part code-green">78</span><span class="code-dash">-</span><span class="code-part code-blue">12</span>
        </div>
        <div style="font-size: 1.2rem; color: var(--text-primary);">Shangaani, Banaadir 03</div>
      </div>

      <div style="border-top: 1px solid var(--panel-border); padding-top: 1.5em; display: flex; flex-direction: column; gap: 0.5em;">
        <a href="#" id="dashboard-update-btn" class="sidebar__link" style="justify-content: flex-start; padding: 0.8em 1em; border-radius: 8px;">
          <span class="sidebar__icon" style="font-size: 1.2em;">🔄</span>
          <span class="link-text">Update My Address</span>
        </a>
        <a href="#" id="dashboard-share-btn" class="sidebar__link" style="justify-content: flex-start; padding: 0.8em 1em; border-radius: 8px;">
          <span class="sidebar__icon" style="font-size: 1.2em;">🔗</span>
          <span class="link-text">Share My Address</span>
        </a>
      </div>
    </div>
  `;
}

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

  // Setup flex container for proper layout
  sidebarScroll.style.display = 'flex';
  sidebarScroll.style.flexDirection = 'column';
  sidebarScroll.style.height = '100%';
  sidebarScroll.innerHTML = ''; // Clear previous content

  // --- Top Section (Nav + Content) ---
  const topSection = document.createElement('div');
  topSection.innerHTML = `
    <nav class="sidebar__nav" aria-label="Main" style="padding: 1.5em 1.5em 1em;">
      <a class="sidebar__link active" id="sidebar-dashboard" href="#"><span class="sidebar__icon">🏠</span><span class="link-text">Dashboard</span></a>
      <a class="sidebar__link" id="sidebar-history" href="#"><span class="sidebar__icon">🕑</span><span class="link-text">History</span></a>
      <a class="sidebar__link" id="sidebar-settings" href="#"><span class="sidebar__icon">⚙️</span><span class="link-text">Settings</span></a>
    </nav>
    <div id="sidebar-content-area" style="padding: 0 0.5em;"></div>
  `;

  // --- Bottom Section (Profile + Logout) ---
  const bottomSection = document.createElement('div');
  bottomSection.style.marginTop = 'auto'; // Pushes this section to the bottom
  bottomSection.innerHTML = `
    <div class="sidebar__profile" style="padding: 1.5em; border-top: 1px solid var(--panel-border);">
        <div style="display:flex; align-items: center; gap: 12px; margin-bottom: 1em;">
            <div class="profile-avatar" style="width:40px;height:40px;border-radius:50%;background:var(--surface-3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">👤</div>
            <div style="display:flex;flex-direction:column;gap:2px;">
                <div class="profile-name" style="font-weight:600;">User</div>
                <div class="profile-phone" style="font-size:0.9rem;color:var(--text-secondary);">+252 ••••••••</div>
            </div>
        </div>
        <a class="sidebar__link" id="sidebar-logout" href="#"><span class="sidebar__icon">🚪</span><span class="link-text">Logout</span></a>
    </div>
  `;

  sidebarScroll.appendChild(topSection);
  sidebarScroll.appendChild(bottomSection);

  // Render initial dashboard content
  renderDashboardInSidebar();

  // Hide the main map's info panel if it's open
  const infoPanel = document.getElementById('info-panel');
  if (infoPanel) infoPanel.style.display = 'none';

  // --- Event Handlers ---
  document.getElementById('sidebar-dashboard')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Here you would typically show the dashboard panel and hide others
    renderDashboardInSidebar(); 
  });
  // Add handlers for History, Settings etc. here if they have their own render functions

  document.getElementById('sidebar-logout')?.addEventListener('click', () => {
    localStorage.removeItem('sessionToken');
    appState.isAuthenticated = false;
    // Reset the flex styles on logout
    sidebarScroll.style.display = '';
    sidebarScroll.style.flexDirection = '';
    sidebarScroll.style.height = '';
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

function showInfoPanel({ sixD, regionName, districtName }) {
  const btn = document.getElementById('find-my-address-btn');
  if (btn) {
    btn.classList.add('fade-out');
    btn.style.opacity = '0';
    setTimeout(() => { btn.style.display = 'none'; }, 350);
  }
  const panel = document.getElementById('info-panel');
  if (panel) {
    // Populate code
    const codeStr = typeof sixD === 'string' ? sixD : (sixD?.code6D || '');
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

function styleRegistrationForm() {
    const view = document.getElementById('view-register');
    if (!view) return;

    // Using a small delay to ensure view is rendered and transitions are complete
    setTimeout(() => {
        view.style.padding = '1.5em 2em';
        view.style.color = 'var(--text-primary)';

        const form = view.querySelector('form');
        if (form) {
            form.style.display = 'flex';
            form.style.flexDirection = 'column';
            form.style.gap = '1.5em';
        }

        const labels = view.querySelectorAll('label');
        labels.forEach(label => {
            label.style.fontWeight = '600';
            label.style.fontSize = '0.9em';
            label.style.color = 'var(--text-secondary)';
            label.style.textTransform = 'uppercase';
            label.style.letterSpacing = '0.5px';
        });

        const inputs = view.querySelectorAll('input[type="text"], input[type="tel"], select');
        inputs.forEach(input => {
            input.style.width = '100%';
            input.style.padding = '1em';
            input.style.border = '1px solid var(--panel-border)';
            input.style.borderRadius = '8px';
            input.style.backgroundColor = 'var(--surface-2)';
            input.style.fontSize = '1em';
            input.style.color = 'var(--text-primary)';
            input.style.marginTop = '0.5em';
        });

        const districtMsg = document.getElementById('district-detected');
        if (districtMsg) {
            districtMsg.style.padding = '1em';
            districtMsg.style.backgroundColor = 'var(--surface-1)';
            districtMsg.style.borderRadius = '8px';
            districtMsg.style.fontSize = '0.95em';
            districtMsg.style.lineHeight = '1.5';
            districtMsg.style.border = '1px solid var(--panel-border)';
            districtMsg.style.marginBottom = '0.5em';
        }

        const submitBtn = view.querySelector('button[type="submit"]');
        if(submitBtn) {
            submitBtn.style.padding = '1em';
            submitBtn.style.fontSize = '1.1em';
            submitBtn.style.fontWeight = '700';
            submitBtn.style.borderRadius = '8px';
        }
    }, 50);
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

      const { regionName, districtName } = lastAddressDetails;

      const districtMsg = document.getElementById('district-detected');
      if (districtMsg) {
        if (districtName) {
          districtMsg.innerHTML = `Your district is <strong>${districtName}</strong>. If this is not correct, please choose from the dropdown.`;
        } else {
          districtMsg.textContent = 'Could not detect your district. Please select it from the dropdown.';
        }
      }
      
      if (regionName) {
        autoSelectRegion(regionName);
        autoSelectDistrict(regionName, districtName);
      } else {
        const regionSel = $('#region');
        if(regionSel) regionSel.disabled = false;
        populateDistrictsDropdown(''); // Clear districts
      }

      styleRegistrationForm();
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
let lastAddressDetails = {}; // To store region and district
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
  lastAddressDetails = { sixD, regionName, districtName };
  showInfoPanel(lastAddressDetails);
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
    document.documentElement.setAttribute('data-theme', 'light'); // Default to light mode
    themeTgl.checked = true;
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
    // Hide 6D loader overlay
    const loader = document.getElementById('sixd-loading');
    if (loader) loader.classList.add('sixd-hide');
  } catch (err) {
    console.error('[Maps init] ', err);
    // Hide loader even on error
    const loader = document.getElementById('sixd-loading');
    if (loader) loader.classList.add('sixd-hide');
  }
});
